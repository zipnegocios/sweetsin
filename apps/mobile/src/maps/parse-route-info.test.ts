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
});
