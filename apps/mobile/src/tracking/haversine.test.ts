import { describe, expect, it } from "vitest";
import { distanceMeters } from "./haversine";

describe("distanceMeters", () => {
  it("mismo punto es 0", () => {
    expect(distanceMeters({ lat: -33.8, lng: 151.2 }, { lat: -33.8, lng: 151.2 })).toBe(0);
  });
  it("un grado de latitud son ~111195 m", () => {
    expect(Math.abs(distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) - 111_195)).toBeLessThan(200);
  });
});
