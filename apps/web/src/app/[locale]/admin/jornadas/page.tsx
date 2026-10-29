import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  DrizzleProductRepository,
  DrizzleSettingsRepository,
  DrizzleStockRepository,
  DrizzleStockTemplateRepository,
  DrizzleTrailerStopRepository,
} from "@workspace/db/repositories";
import { listAvailableProducts } from "@workspace/domain/products";
import { listStockTemplates } from "@workspace/domain/stock-templates";
import { requireAdmin } from "@/lib/require-admin";
import { formatAdelaide } from "@/lib/adelaide-time";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { JornadaOpenForm } from "@/components/admin/jornadas/jornada-open-form";

export const dynamic = "force-dynamic";

export default async function AdminJornadasPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  await requireAdmin();

  const [jornadas, settings] = await Promise.all([
    new DrizzleTrailerStopRepository().listAll("delivery"),
    new DrizzleSettingsRepository().get(),
  ]);
  const stockRepo = new DrizzleStockRepository();
  // Más recientes primero; vendido y sobrante (stock actual) sumados de todos los productos.
  const rows = await Promise.all(
    [...jornadas].reverse().map(async (j) => {
      const summary = await stockRepo.summarizeByStop(j.id);
      return {
        ...j,
        sold: summary.reduce((n, s) => n + s.sold, 0),
        remaining: summary.reduce((n, s) => n + s.currentStock, 0),
      };
    }),
  );
  const open = jornadas.find((j) => j.status === "active");
  const [products, templates] = open
    ? [[], []]
    : await Promise.all([
        listAvailableProducts(new DrizzleProductRepository()),
        listStockTemplates(new DrizzleStockTemplateRepository(), false),
      ]);

  return (
    <div>
      <PageHeader title={t("jornadasTitle")} />

      {(!settings.deliveryStockControlEnabled || settings.deliveryStockMode === "shared") && (
        <p role="status" className="mb-6 max-w-xl rounded-lg bg-gold/15 p-3 text-[13px] text-[#8A611C]">
          {t(settings.deliveryStockControlEnabled ? "jornadasSharedMode" : "jornadasControlOff")}{" "}
          <Link href="/admin/settings" className="admin-link">
            {t("navSettings")}
          </Link>
        </p>
      )}

      <div className="mb-8">
        {open ? (
          <div className="admin-card p-5 max-w-xl flex flex-wrap items-center justify-between gap-3">
            <span>
              <span className="block text-[11px] uppercase text-navy/40">{t("jornadaCurrent")}</span>
              <span className="font-serif font-bold text-navy text-lg">{open.location}</span>
            </span>
            <Link href={`/admin/jornadas/${open.id}`} className="admin-btn">
              {t("viewDetail")}
            </Link>
          </div>
        ) : (
          <JornadaOpenForm
            products={products.map((p) => ({ id: p.id, nameEn: p.nameEn }))}
            templates={templates.map((tpl) => ({ id: tpl.id, name: tpl.name, items: tpl.items }))}
          />
        )}
      </div>

      <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-2">{t("jornadasPast")}</h2>
      {rows.length === 0 ? (
        <p className="text-[13px] text-navy/60">{t("jornadasEmpty")}</p>
      ) : (
        <div className="admin-card admin-enter overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("jornadasColumnName")}</th>
                <th>{t("jornadasColumnOpened")}</th>
                <th>{t("stopsColumnStatus")}</th>
                <th>{t("stockColumnSold")}</th>
                <th>{t("stopCloseColumnRemaining")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id}>
                  <td>{j.location}</td>
                  <td>{formatAdelaide(j.startTime, locale)}</td>
                  <td>
                    <StatusBadge status={j.status} />
                  </td>
                  <td>{j.sold}</td>
                  <td>{j.remaining}</td>
                  <td>
                    <Link href={`/admin/jornadas/${j.id}`} className="admin-link">
                      {t("viewDetail")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
