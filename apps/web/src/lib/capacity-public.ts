import type { CapacityRejectionReason } from "@/app/actions/checkout";

/** Reglas por producto que el sitio público puede conocer (nada de tiempos de preparación ni lotes). */
export interface PublicCapacityRule {
  productId: string;
  soldOnline: boolean;
  deliveryMaxQty: number | null;
  leadTimeMinutes: number | null;
}

export interface PublicCapacityData {
  rules: PublicCapacityRule[];
  showEstimateToCustomer: boolean;
}

/** Máximo de días a futuro para pedir hora; igual que el servidor (domain evaluate.ts). */
export const MAX_SCHEDULE_DAYS = 60;

/** Motor apagado: sin reglas, la UI queda igual que antes. */
export const EMPTY_PUBLIC_CAPACITY: PublicCapacityData = { rules: [], showEstimateToCustomer: false };

interface Line {
  productId: string;
  quantity: number;
}

export interface DeliveryBlocker {
  code: "not_sold_online" | "over_delivery_cap";
  productId: string;
  allowedQty?: number;
}

/** Productos del carrito que bloquearían una entrega a domicilio (el servidor sigue siendo la autoridad). */
export function deliveryBlockers(data: PublicCapacityData, lines: Line[]): DeliveryBlocker[] {
  const blockers: DeliveryBlocker[] = [];
  for (const { productId, quantity } of lines) {
    const rule = data.rules.find((r) => r.productId === productId);
    if (!rule) continue;
    if (!rule.soldOnline) blockers.push({ code: "not_sold_online", productId });
    else if (rule.deliveryMaxQty !== null && quantity > rule.deliveryMaxQty) {
      blockers.push({ code: "over_delivery_cap", productId, allowedQty: rule.deliveryMaxQty });
    }
  }
  return blockers;
}

/** Mayor antelación (minutos) entre los productos del carrito; 0 = no se exige hora. */
export function requiredLeadMinutes(data: PublicCapacityData, lines: Line[]): number {
  return lines.reduce((max, { productId }) => {
    const lead = data.rules.find((r) => r.productId === productId)?.leadTimeMinutes ?? 0;
    return Math.max(max, lead);
  }, 0);
}

export function earliestScheduleAt(now: Date, leadMinutes: number): Date {
  return new Date(now.getTime() + leadMinutes * 60_000);
}

/** Razón del servidor -> clave i18n (`cart.capacity_<code>`) y sus valores. */
export function capacityReasonMessage(
  reason: CapacityRejectionReason,
  formatAt: (iso: string) => string,
): { key: `capacity_${CapacityRejectionReason["code"]}`; values: Record<string, string | number> } {
  const key = `capacity_${reason.code}` as const;
  const product = reason.productName ?? "";
  switch (reason.code) {
    case "not_sold_online":
      return { key, values: { product } };
    case "over_delivery_cap":
      return { key, values: { product, allowed: reason.allowedQty ?? 0 } };
    case "lead_time":
      return { key, values: { product, earliest: reason.earliestAt ? formatAt(reason.earliestAt) : "" } };
    case "over_vehicle_trips":
      return { key, values: { max: reason.maxTrips ?? 0, needed: reason.neededTrips ?? 0 } };
    default:
      return { key, values: {} };
  }
}

/** Antelación en minutos -> clave i18n (`cart.leadHours`/`cart.leadMinutes`) y cantidad. */
export function leadParts(minutes: number): { key: "leadHours" | "leadMinutes"; count: number } {
  return minutes >= 60 && minutes % 60 === 0
    ? { key: "leadHours", count: minutes / 60 }
    : { key: "leadMinutes", count: minutes };
}
