import { describe, expect, it } from "vitest";
import { navigationUrl } from "./navigation-url";

describe("navigationUrl", () => {
  it("con destino de la ruta usa las coordenadas en modo conducir", () => {
    expect(navigationUrl({ lat: -27.4698, lng: 153.0251 }, "1 Queen St")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=-27.4698,153.0251&travelmode=driving",
    );
  });

  it("sin ruta usa la direccion codificada", () => {
    expect(navigationUrl(null, "1 Queen St, Brisbane & CBD")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=1%20Queen%20St%2C%20Brisbane%20%26%20CBD&travelmode=driving",
    );
  });
});
