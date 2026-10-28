import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { DrizzleTrailerStopRepository, DrizzleStockRepository, DrizzleProductRepository } from "@workspace/db/repositories";
import { StockRow } from "@/components/admin/stock-row";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { TrailerStopRowActions } from "@/components/admin/trailer-stop-row-actions";
import { DeleteStopButton } from "@/components/admin/delete-stop-button";
import { LocationMap } from "@/components/ui/location-map";
import { Link } from "@/i18n/navigation";
import { formatAdelaide } from "@/lib/adelaide-time";

export default async function TrailerStopDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const stop = await new DrizzleTrailerStopRepository().findById(id);
  if (!stop) notFound();

  const stock = await new DrizzleStockRepository().listByStop(id);
  const productRepo = new DrizzleProductRepository();
  const stockWithNames = await Promise.all(
    stock.map(async (s) => {
      const product = await productRepo.findById(s.productId);
      return { ...s, productName: product?.nameEn ?? s.productId };
    }),
  );

  return (
    <div>
      <Link href="/admin/trailer-stops" className="admin-link text-[13px]">
        {t("stopsBackToList")}
      </Link>
      <PageHeader title={stop.location} />
      <div className="flex items-center gap-3 mb-4">
        <StatusBadge status={stop.status} />
        <span className="text-[13px] text-navy/50">
          {formatAdelaide(stop.startTime, locale)} — {formatAdelaide(stop.endTime, locale)}
        </span>
      </div>
      <div className="flex items-center gap-4 mb-6">
        {(stop.status === "scheduled" || stop.status === "cancelled" || stop.status === "active") && (
          <Link href={`/admin/trailer-stops/${stop.id}/edit`} className="admin-link text-[12px]">
            {t("stopsEditButton")}
          </Link>
        )}
        <TrailerStopRowActions stopId={stop.id} status={stop.status} />
        <DeleteStopButton stopId={stop.id} stockCount={stock.length} />
      </div>
      <LocationMap lat={stop.lat} lng={stop.lng} label={stop.location} className="w-full h-64 rounded-xl overflow-hidden mb-6" />

      <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-2">{t("stockTitle")}</h2>
      <div className="admin-card admin-enter overflow-x-auto"><table className="admin-table">
        <thead>
          <tr>
            <th>{t("stockColumnProduct")}</th>
            <th>{t("stockColumnCurrent")}</th>
            <th>{t("stockColumnMax")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {stockWithNames.map((s) => (
            <StockRow
              key={s.id}
              stopId={stop.id}
              productId={s.productId}
              productName={s.productName}
              currentStock={s.currentStock}
              maxStock={s.maxStock}
            />
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
