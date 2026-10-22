import { describe, it, expect } from "vitest";
import { buildEvidenceKey, isEvidenceKeyForOrder } from "./delivery-evidence-key";

describe("delivery-evidence-key", () => {
  it("arma la key con prefijo, orden y id unico", () => {
    expect(buildEvidenceKey("delivery-evidence/", "o1", "u1")).toBe("delivery-evidence/o1/u1.jpg");
  });

  it("reconoce una key de la orden correcta", () => {
    expect(isEvidenceKeyForOrder("delivery-evidence/o1/u1.jpg", "delivery-evidence/", "o1")).toBe(true);
  });

  it("rechaza otra orden, otro prefijo o rutas anidadas", () => {
    const key = "delivery-evidence/o1/u1.jpg";
    expect(isEvidenceKeyForOrder(key, "delivery-evidence/", "o2")).toBe(false);
    expect(isEvidenceKeyForOrder(key, "otro/", "o1")).toBe(false);
    expect(isEvidenceKeyForOrder("delivery-evidence/o1/../o2/u1.jpg", "delivery-evidence/", "o1")).toBe(false);
  });
});
