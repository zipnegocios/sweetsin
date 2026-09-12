import { describe, it, expect } from "vitest";
import { isVolumeEligible, getDiscountForQty, getDiscountedUnitPriceCents, getLineTotalCents } from "./volume-discount";

describe("isVolumeEligible", () => {
  it("is eligible for sin and coffee, not virtue", () => {
    expect(isVolumeEligible("sin")).toBe(true);
    expect(isVolumeEligible("coffee")).toBe(true);
    expect(isVolumeEligible("virtue")).toBe(false);
  });
});

describe("getDiscountForQty", () => {
  it("returns the highest tier the quantity qualifies for", () => {
    expect(getDiscountForQty(100, "sin")?.discountPct).toBe(0.15);
    expect(getDiscountForQty(50, "sin")?.discountPct).toBe(0.1);
    expect(getDiscountForQty(20, "sin")?.discountPct).toBe(0.05);
    expect(getDiscountForQty(19, "sin")).toBeNull();
  });

  it("never discounts virtue regardless of quantity", () => {
    expect(getDiscountForQty(1000, "virtue")).toBeNull();
  });
});

describe("getDiscountedUnitPriceCents", () => {
  it("applies the tier discount and rounds to whole cents", () => {
    // 1300 * 0.95 = 1235 exacto
    expect(getDiscountedUnitPriceCents(1300, 20, "sin")).toBe(1235);
  });

  it("returns the original price when no tier applies", () => {
    expect(getDiscountedUnitPriceCents(1300, 5, "sin")).toBe(1300);
  });
});

describe("getLineTotalCents", () => {
  it("multiplies the discounted unit price by quantity", () => {
    expect(getLineTotalCents(1300, 20, "sin")).toBe(1235 * 20);
  });
});
