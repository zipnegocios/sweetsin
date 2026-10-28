import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listAvailableProducts } from "@workspace/domain/products";
import { DrizzleProductRepository } from "@workspace/db/repositories";
import { TrailerStopForm } from "@/components/admin/trailer-stop-form";
import { PageHeader } from "@/components/admin/page-header";

export default async function NewTrailerStopPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const products = await listAvailableProducts(new DrizzleProductRepository());

  return (
    <div>
      <PageHeader title={t("stopsCreateButton")} />
      <TrailerStopForm products={products.map((p) => ({ id: p.id, nameEn: p.nameEn }))} />
    </div>
  );
}
