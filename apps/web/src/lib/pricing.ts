import type { Product } from './data';

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

// Volume pricing rewards buying a lot of one "sin" (and the coffee that
// pairs with a big order) — virtues are never discounted, no matter the qty.
export function isVolumeEligible(category: Product['category']): boolean {
  return category === 'sin' || category === 'coffee';
}

export function getDiscountForQty(qty: number, category: Product['category']): VolumeTier | null {
  if (!isVolumeEligible(category)) return null;
  return VOLUME_TIERS.find((tier) => qty >= tier.minQty) ?? null;
}

export function getDiscountedUnitPrice(unitPrice: number, qty: number, category: Product['category']): number {
  const tier = getDiscountForQty(qty, category);
  if (!tier) return unitPrice;
  return unitPrice * (1 - tier.discountPct);
}

export function getLineTotal(unitPrice: number, qty: number, category: Product['category']): number {
  return getDiscountedUnitPrice(unitPrice, qty, category) * qty;
}
