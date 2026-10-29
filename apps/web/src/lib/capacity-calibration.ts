import {
  estimatePreparation,
  type CapacityRepository,
  type PrepStep,
  type ProductCapacityRule,
} from "@workspace/domain/capacity";
import { percentile, segmentDurations, type OrderTimingRepository, type TimingOrderRow } from "@workspace/domain/order-timing";
import { DrizzleCapacityRepository, DrizzleOrderTimingRepository } from "@workspace/db/repositories";

const MIN_SAMPLE = 10;
const WINDOW_DAYS = 90;

export interface CalibrationRow {
  productId: string;
  configuredSeconds: number | null;
  measuredMedianSeconds: number | null;
  sampleSize: number;
  smallSample: boolean;
}

type Lines = { productId: string; quantity: number }[];

/**
 * "Preparación" = tramo `prep` del proyecto 3 (in_prep -> ready_for_pickup).
 * Un pedido con varios productos no permite atribuir ese tiempo a ninguno de forma honesta,
 * así que solo cuentan pedidos de UNA línea con cantidad 1 (tiempo de una unidad, comparable
 * con la configuración para cantidad 1). Cancelados no tienen tramos.
 */
export function buildCalibration(input: {
  rows: TimingOrderRow[];
  items: Map<string, Lines>;
  rules: ProductCapacityRule[];
  steps: PrepStep[];
  workAreaUnits: number | null;
}): CalibrationRow[] {
  const samples = new Map<string, number[]>();
  for (const row of input.rows) {
    const lines = input.items.get(row.orderId);
    if (lines?.length !== 1 || lines[0]!.quantity !== 1) continue;
    const prepMs = segmentDurations(row).prep;
    if (prepMs === undefined) continue;
    const list = samples.get(lines[0]!.productId) ?? [];
    list.push(prepMs / 1000);
    samples.set(lines[0]!.productId, list);
  }
  const ruleMap = new Map(input.rules.map((r) => [r.productId, r]));
  const stepMap = new Map<string, PrepStep[]>();
  for (const s of input.steps) stepMap.set(s.productId, [...(stepMap.get(s.productId) ?? []), s]);
  const ids = new Set([...ruleMap.keys(), ...stepMap.keys(), ...samples.keys()]);
  return [...ids].sort().map((productId) => {
    const est = estimatePreparation([{ productId, quantity: 1 }], ruleMap, stepMap, input.workAreaUnits).perProduct[0]!;
    const values = samples.get(productId) ?? [];
    return {
      productId,
      configuredSeconds: est.hasData ? est.seconds : null,
      measuredMedianSeconds: percentile(values, 50),
      sampleSize: values.length,
      smallSample: values.length < MIN_SAMPLE,
    };
  });
}

export async function loadCalibration(
  now = new Date(),
  capacity: CapacityRepository = new DrizzleCapacityRepository(),
  timing: OrderTimingRepository = new DrizzleOrderTimingRepository(),
): Promise<CalibrationRow[]> {
  const range = { from: new Date(now.getTime() - WINDOW_DAYS * 86_400_000), to: now };
  const rows = await timing.listForReport(range);
  const [items, rules, steps, settings] = await Promise.all([
    timing.itemsByOrder(range),
    capacity.listRules(),
    capacity.listSteps(),
    capacity.getSettings(),
  ]);
  return buildCalibration({ rows, items, rules, steps, workAreaUnits: settings.workAreaUnits });
}
