import type { TimingOrderRow } from "./ports";

export type Segment = "queue" | "prep" | "assignment" | "delivery" | "pickupWait" | "total";

export interface SegmentDetail {
  ms: number;
  /** Quien movió el pedido al estado que cierra el tramo (`null` si fue el sistema). */
  closedBy: string | null;
}

const DEFS: { segment: Segment; from: string; to: string; only?: TimingOrderRow["fulfillmentType"] }[] = [
  { segment: "queue", from: "received", to: "in_prep" },
  { segment: "prep", from: "in_prep", to: "ready_for_pickup" },
  { segment: "assignment", from: "ready_for_pickup", to: "out_for_delivery", only: "self_delivery" },
  { segment: "delivery", from: "out_for_delivery", to: "delivered", only: "self_delivery" },
  { segment: "pickupWait", from: "ready_for_pickup", to: "delivered", only: "pickup" },
  { segment: "total", from: "received", to: "delivered" },
];

/** Duración (y quien cerró) de cada tramo disponible; vacío si el pedido está cancelado. */
export function segmentDetails(row: TimingOrderRow): Partial<Record<Segment, SegmentDetail>> {
  if (row.cancelled) return {};
  const first = (status: string) =>
    row.events.find((e) => e.kind === "fulfillment" && e.toStatus === status);
  const out: Partial<Record<Segment, SegmentDetail>> = {};
  for (const d of DEFS) {
    if (d.only && d.only !== row.fulfillmentType) continue;
    const a = first(d.from);
    const b = first(d.to);
    if (!a || !b) continue;
    const ms = b.occurredAt.getTime() - a.occurredAt.getTime();
    if (ms < 0) continue;
    out[d.segment] = { ms, closedBy: b.actorUserId };
  }
  return out;
}

export function segmentDurations(row: TimingOrderRow): Partial<Record<Segment, number>> {
  const out: Partial<Record<Segment, number>> = {};
  for (const [k, v] of Object.entries(segmentDetails(row)) as [Segment, SegmentDetail][]) out[k] = v.ms;
  return out;
}
