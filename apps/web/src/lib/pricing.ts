export interface VolumeTier {
  minQty: number;
  discountPct: number; // e.g. 0.05 = 5%
}

// Sorted descending by minQty — getDiscountForQty relies on this order.
export const VOLUME_TIERS: VolumeTier[] = [
  { minQty: 100, discountPct: 0.15 },
  { minQty: 50, discountPct: 0.10 },
  { minQty: 20, discountPct: 0.05 },
];

export function getDiscountForQty(qty: number): VolumeTier | null {
  return VOLUME_TIERS.find((tier) => qty >= tier.minQty) ?? null;
}

export function getDiscountedUnitPrice(unitPrice: number, qty: number): number {
  const tier = getDiscountForQty(qty);
  if (!tier) return unitPrice;
  return unitPrice * (1 - tier.discountPct);
}

export function getLineTotal(unitPrice: number, qty: number): number {
  return getDiscountedUnitPrice(unitPrice, qty) * qty;
}
