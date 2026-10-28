import type { Locale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listTrailerStopsAction } from "@/app/actions/admin-trailer-stops";
import { TrailerStopRowActions } from "@/components/admin/trailer-stop-row-actions";
import { StatusBadge, PastClosingBadge } from "@/components/admin/status-badge";
import { formatAdelaide } from "@/lib/adelaide-time";
import { PageHeader } from "@/components/admin/page-header";

export default async function AdminTrailerStopsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const stops = await listTrailerStopsAction();

  return (
    <div>
      <PageHeader title={t("stopsTitle")}>
        <Link href="/admin/trailer-stops/new" className="admin-btn bg-sin-red! hover:bg-sin-red-dark!">
          {t("stopsCreateButton")}
        </Link>
      </PageHeader>

      <div className="admin-card admin-enter overflow-x-auto"><table className="admin-table">
        <thead>
          <tr>
            <th>{t("stopsColumnLocation")}</th>
            <th>{t("stopsColumnDate")}</th>
            <th>{t("stopsColumnStatus")}</th>
            <th></th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {stops.map((stop) => (
            <tr key={stop.id} >
              <td>{stop.location}</td>
              <td>{formatAdelaide(stop.startTime, locale)}</td>
              <td>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge status={stop.status} />
                  <PastClosingBadge status={stop.status} endTime={stop.endTime} />
                </div>
              </td>
              <td>
                <Link href={`/admin/trailer-stops/${stop.id}`} className="admin-link">
                  {t("viewDetail")}
                </Link>
              </td>
              <td>
                {(stop.status === "scheduled" || stop.status === "cancelled" || stop.status === "active") && (
                  <Link href={`/admin/trailer-stops/${stop.id}/edit`} className="admin-link">
                    {t("stopsEditButton")}
                  </Link>
                )}
              </td>
              <td>
                <TrailerStopRowActions stopId={stop.id} status={stop.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
