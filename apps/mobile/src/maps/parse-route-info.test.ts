import { describe, expect, it } from "vitest";
import { parseRouteInfo } from "./parse-route-info";

const valid = {
  etaSeconds: 720,
  distanceMeters: 3400,
  encodedPolyline: "abc",
  origin: { lat: 25.7, lng: -80.2 },
  destination: { lat: 25.8, lng: -80.3 },
  computedAt: "2026-10-20T12:00:00.000Z",
};

describe("parseRouteInfo", () => {
  it("devuelve la ruta valida", () => {
    expect(parseRouteInfo(valid)).toEqual(valid);
  });
  it.each([
    ["null", null],
    ["no objeto", "x"],
    ["sin origin", { ...valid, origin: undefined }],
    ["origin sin lng", { ...valid, origin: { lat: 1 } }],
    ["destination con string", { ...valid, destination: { lat: "1", lng: 2 } }],
    ["etaSeconds NaN", { ...valid, etaSeconds: NaN }],
    ["distanceMeters Infinity", { ...valid, distanceMeters: Infinity }],
    ["etaSeconds string", { ...valid, etaSeconds: "720" }],
    ["polyline no string", { ...valid, encodedPolyline: 5 }],
  ])("devuelve null: %s", (_n, input) => {
    expect(parseRouteInfo(input)).toBeNull();
  });

  it("acepta trafficSegments validos y descarta los invalidos", () => {
    const r = parseRouteInfo({
      ...valid,
      trafficSegments: [
        { startIndex: 0, endIndex: 2, speed: "slow" },
        { startIndex: 2, endIndex: 1, speed: "jam" },
        { startIndex: 0, endIndex: 1, speed: "fast" },
        { startIndex: "0", endIndex: 1, speed: "normal" },
        null,
        { startIndex: 1, endIndex: 3, speed: "jam" },
      ],
    });
    expect(r?.trafficSegments).toEqual([
      { startIndex: 0, endIndex: 2, speed: "slow" },
      { startIndex: 1, endIndex: 3, speed: "jam" },
    ]);
  });
  it("ignora trafficSegments que no es un arreglo o queda vacio", () => {
    expect(parseRouteInfo({ ...valid, trafficSegments: "x" })).toEqual(valid);
    expect(parseRouteInfo({ ...valid, trafficSegments: [{ bad: 1 }] })).toEqual(valid);
    expect(parseRouteInfo({ ...valid, trafficSegments: [] })).toEqual(valid);
  });
});
