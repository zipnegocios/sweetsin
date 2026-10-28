import type { Locale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listStockTemplates } from "@workspace/domain/stock-templates";
import { DrizzleStockTemplateRepository } from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";
import { StockTemplateRowActions } from "@/components/admin/stock-template-row-actions";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export default async function AdminStockTemplatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ archived?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  await requireAdmin();

  const showArchived = (await searchParams).archived === "1";
  const templates = await listStockTemplates(new DrizzleStockTemplateRepository(), showArchived);

  return (
    <div>
      <PageHeader title={t("tplTitle")}>
        <Link
          href={showArchived ? "/admin/stock-templates" : "/admin/stock-templates?archived=1"}
          className="admin-link text-[13px]"
        >
          {t(showArchived ? "tplHideArchived" : "tplShowArchived")}
        </Link>
        <Link href="/admin/stock-templates/new" className="admin-btn bg-sin-red! hover:bg-sin-red-dark!">
          {t("tplCreateButton")}
        </Link>
      </PageHeader>

      {templates.length === 0 ? (
        <p className="text-[13px] text-navy/50">{t("tplEmpty")}</p>
      ) : (
        <div className="admin-card admin-enter overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("tplColumnName")}</th>
                <th>{t("tplColumnItems")}</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((tpl) => (
                <tr key={tpl.id}>
                  <td>
                    {tpl.name}
                    {tpl.archivedAt && (
                      <span className="ml-2 text-[11px] uppercase text-navy/40">{t("tplArchivedLabel")}</span>
                    )}
                  </td>
                  <td>{tpl.items.length}</td>
                  <td>
                    <Link href={`/admin/stock-templates/${tpl.id}`} className="admin-link">
                      {t("tplEditButton")}
                    </Link>
                  </td>
                  <td>
                    <StockTemplateRowActions templateId={tpl.id} archived={tpl.archivedAt !== null} />
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
