"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { updateSettingsAction } from "@/app/actions/admin-settings";
import type { AppSettings } from "@workspace/domain/settings";

type Switch = Exclude<keyof AppSettings, "deliveryFeeCents">;

const OPERATION = [
  { key: "requireStockConfirmationOnOpen", label: "cfgRequireStockConfirmation", help: "cfgRequireStockConfirmationHelp" },
  { key: "allowMultipleActiveStops", label: "cfgAllowMultipleActive", help: "cfgAllowMultipleActiveHelp" },
  { key: "liveStockEnabled", label: "cfgLiveStock", help: "cfgLiveStockHelp" },
  { key: "autoSoldOutEnabled", label: "cfgAutoSoldOut", help: "cfgAutoSoldOutHelp" },
  { key: "timingEnabled", label: "cfgTiming", help: "cfgTimingHelp" },
  { key: "showPerStaffBreakdown", label: "cfgPerStaff", help: "cfgPerStaffHelp" },
] as const satisfies readonly { key: Switch; label: string; help: string }[];

function Toggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 py-2">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium text-navy">{label}</span>
        <span className="block text-[13px] text-navy/55">{help}</span>
      </span>
    </label>
  );
}

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [values, setValues] = useState<AppSettings>(initial);
  const [fee, setFee] = useState((initial.deliveryFeeCents / 100).toFixed(2));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<"saved" | "invalid" | "generic" | null>(null);

  const set = <K extends keyof AppSettings>(key: K, v: AppSettings[K]) => setValues((p) => ({ ...p, [key]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setFeedback(null);
    if (!/^\d+(\.\d{1,2})?$/.test(fee.trim())) {
      setFeedback("invalid");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await updateSettingsAction({ ...values, deliveryFeeCents: Math.round(Number(fee) * 100) });
      if (!result.ok) {
        setFeedback(result.error === "generic" ? "generic" : "invalid");
        return;
      }
      setValues(result.settings);
      setFee((result.settings.deliveryFeeCents / 100).toFixed(2));
      setFeedback("saved");
      router.refresh();
    } catch {
      setFeedback("generic");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      <section className="admin-card p-5">
        <h2 className="font-serif font-bold text-navy text-lg mb-2">{t("cfgOperationSection")}</h2>
        {OPERATION.map((o) => (
          <Toggle
            key={o.key}
            label={t(o.label)}
            help={t(o.help)}
            checked={values[o.key]}
            onChange={(v) => set(o.key, v)}
          />
        ))}
      </section>

      <section className="admin-card p-5">
        <h2 className="font-serif font-bold text-navy text-lg mb-2">{t("cfgGeneralSection")}</h2>
        <label className="block py-2">
          <span className="block text-sm font-medium text-navy">{t("cfgDeliveryFee")}</span>
          <span className="block text-[13px] text-navy/55 mb-1">{t("cfgDeliveryFeeHelp")}</span>
          <input
            type="text"
            inputMode="decimal"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="admin-input w-32"
          />
        </label>
        <Toggle
          label={t("cfgEvidenceRequired")}
          help={t("cfgEvidenceRequiredHelp")}
          checked={values.deliveryEvidenceRequired}
          onChange={(v) => set("deliveryEvidenceRequired", v)}
        />
      </section>

      {feedback === "saved" && (
        <p role="status" className="text-[13px] text-navy/70">
          {t("cfgSaved")}
        </p>
      )}
      {(feedback === "invalid" || feedback === "generic") && (
        <p role="alert" className="text-[13px] text-sin-red">
          {t(feedback === "invalid" ? "cfgErrorInvalid" : "cfgErrorGeneric")}
        </p>
      )}

      <button type="submit" disabled={isSubmitting} className="admin-btn">
        {t("cfgSave")}
      </button>
    </form>
  );
}
