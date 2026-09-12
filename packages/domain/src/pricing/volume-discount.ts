import type { ProductCategory } from "../products/entities";
import { roundCents, type Cents } from "../shared/types";

export interface VolumeTier {
  minQty: number;
  discountPct: number; // e.g. 0.05 = 5%
}

// Ordenado descendente por minQty — getDiscountForQty depende de este orden.
export const VOLUME_TIERS: VolumeTier[] = [
  { minQty: 100, discountPct: 0.15 },
  { minQty: 50, discountPct: 0.1 },
  { minQty: 20, discountPct: 0.05 },
];

// El descuento por volumen premia comprar mucho de un mismo "sin" (y el café
// que acompaña un pedido grande) — las virtudes nunca se descuentan.
export function isVolumeEligible(category: ProductCategory): boolean {
  return category === "sin" || category === "coffee";
}

export function getDiscountForQty(qty: number, category: ProductCategory): VolumeTier | null {
  if (!isVolumeEligible(category)) return null;
  return VOLUME_TIERS.find((tier) => qty >= tier.minQty) ?? null;
}

export function getDiscountedUnitPriceCents(unitPriceCents: Cents, qty: number, category: ProductCategory): Cents {
  const tier = getDiscountForQty(qty, category);
  if (!tier) return unitPriceCents;
  return roundCents(unitPriceCents * (1 - tier.discountPct));
}

export function getLineTotalCents(unitPriceCents: Cents, qty: number, category: ProductCategory): Cents {
  return getDiscountedUnitPriceCents(unitPriceCents, qty, category) * qty;
}
