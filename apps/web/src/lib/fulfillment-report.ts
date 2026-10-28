import { z } from "zod/v4";
import { buildFulfillmentReport, type FulfillmentReport, type GroupBy } from "@workspace/domain/order-timing";
import { DrizzleOrderTimingRepository, DrizzleSettingsRepository } from "@workspace/db/repositories";
import { adelaideDayKey, adelaideDayRange } from "./adelaide-time";
import { PER_STAFF_DISABLED } from "./settings-errors";

const MIN_SAMPLE = 5;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const GROUP_BY = ["none", "day", "type", "channel", "size", "composition", "stop", "staff"] as const satisfies readonly GroupBy[];

const isoDate = z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date");

const querySchema = z.object({
  from: isoDate,
  to: isoDate,
  stopId: z.string().uuid().optional(),
  groupBy: z.enum(GROUP_BY).default("none"),
  format: z.enum(["json", "csv"]).default("json"),
});

export interface ReportQuery {
  from: Date;
  to: Date;
  stopId?: string;
  groupBy: GroupBy;
  format: "json" | "csv";
}

// Una fecha sola ("YYYY-MM-DD") es un día completo de Adelaida: `from` toma su inicio y `to` su final.
export function parseReportQuery(params: URLSearchParams): ReportQuery | null {
  const parsed = querySchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) return null;
  const { from, to, ...rest } = parsed.data;
  const fromDate = DAY.test(from) ? adelaideDayRange(from).start : new Date(from);
  const toDate = DAY.test(to) ? adelaideDayRange(to).end : new Date(to);
  if (fromDate > toDate) return null;
  return { from: fromDate, to: toDate, ...rest };
}

export async function loadFulfillmentReport(query: ReportQuery): Promise<FulfillmentReport> {
  if (query.groupBy === "staff") {
    const { showPerStaffBreakdown } = await new DrizzleSettingsRepository().get();
    if (!showPerStaffBreakdown) throw new Error(PER_STAFF_DISABLED);
  }
  const rows = await new DrizzleOrderTimingRepository().listForReport({
    from: query.from,
    to: query.to,
    stopId: query.stopId,
  });
  return buildFulfillmentReport(rows, { groupBy: query.groupBy, dayKey: adelaideDayKey, minSample: MIN_SAMPLE });
}
