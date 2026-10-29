import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { DrizzleCapacityRepository, DrizzleProductRepository } from "@workspace/db/repositories";
import { listAvailableProducts } from "@workspace/domain/products";
import { requireAdmin } from "@/lib/require-admin";
import { loadCalibration } from "@/lib/capacity-calibration";
import { formatAdelaide } from "@/lib/adelaide-time";
import { PageHeader } from "@/components/admin/page-header";
import { CapacitySettingsForm } from "@/components/admin/capacity/capacity-settings-form";
import { ProductRulesTable, type ProductRuleRow } from "@/components/admin/capacity/product-rules-table";
import { CapacitySimulator } from "@/components/admin/capacity/capacity-simulator";

export const dynamic = "force-dynamic";

export default async function AdminCapacityPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  await requireAdmin();

  try {
    const repo = new DrizzleCapacityRepository();
    const [settings, modifiedAt, rules, steps, products, calibration] = await Promise.all([
      repo.getSettings(),
      repo.lastModifiedAt(),
      repo.listRules(),
      repo.listSteps(),
      listAvailableProducts(new DrizzleProductRepository()),
      loadCalibration(new Date(), repo),
    ]);
    const nameOf = (p: { nameEn: string; nameEs: string }) => (locale === "es" ? p.nameEs : p.nameEn);
    const rows: ProductRuleRow[] = products.map((p) => ({
      productId: p.id,
      name: nameOf(p),
      rule: rules.find((r) => r.productId === p.id) ?? {
        productId: p.id,
        soldOnline: true,
        deliveryMaxQty: null,
        leadTimeMinutes: null,
        batchUnits: null,
        batchSeconds: null,
      },
      steps: steps
        .filter((s) => s.productId === p.id)
        .sort((a, b) => a.position - b.position)
        .map(({ name, seconds, mode }) => ({ name, seconds, mode })),
      calibration: calibration.find((c) => c.productId === p.id) ?? null,
    }));

    return (
      <div className="space-y-6">
        <PageHeader title={t("capTitle")} />
        <p className="text-[13px] text-navy/55">{t("capIntro")}</p>
        <p className="text-[13px] text-navy/70">
          {modifiedAt ? t("capLastModified", { at: formatAdelaide(modifiedAt, locale) }) : t("capNeverModified")}
        </p>
        <CapacitySettingsForm initial={settings} />
        <ProductRulesTable rows={rows} />
        <CapacitySimulator products={rows.map((r) => ({ id: r.productId, name: r.name }))} />
      </div>
    );
  } catch {
    return (
      <div>
        <PageHeader title={t("capTitle")} />
        <p role="alert" className="text-[13px] text-sin-red">
          {t("capErrorGeneric")}
        </p>
      </div>
    );
  }
}
