import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { DrizzleProductRepository, DrizzleSettingsRepository, DrizzleStockRepository } from "@workspace/db/repositories";
import { listAvailableProducts } from "@workspace/domain/products";
import { requireAdmin } from "@/lib/require-admin";
import { findJornada } from "@/lib/jornadas";
import { formatAdelaide } from "@/lib/adelaide-time";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { StopCloseDialog } from "@/components/admin/stop-close-dialog";
import { StopLiveStock } from "@/components/admin/stop-live-stock";
import { StopStockEditor } from "@/components/admin/stop-stock-editor";

export const dynamic = "force-dynamic";

export default async function JornadaDetailPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  await requireAdmin();

  const jornada = await findJornada(id);
  if (!jornada) notFound();

  const stockRepo = new DrizzleStockRepository();
  const productRepo = new DrizzleProductRepository();
  const [settings, stock, summary] = await Promise.all([
    new DrizzleSettingsRepository().get(),
    stockRepo.listByStop(id),
    stockRepo.summarizeByStop(id),
  ]);
  const rows = await Promise.all(
    stock.map(async (s) => {
      const [product, soldUnits] = await Promise.all([productRepo.findById(s.productId), stockRepo.sumSold(s.id)]);
      return { ...s, productName: product?.nameEn ?? s.productId, soldUnits };
    }),
  );
  const productNames = Object.fromEntries(rows.map((r) => [r.productId, r.productName]));
  const isOpen = jornada.status === "active";
  const inJornada = new Set(stock.map((s) => s.productId));
  const availableProducts = isOpen
    ? (await listAvailableProducts(productRepo)).filter((p) => !inJornada.has(p.id)).map((p) => ({ id: p.id, nameEn: p.nameEn }))
    : [];

  return (
    <div>
      <Link href="/admin/jornadas" className="admin-link text-[13px]">
        {t("jornadaBackToList")}
      </Link>
      <PageHeader title={jornada.location} />
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <StatusBadge status={jornada.status} />
        <span className="text-[13px] text-navy/50">{formatAdelaide(jornada.startTime, locale)}</span>
        {isOpen && <StopCloseDialog stopId={jornada.id} productNames={productNames} jornada />}
      </div>

      <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-2">{t("jornadaStockTitle")}</h2>
      {summary.length === 0 ? (
        <p className="text-[13px] text-navy/60 mb-6">{t("jornadaNoStock")}</p>
      ) : (
        <div className="admin-card admin-enter overflow-x-auto mb-6">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("stockColumnProduct")}</th>
                <th>{t("stockColumnMax")}</th>
                <th>{t("stockColumnSold")}</th>
                <th>{t("stopCloseColumnWaste")}</th>
                {/* Cerrada, lo que queda es sobrante (solo informativo). */}
                <th>{t(isOpen ? "jornadaColumnAvailable" : "stopCloseColumnRemaining")}</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.productId}>
                  <td>{productNames[s.productId] ?? s.productId}</td>
                  <td>{s.maxStock}</td>
                  <td>{s.sold}</td>
                  <td>{s.wasted}</td>
                  <td>
                    {s.currentStock}
                    {s.soldOut && <span className="ml-2 text-[12px] font-medium text-sin-red">{t("stopCloseSoldOut")}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isOpen && settings.liveStockEnabled && rows.length > 0 && (
        <section className="mb-6">
          <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-2">{t("liveStockTitle")}</h2>
          <StopLiveStock stopId={jornada.id} rows={rows} />
        </section>
      )}

      {isOpen && (
        <>
          <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-2">{t("stockTitle")}</h2>
          <StopStockEditor stopId={jornada.id} rows={rows} availableProducts={availableProducts} readOnly={false} />
        </>
      )}
    </div>
  );
}
