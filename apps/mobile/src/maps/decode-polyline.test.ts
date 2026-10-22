import { describe, expect, it } from "vitest";
import { decodePolyline } from "./decode-polyline";

describe("decodePolyline", () => {
  it("decodifica el ejemplo canonico de la documentacion de Google", () => {
    const points = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(points).toHaveLength(3);
    const expected = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    points.forEach((p, i) => {
      expect(p.lat).toBeCloseTo(expected[i]!.lat, 5);
      expect(p.lng).toBeCloseTo(expected[i]!.lng, 5);
    });
  });

  it("devuelve una lista vacia para la cadena vacia", () => {
    expect(decodePolyline("")).toEqual([]);
  });
});
