"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { updatePreferredLocaleAction } from "@/app/actions/account-settings";

export function AccountSettingsForm({ currentLocale }: { currentLocale: "en" | "es" }) {
  const t = useTranslations("account");
  const router = useRouter();
  const [locale, setLocale] = useState(currentLocale);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    setSaved(false);
    setError(false);
    try {
      const result = await updatePreferredLocaleAction(locale);
      if ("ok" in result) {
        setSaved(true);
        router.refresh();
      } else {
        setError(true);
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-navy/10 max-w-sm">
      <p className="text-sm font-medium text-navy mb-3">{t("settingsLanguageLabel")}</p>
      <div className="space-y-2 mb-4">
        <label className="flex items-center gap-2 text-sm text-navy">
          <input type="radio" name="locale" value="en" checked={locale === "en"} onChange={() => setLocale("en")} />
          {t("settingsLanguageEn")}
        </label>
        <label className="flex items-center gap-2 text-sm text-navy">
          <input type="radio" name="locale" value="es" checked={locale === "es"} onChange={() => setLocale("es")} />
          {t("settingsLanguageEs")}
        </label>
      </div>
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="bg-sin-red text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
      >
        {t("settingsSaveButton")}
      </button>
      {saved && <p className="text-[13px] text-navy/50 mt-2">{t("settingsSaved")}</p>}
      {error && <p className="text-[13px] text-sin-red mt-2">{t("settingsError")}</p>}
    </div>
  );
}
