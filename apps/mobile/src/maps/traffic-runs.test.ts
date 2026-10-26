import { describe, expect, it } from "vitest";
import { hasTraffic, trafficRuns } from "./traffic-runs";
import type { LatLng } from "./types";

const pts = (n: number): LatLng[] => Array.from({ length: n }, (_, i) => ({ lat: i, lng: i }));
const shape = (runs: ReturnType<typeof trafficRuns>) => runs.map((r) => [r.speed, r.points.map((p) => p.lat)]);

describe("trafficRuns", () => {
  it("sin trafficSegments dibuja una sola linea fluida con todos los puntos", () => {
    expect(shape(trafficRuns(pts(4)))).toEqual([["normal", [0, 1, 2, 3]]]);
  });

  it("con menos de dos puntos no hay nada que dibujar", () => {
    expect(trafficRuns(pts(1))).toEqual([]);
    expect(trafficRuns([], [{ startIndex: 0, endIndex: 3, speed: "jam" }])).toEqual([]);
  });

  it("tramos contiguos comparten el punto de union (indices inclusivos)", () => {
    const runs = trafficRuns(pts(6), [
      { startIndex: 0, endIndex: 2, speed: "normal" },
      { startIndex: 2, endIndex: 4, speed: "jam" },
      { startIndex: 4, endIndex: 5, speed: "slow" },
    ]);
    expect(shape(runs)).toEqual([
      ["normal", [0, 1, 2]],
      ["jam", [2, 3, 4]],
      ["slow", [4, 5]],
    ]);
  });

  it("los huecos sin datos se dibujan fluidos y los tramos iguales seguidos se unen", () => {
    const runs = trafficRuns(pts(8), [
      { startIndex: 2, endIndex: 3, speed: "slow" },
      { startIndex: 3, endIndex: 5, speed: "slow" },
    ]);
    expect(shape(runs)).toEqual([
      ["normal", [0, 1, 2]],
      ["slow", [2, 3, 4, 5]],
      ["normal", [5, 6, 7]],
    ]);
  });

  it("acota los tramos que se pasan del largo de la polilinea y ordena los desordenados", () => {
    const runs = trafficRuns(pts(4), [
      { startIndex: 2, endIndex: 9, speed: "jam" },
      { startIndex: 0, endIndex: 2, speed: "slow" },
      { startIndex: 7, endIndex: 9, speed: "slow" },
    ]);
    expect(shape(runs)).toEqual([
      ["slow", [0, 1, 2]],
      ["jam", [2, 3]],
    ]);
  });

  it("un tramo solapado con el anterior empieza donde termino aquel", () => {
    const runs = trafficRuns(pts(6), [
      { startIndex: 0, endIndex: 3, speed: "slow" },
      { startIndex: 1, endIndex: 5, speed: "jam" },
    ]);
    expect(shape(runs)).toEqual([
      ["slow", [0, 1, 2, 3]],
      ["jam", [3, 4, 5]],
    ]);
  });
});

describe("hasTraffic", () => {
  it("es verdadero solo si hay algun tramo lento o detenido", () => {
    expect(hasTraffic(trafficRuns(pts(4)))).toBe(false);
    expect(hasTraffic(trafficRuns(pts(4), [{ startIndex: 1, endIndex: 2, speed: "slow" }]))).toBe(true);
    expect(hasTraffic(trafficRuns(pts(4), [{ startIndex: 1, endIndex: 2, speed: "jam" }]))).toBe(true);
  });
});
