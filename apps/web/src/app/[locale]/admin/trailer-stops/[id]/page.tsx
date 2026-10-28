import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  DrizzleTrailerStopRepository,
  DrizzleStockRepository,
  DrizzleProductRepository,
  DrizzleSettingsRepository,
} from "@workspace/db/repositories";
import { listAvailableProducts } from "@workspace/domain/products";
import { requireAdmin } from "@/lib/require-admin";
import { StopStockEditor } from "@/components/admin/stop-stock-editor";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge, PastClosingBadge } from "@/components/admin/status-badge";
import { StopOpenDialog } from "@/components/admin/stop-open-dialog";
import { StopCloseDialog } from "@/components/admin/stop-close-dialog";
import { StopLiveStock } from "@/components/admin/stop-live-stock";
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
  await requireAdmin();

  const stop = await new DrizzleTrailerStopRepository().findById(id);
  if (!stop) notFound();

  const settings = await new DrizzleSettingsRepository().get();
  const stockRepo = new DrizzleStockRepository();
  const stock = await stockRepo.listByStop(id);
  const productRepo = new DrizzleProductRepository();
  const stockWithNames = await Promise.all(
    stock.map(async (s) => {
      const [product, soldUnits] = await Promise.all([productRepo.findById(s.productId), stockRepo.sumSold(s.id)]);
      return { ...s, productName: product?.nameEn ?? s.productId, soldUnits };
    }),
  );
  const inStop = new Set(stock.map((s) => s.productId));
  const availableProducts = (await listAvailableProducts(productRepo))
    .filter((p) => !inStop.has(p.id))
    .map((p) => ({ id: p.id, nameEn: p.nameEn }));
  const productNames = Object.fromEntries(stockWithNames.map((s) => [s.productId, s.productName]));

  return (
    <div>
      <Link href="/admin/trailer-stops" className="admin-link text-[13px]">
        {t("stopsBackToList")}
      </Link>
      <PageHeader title={stop.location} />
      <div className="flex items-center gap-3 mb-4">
        <StatusBadge status={stop.status} />
        <PastClosingBadge status={stop.status} endTime={stop.endTime} />
        <span className="text-[13px] text-navy/50">
          {formatAdelaide(stop.startTime, locale)} — {formatAdelaide(stop.endTime, locale)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {stop.status === "scheduled" && (
          <StopOpenDialog
            stopId={stop.id}
            requireConfirmation={settings.requireStockConfirmationOnOpen}
            rows={stockWithNames}
            availableProducts={availableProducts}
          />
        )}
        {stop.status === "active" && <StopCloseDialog stopId={stop.id} productNames={productNames} />}
        {(stop.status === "scheduled" || stop.status === "cancelled" || stop.status === "active") && (
          <Link href={`/admin/trailer-stops/${stop.id}/edit`} className="admin-link text-[12px]">
            {t("stopsEditButton")}
          </Link>
        )}
        <TrailerStopRowActions stopId={stop.id} status={stop.status} />
        <DeleteStopButton stopId={stop.id} stockCount={stock.length} />
      </div>
      <LocationMap lat={stop.lat} lng={stop.lng} label={stop.location} className="w-full h-64 rounded-xl overflow-hidden mb-6" />

      {stop.status === "active" && settings.liveStockEnabled && (
        <section className="mb-6">
          <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-2">{t("liveStockTitle")}</h2>
          <StopLiveStock stopId={stop.id} rows={stockWithNames} />
        </section>
      )}

      <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-2">{t("stockTitle")}</h2>
      <StopStockEditor
        stopId={stop.id}
        rows={stockWithNames}
        availableProducts={availableProducts}
        readOnly={stop.status === "completed"}
      />
    </div>
  );
}
