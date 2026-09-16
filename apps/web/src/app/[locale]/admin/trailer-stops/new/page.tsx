import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listAvailableProducts } from "@workspace/domain/products";
import { DrizzleProductRepository } from "@workspace/db/repositories";
import { TrailerStopForm } from "@/components/admin/trailer-stop-form";

export default async function NewTrailerStopPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const products = await listAvailableProducts(new DrizzleProductRepository());

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{t("stopsCreateButton")}</h1>
      <TrailerStopForm products={products.map((p) => ({ id: p.id, nameEn: p.nameEn }))} />
    </div>
  );
}
