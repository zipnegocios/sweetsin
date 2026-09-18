import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { AccountSettingsForm } from "@/components/account/account-settings-form";

export default async function AccountSettingsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");

  const session = await auth();

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{t("settingsTitle")}</h1>
      <AccountSettingsForm currentLocale={session!.user.preferredLocale} />
    </div>
  );
}
