import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { FulfillmentReport as Report } from "@workspace/domain/order-timing";
import { DrizzleSettingsRepository } from "@workspace/db/repositories";
import { listTrailerStopsAction } from "@/app/actions/admin-trailer-stops";
import { listStaffAction } from "@/app/actions/admin-staff";
import { requireAdmin } from "@/lib/require-admin";
import { loadFulfillmentReport, parseReportQuery } from "@/lib/fulfillment-report";
import { defaultReportRange } from "@/lib/report-format";
import { formatAdelaide } from "@/lib/adelaide-time";
import { FulfillmentReport } from "@/components/admin/fulfillment-report";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export default async function AdminFulfillmentReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  await requireAdmin();

  const sp = await searchParams;
  const range = defaultReportRange();
  const raw = new URLSearchParams();
  raw.set("from", sp.from || range.from);
  raw.set("to", sp.to || range.to);
  raw.set("groupBy", sp.groupBy || "none");
  if (sp.stopId) raw.set("stopId", sp.stopId);

  const { showPerStaffBreakdown } = await new DrizzleSettingsRepository().get();
  // Con el desglose por persona apagado, `staff` no se ofrece ni se acepta.
  if (!showPerStaffBreakdown && raw.get("groupBy") === "staff") raw.set("groupBy", "none");

  const query = parseReportQuery(raw);
  let report: Report | null = null;
  let failed = false;
  if (query) {
    try {
      report = await loadFulfillmentReport(query);
    } catch {
      failed = true;
    }
  }

  const stops = (await listTrailerStopsAction()).map((s) => ({
    id: s.id,
    label: `${s.location} · ${formatAdelaide(s.startTime, locale)}`,
  }));
  const staffNames =
    query?.groupBy === "staff" ? Object.fromEntries((await listStaffAction()).map((u) => [u.id, u.name])) : {};

  return (
    <div>
      <PageHeader title={t("repTitle")} />
      {report && query ? (
        <FulfillmentReport
          report={report}
          filters={{
            from: raw.get("from")!,
            to: raw.get("to")!,
            stopId: raw.get("stopId") ?? "",
            groupBy: query.groupBy,
          }}
          stops={stops}
          staffNames={staffNames}
          showStaff={showPerStaffBreakdown}
        />
      ) : (
        <p role="alert" className="text-[13px] text-sin-red">
          {t(failed ? "repLoadError" : "repInvalidQuery")}
        </p>
      )}
    </div>
  );
}
