import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSettingsAction } from "@/app/actions/admin-settings";
import { requireAdmin } from "@/lib/require-admin";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  await requireAdmin();

  const result = await getSettingsAction();

  return (
    <div>
      <PageHeader title={t("cfgTitle")} />
      {result.ok ? (
        <SettingsForm initial={result.settings} />
      ) : (
        <p role="alert" className="text-[13px] text-sin-red">
          {t("cfgErrorGeneric")}
        </p>
      )}
    </div>
  );
}
