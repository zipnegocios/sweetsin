import type { CapacitySettings, PrepStep, ProductCapacityRule } from "./entities";
import {
  estimatePreparation,
  estimateTransport,
  type CapacityLine,
} from "./estimate";

export type CapacityReasonCode =
  | "not_sold_online"
  | "over_delivery_cap"
  | "lead_time"
  | "over_vehicle_trips"
  | "scheduled_for_invalid";

export interface CapacityReason {
  code: CapacityReasonCode;
  productId?: string;
  allowedQty?: number;
  earliestAt?: Date;
  maxTrips?: number;
  neededTrips?: number;
}

export interface DeliveryEvaluationInput {
  lines: CapacityLine[];
  rules: Map<string, ProductCapacityRule>;
  steps: Map<string, PrepStep[]>;
  settings: CapacitySettings;
  now: Date;
  scheduledFor: Date | null;
}

export interface DeliveryEvaluation {
  ok: boolean;
  reasons: CapacityReason[];
  estimate: { prepSeconds: number; trips: number; transportMinutes: number };
}

const MAX_SCHEDULE_DAYS = 60;
const MINUTE_MS = 60_000;

export function evaluateDeliveryOrder(
  input: DeliveryEvaluationInput,
): DeliveryEvaluation {
  const { lines, rules, steps, settings, now, scheduledFor } = input;
  const prep = estimatePreparation(lines, rules, steps, settings.workAreaUnits);
  const totalUnits = lines.reduce((sum, l) => sum + l.quantity, 0);
  const transport = estimateTransport(
    totalUnits,
    settings.vehicleCapacityUnits,
    settings.tripMinutes,
  );
  const estimate = {
    prepSeconds: prep.seconds,
    trips: transport.trips,
    transportMinutes: transport.minutes,
  };
  // Con el motor apagado igual se devuelve `estimate`; quien consume debe ignorarlo.
  if (!settings.capacityEngineEnabled) return { ok: true, reasons: [], estimate };

  const reasons: CapacityReason[] = [];
  let leadProductId: string | undefined;
  let leadMinutes = 0;
  for (const { productId, quantity } of lines) {
    const rule = rules.get(productId);
    if (!rule) continue;
    if (!rule.soldOnline) {
      reasons.push({ code: "not_sold_online", productId });
      continue;
    }
    if (rule.deliveryMaxQty !== null && quantity > rule.deliveryMaxQty) {
      reasons.push({
        code: "over_delivery_cap",
        productId,
        allowedQty: rule.deliveryMaxQty,
      });
    }
    if ((rule.leadTimeMinutes ?? 0) > leadMinutes) {
      leadMinutes = rule.leadTimeMinutes ?? 0;
      leadProductId = productId;
    }
  }

  const invalid =
    scheduledFor !== null &&
    (scheduledFor.getTime() < now.getTime() ||
      scheduledFor.getTime() >
        now.getTime() + MAX_SCHEDULE_DAYS * 24 * 60 * MINUTE_MS);
  if (invalid) {
    reasons.push({ code: "scheduled_for_invalid" });
  } else if (leadMinutes > 0) {
    const earliestAt = new Date(now.getTime() + leadMinutes * MINUTE_MS);
    if (scheduledFor === null || scheduledFor.getTime() < earliestAt.getTime()) {
      reasons.push({ code: "lead_time", productId: leadProductId, earliestAt });
    }
  }

  if (
    settings.maxDeliveryTrips !== null &&
    transport.trips > settings.maxDeliveryTrips
  ) {
    reasons.push({
      code: "over_vehicle_trips",
      maxTrips: settings.maxDeliveryTrips,
      neededTrips: transport.trips,
    });
  }
  return { ok: reasons.length === 0, reasons, estimate };
}
