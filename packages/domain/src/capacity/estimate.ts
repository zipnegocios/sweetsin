import type { PrepStep, ProductCapacityRule } from "./entities";

export interface CapacityLine {
  productId: string;
  quantity: number;
}

export interface ProductPrepEstimate {
  productId: string;
  seconds: number;
  hasData: boolean;
}

function unitsPerBatch(
  quantity: number,
  workAreaUnits: number | null,
  batchUnits: number | null,
): number {
  const limits = [workAreaUnits, batchUnits].filter(
    (n): n is number => n !== null && n > 0,
  );
  return limits.length > 0 ? Math.min(...limits) : quantity;
}

export function estimatePreparation(
  lines: CapacityLine[],
  rules: Map<string, ProductCapacityRule>,
  steps: Map<string, PrepStep[]>,
  workAreaUnits: number | null,
): { seconds: number; perProduct: ProductPrepEstimate[] } {
  const perProduct = lines.map(({ productId, quantity }) => {
    const rule = rules.get(productId);
    const productSteps = steps.get(productId) ?? [];
    const qty = Math.max(0, quantity);
    const batches =
      qty === 0
        ? 0
        : Math.ceil(
            qty / unitsPerBatch(qty, workAreaUnits, rule?.batchUnits ?? null),
          );
    const hasBatchTime = rule?.batchSeconds != null;
    let seconds = hasBatchTime ? batches * (rule?.batchSeconds ?? 0) : 0;
    for (const step of productSteps) {
      seconds += step.seconds * (step.mode === "per_batch" ? batches : qty);
    }
    return {
      productId,
      seconds,
      hasData: hasBatchTime || productSteps.length > 0,
    };
  });
  return { seconds: perProduct.reduce((sum, p) => sum + p.seconds, 0), perProduct };
}

export function estimateTransport(
  totalUnits: number,
  vehicleCapacityUnits: number | null,
  tripMinutes: number | null,
): { trips: number; minutes: number } {
  if (vehicleCapacityUnits === null || vehicleCapacityUnits <= 0) {
    return { trips: 1, minutes: 0 };
  }
  const trips = Math.max(1, Math.ceil(totalUnits / vehicleCapacityUnits));
  return { trips, minutes: trips * (tripMinutes ?? 0) };
}
