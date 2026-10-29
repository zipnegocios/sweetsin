import type { CapacityReason, CapacityReasonCode } from "@workspace/domain/capacity";
import type { CalibrationRow } from "./capacity-calibration";

/** Segundos -> minutos y segundos enteros (redondeo al segundo), para `repDurationMin`/`repDurationSec`. */
export function secondsParts(total: number): { m: number; s: number } {
  const t = Math.round(total);
  return { m: Math.floor(t / 60), s: t % 60 };
}

/** Razón del motor -> clave i18n (`admin.capReason_<code>`) y sus valores. */
export function reasonMessage(
  reason: CapacityReason,
  ctx: { productName: (id: string) => string; formatAt: (d: Date) => string },
): { key: `capReason_${CapacityReasonCode}`; values: Record<string, string | number> } {
  const key = `capReason_${reason.code}` as const;
  const product = reason.productId ? ctx.productName(reason.productId) : "";
  switch (reason.code) {
    case "not_sold_online":
      return { key, values: { product } };
    case "over_delivery_cap":
      return { key, values: { product, allowed: reason.allowedQty ?? 0 } };
    case "lead_time":
      return { key, values: { product, earliest: reason.earliestAt ? ctx.formatAt(reason.earliestAt) : "" } };
    case "over_vehicle_trips":
      return { key, values: { max: reason.maxTrips ?? 0, needed: reason.neededTrips ?? 0 } };
    default:
      return { key, values: {} };
  }
}

/** Campo numérico opcional: vacío = null (sin límite); entero positivo = número; cualquier otra cosa = undefined (inválido). */
export function parseOptionalInt(raw: string): number | null | undefined {
  const v = raw.trim();
  if (v === "") return null;
  if (!/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return n > 0 ? n : undefined;
}

export function calibrationState(row: CalibrationRow): "noData" | "small" | "ok" {
  if (row.measuredMedianSeconds === null) return "noData";
  return row.smallSample ? "small" : "ok";
}
