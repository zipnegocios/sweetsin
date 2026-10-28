import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listAvailableProducts } from "@workspace/domain/products";
import { DrizzleProductRepository } from "@workspace/db/repositories";
import { StockTemplateForm } from "@/components/admin/stock-template-form";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export default async function NewStockTemplatePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const products = await listAvailableProducts(new DrizzleProductRepository());

  return (
    <div>
      <PageHeader title={t("tplCreateButton")} />
      <StockTemplateForm products={products.map((p) => ({ id: p.id, nameEn: p.nameEn }))} />
    </div>
  );
}
