import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listAvailableProducts } from "@workspace/domain/products";
import { DrizzleProductRepository, DrizzleStockTemplateRepository } from "@workspace/db/repositories";
import { StockTemplateForm } from "@/components/admin/stock-template-form";
import { PageHeader } from "@/components/admin/page-header";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function EditStockTemplatePage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const template = await new DrizzleStockTemplateRepository().findById(id);
  if (!template) notFound();
  const products = await listAvailableProducts(new DrizzleProductRepository());

  return (
    <div>
      <Link href="/admin/stock-templates" className="admin-link text-[13px]">
        {t("tplBackToList")}
      </Link>
      <PageHeader title={t("tplEditTitle")} />
      <StockTemplateForm
        products={products.map((p) => ({ id: p.id, nameEn: p.nameEn }))}
        template={{ id: template.id, name: template.name, items: template.items }}
      />
    </div>
  );
}
