import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listAvailableProducts } from "@workspace/domain/products";
import { listStockTemplates } from "@workspace/domain/stock-templates";
import { DrizzleProductRepository, DrizzleStockTemplateRepository } from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";
import { TrailerStopForm } from "@/components/admin/trailer-stop-form";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export default async function NewTrailerStopPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  await requireAdmin();

  const products = await listAvailableProducts(new DrizzleProductRepository());
  const templates = await listStockTemplates(new DrizzleStockTemplateRepository(), false);

  return (
    <div>
      <PageHeader title={t("stopsCreateButton")} />
      <TrailerStopForm
        products={products.map((p) => ({ id: p.id, nameEn: p.nameEn }))}
        templates={templates.map((tpl) => ({ id: tpl.id, name: tpl.name, items: tpl.items }))}
      />
    </div>
  );
}
