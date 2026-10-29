import type { TimingOrderRow } from "./ports";
import { segmentDetails, type Segment } from "./segments";

export type GroupBy = "none" | "day" | "type" | "channel" | "size" | "composition" | "stop" | "staff";

export interface SegmentStats {
  count: number;
  medianMs: number;
  p90Ms: number;
  smallSample: boolean;
}

export interface ReportGroup {
  key: string;
  orders: number;
  inProgress: number;
  segments: Partial<Record<Segment, SegmentStats>>;
}

export interface FulfillmentReport {
  groups: ReportGroup[];
  slowest: { orderId: string; totalMs: number }[];
}

const SEGMENT_ORDER: Segment[] = ["queue", "prep", "assignment", "delivery", "pickupWait", "total"];

/** Nearest-rank; `null` si no hay valores. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1]!;
}

export function classifyComposition(coffeeUnits: number, sweetUnits: number): "coffee" | "sweets" | "mixed" {
  if (coffeeUnits > 0 && sweetUnits === 0) return "coffee";
  if (sweetUnits > 0 && coffeeUnits === 0) return "sweets";
  return "mixed";
}

const SIZE_ORDER = ["1-5", "6-20", "21-50", "51+"];

export function sizeBucket(units: number): "1-5" | "6-20" | "21-50" | "51+" {
  if (units <= 5) return "1-5";
  if (units <= 20) return "6-20";
  if (units <= 50) return "21-50";
  return "51+";
}

export function buildFulfillmentReport(
  rows: TimingOrderRow[],
  options: { groupBy: GroupBy; dayKey: (d: Date) => string; minSample: number },
): FulfillmentReport {
  const { groupBy, dayKey, minSample } = options;
  const samples = new Map<string, Map<Segment, number[]>>();
  const orderIds = new Map<string, Set<string>>();
  const progress = new Map<string, number>();
  const totals: { orderId: string; totalMs: number }[] = [];

  const touch = (key: string, orderId: string) => {
    if (!samples.has(key)) {
      samples.set(key, new Map());
      orderIds.set(key, new Set());
      progress.set(key, 0);
    }
    orderIds.get(key)!.add(orderId);
  };
  const add = (key: string, segment: Segment, ms: number) => {
    const m = samples.get(key)!;
    if (!m.has(segment)) m.set(segment, []);
    m.get(segment)!.push(ms);
  };

  for (const row of rows) {
    if (row.cancelled) continue;
    const details = segmentDetails(row);
    if (details.total) totals.push({ orderId: row.orderId, totalMs: details.total.ms });

    if (groupBy === "staff") {
      for (const seg of SEGMENT_ORDER) {
        const d = details[seg];
        if (!d) continue;
        const key = d.closedBy ?? "system";
        touch(key, row.orderId);
        add(key, seg, d.ms);
      }
      if (!details.total) {
        // En curso: se atribuye a quien hizo la última transición.
        const last = [...row.events].reverse().find((e) => e.kind === "fulfillment");
        const key = last?.actorUserId ?? "system";
        touch(key, row.orderId);
        progress.set(key, progress.get(key)! + 1);
      }
      continue;
    }

    const key =
      groupBy === "none" ? "all"
      : groupBy === "day" ? dayKey(row.createdAt)
      : groupBy === "type" ? row.fulfillmentType
      : groupBy === "channel" ? row.channel
      : groupBy === "size" ? sizeBucket(row.units)
      : groupBy === "composition" ? classifyComposition(row.coffeeUnits, row.sweetUnits)
      : (row.stopId ?? "none");
    touch(key, row.orderId);
    if (!details.total) progress.set(key, progress.get(key)! + 1);
    for (const seg of SEGMENT_ORDER) {
      const d = details[seg];
      if (d) add(key, seg, d.ms);
    }
  }

  const groups: ReportGroup[] = [...samples.keys()]
    .sort((a, b) => (groupBy === "size" ? SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b) : a < b ? -1 : a > b ? 1 : 0))
    .map((key) => {
    const segments: ReportGroup["segments"] = {};
    for (const seg of SEGMENT_ORDER) {
      const v = samples.get(key)!.get(seg);
      if (!v || v.length === 0) continue;
      segments[seg] = {
        count: v.length,
        medianMs: percentile(v, 50)!,
        p90Ms: percentile(v, 90)!,
        smallSample: v.length < minSample,
      };
    }
    return { key, orders: orderIds.get(key)!.size, inProgress: progress.get(key)!, segments };
  });

  const slowest = totals.sort((a, b) => b.totalMs - a.totalMs).slice(0, 10);
  return { groups, slowest };
}

export function reportToCsv(report: FulfillmentReport): string {
  const lines = ["group,segment,count,median_seconds,p90_seconds,small_sample"];
  const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  for (const g of report.groups) {
    for (const seg of SEGMENT_ORDER) {
      const s = g.segments[seg];
      if (!s) continue;
      lines.push(
        [cell(g.key), seg, s.count, (s.medianMs / 1000).toFixed(1), (s.p90Ms / 1000).toFixed(1), s.smallSample].join(","),
      );
    }
  }
  return lines.join("\n");
}
