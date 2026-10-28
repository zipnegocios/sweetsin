import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { DrizzleTrailerStopRepository, DrizzleStockRepository, DrizzleProductRepository } from "@workspace/db/repositories";
import { StockRow } from "@/components/admin/stock-row";
import { PageHeader } from "@/components/admin/page-header";

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
      <PageHeader title={stop.location} />
      <p className="text-[13px] text-navy/50 mb-6">
        {stop.startTime.toLocaleString()} — {stop.endTime.toLocaleString()} · {stop.status}
      </p>

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
