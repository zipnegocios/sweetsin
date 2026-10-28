import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { FulfillmentReport as Report, GroupBy, Segment } from "@workspace/domain/order-timing";
import { durationParts } from "@/lib/report-format";

const SEGMENTS: Segment[] = ["queue", "prep", "assignment", "delivery", "pickupWait", "total"];
const SEGMENT_KEY = {
  queue: "repSegmentQueue",
  prep: "repSegmentPrep",
  assignment: "repSegmentAssignment",
  delivery: "repSegmentDelivery",
  pickupWait: "repSegmentPickupWait",
  total: "repSegmentTotal",
} as const;
const GROUP_KEY = {
  none: "repGroupNone",
  day: "repGroupDay",
  type: "repGroupType",
  channel: "repGroupChannel",
  size: "repGroupSize",
  composition: "repGroupComposition",
  stop: "repGroupStop",
  staff: "repGroupStaff",
} as const;

export interface ReportFilters {
  from: string;
  to: string;
  stopId: string;
  groupBy: GroupBy;
}

export function FulfillmentReport({
  report,
  filters,
  stops,
  staffNames,
  showStaff,
}: {
  report: Report;
  filters: ReportFilters;
  stops: { id: string; label: string }[];
  staffNames: Record<string, string>;
  showStaff: boolean;
}) {
  const t = useTranslations("admin");

  const fmt = (ms: number) => {
    const { m, s } = durationParts(ms);
    return m > 0 ? t("repDurationMin", { m, s }) : t("repDurationSec", { s });
  };

  const groupLabel = (key: string): string => {
    switch (filters.groupBy) {
      case "none":
        return t("repGroupNone");
      case "type":
        return t(`repValueType_${key}` as "repValueType_pickup");
      case "channel":
        return t(`repValueChannel_${key}` as "repValueChannel_web");
      case "composition":
        return t(`repValueComposition_${key}` as "repValueComposition_mixed");
      case "stop":
        return key === "none" ? t("repValueNoStop") : (stops.find((s) => s.id === key)?.label ?? key);
      case "staff":
        return key === "system" ? t("repValueSystem") : (staffNames[key] ?? key);
      default:
        return key;
    }
  };

  const params = new URLSearchParams({ from: filters.from, to: filters.to, groupBy: filters.groupBy, format: "csv" });
  if (filters.stopId) params.set("stopId", filters.stopId);
  const inProgress = report.groups.reduce((n, g) => n + g.inProgress, 0);

  return (
    <div className="space-y-8">
      <form method="get" className="admin-card p-5 flex flex-wrap items-end gap-4">
        <label className="text-[13px] text-navy/70">
          {t("repFrom")}
          <input type="date" name="from" defaultValue={filters.from} required className="admin-input block mt-1" />
        </label>
        <label className="text-[13px] text-navy/70">
          {t("repTo")}
          <input type="date" name="to" defaultValue={filters.to} required className="admin-input block mt-1" />
        </label>
        <label className="text-[13px] text-navy/70">
          {t("repStop")}
          <select name="stopId" defaultValue={filters.stopId} className="admin-input block mt-1">
            <option value="">{t("repAllStops")}</option>
            {stops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[13px] text-navy/70">
          {t("repGroupBy")}
          <select name="groupBy" defaultValue={filters.groupBy} className="admin-input block mt-1">
            {(Object.keys(GROUP_KEY) as GroupBy[])
              .filter((g) => g !== "staff" || showStaff)
              .map((g) => (
                <option key={g} value={g}>
                  {t(GROUP_KEY[g])}
                </option>
              ))}
          </select>
        </label>
        <button type="submit" className="admin-btn">
          {t("repApply")}
        </button>
        <a href={`/api/admin/reports/fulfillment?${params.toString()}`} className="admin-link ml-auto">
          {t("repExportCsv")}
        </a>
      </form>

      {report.groups.length === 0 ? (
        <p className="text-[13px] text-navy/50">{t("repEmpty")}</p>
      ) : (
        report.groups.map((g) => (
          <section key={g.key} className="admin-card admin-enter overflow-x-auto">
            <div className="px-5 pt-4 flex flex-wrap items-baseline gap-3">
              <h2 className="font-serif font-bold text-navy text-lg">{groupLabel(g.key)}</h2>
              <span className="text-[13px] text-navy/55">{t("repGroupOrders", { count: g.orders })}</span>
            </div>
            <table className="admin-table mt-3">
              <thead>
                <tr>
                  <th>{t("repColumnSegment")}</th>
                  <th>{t("repColumnOrders")}</th>
                  <th>{t("repColumnMedian")}</th>
                  <th>{t("repColumnP90")}</th>
                </tr>
              </thead>
              <tbody>
                {SEGMENTS.map((seg) => {
                  const st = g.segments[seg];
                  return (
                    <tr key={seg}>
                      <td>{t(SEGMENT_KEY[seg])}</td>
                      {st ? (
                        <>
                          <td>{st.count}</td>
                          <td>
                            {fmt(st.medianMs)}
                            {st.smallSample && (
                              <span className="ml-2 text-[11px] uppercase text-navy/40">{t("repSmallSample")}</span>
                            )}
                          </td>
                          <td>{fmt(st.p90Ms)}</td>
                        </>
                      ) : (
                        <td colSpan={3} className="text-navy/40">
                          {t("repNoData")}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))
      )}

      {inProgress > 0 && (
        <p className="text-[13px] text-navy/70">
          <strong>{t("repInProgress")}:</strong> {t("repInProgressCount", { count: inProgress })}
        </p>
      )}

      {report.slowest.length > 0 && (
        <section className="admin-card overflow-x-auto">
          <h2 className="font-serif font-bold text-navy text-lg px-5 pt-4">{t("repSlowest")}</h2>
          <table className="admin-table mt-3">
            <thead>
              <tr>
                <th>{t("repSlowestOrder")}</th>
                <th>{t("repSegmentTotal")}</th>
              </tr>
            </thead>
            <tbody>
              {report.slowest.map((o) => (
                <tr key={o.orderId}>
                  <td>
                    <Link href={`/admin/orders/${o.orderId}`} className="admin-link">
                      {o.orderId.slice(0, 8)}
                    </Link>
                  </td>
                  <td>{fmt(o.totalMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
