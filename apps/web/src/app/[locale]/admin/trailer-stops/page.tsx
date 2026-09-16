import type { Locale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listTrailerStopsAction } from "@/app/actions/admin-trailer-stops";
import { TrailerStopRowActions } from "@/components/admin/trailer-stop-row-actions";

export default async function AdminTrailerStopsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const stops = await listTrailerStopsAction();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif font-bold text-navy text-2xl">{t("stopsTitle")}</h1>
        <Link href="/admin/trailer-stops/new" className="bg-sin-red text-white rounded-lg px-4 py-2 text-sm">
          {t("stopsCreateButton")}
        </Link>
      </div>

      <table className="w-full text-sm bg-white rounded-xl overflow-hidden">
        <thead className="bg-navy/5 text-left">
          <tr>
            <th className="px-4 py-3">{t("stopsColumnLocation")}</th>
            <th className="px-4 py-3">{t("stopsColumnDate")}</th>
            <th className="px-4 py-3">{t("stopsColumnStatus")}</th>
            <th className="px-4 py-3"></th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {stops.map((stop) => (
            <tr key={stop.id} className="border-t border-navy/5">
              <td className="px-4 py-3">{stop.location}</td>
              <td className="px-4 py-3">{stop.startTime.toLocaleDateString()}</td>
              <td className="px-4 py-3">{stop.status}</td>
              <td className="px-4 py-3">
                <Link href={`/admin/trailer-stops/${stop.id}`} className="text-sin-red hover:underline">
                  {t("viewDetail")}
                </Link>
              </td>
              <td className="px-4 py-3">
                <TrailerStopRowActions stopId={stop.id} status={stop.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
