"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { StaffRole } from "@workspace/domain/users";
import type { Locale } from "@workspace/domain/shared";
import { resetStaffPinAction, setStaffPinAction, toggleStaffActiveAction, updateStaffProfileAction } from "@/app/actions/admin-staff";

export interface StaffEditValues {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  internalNotes: string;
  preferredLocale: Locale;
  isActive: boolean;
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-navy/50">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[12px] text-navy/40">{hint}</span>}
  </label>
);

const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties;

export function StaffEditForm({ initial }: { initial: StaffEditValues }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error" | "emailTaken">("idle");
  const [pin, setPin] = useState<string | null>(null);
  const [manualPin, setManualPin] = useState("");
  const [pinStatus, setPinStatus] = useState<"idle" | "saved" | "invalid">("idle");

  const set = <K extends keyof StaffEditValues>(key: K, value: StaffEditValues[K]) => {
    setV((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus("idle");
    try {
      const result = await updateStaffProfileAction(v.id, {
        name: v.name,
        email: v.email,
        role: v.role,
        phone: v.phone,
        emergencyContactName: v.emergencyContactName,
        emergencyContactPhone: v.emergencyContactPhone,
        internalNotes: v.internalNotes,
        preferredLocale: v.preferredLocale,
        password,
      });
      if (!result.ok) {
        setStatus(result.message.includes("already exists") ? "emailTaken" : "error");
        return;
      }
      setPassword("");
      setStatus("saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    const next = !v.isActive;
    set("isActive", next);
    await toggleStaffActiveAction(v.id, next);
    router.refresh();
  }

  async function handleResetPin() {
    setPinStatus("idle");
    setPin((await resetStaffPinAction(v.id)).plainPin);
  }

  async function handleSetPin() {
    setPin(null);
    const result = await setStaffPinAction(v.id, manualPin);
    setPinStatus(result.ok ? "saved" : "invalid");
    if (result.ok) setManualPin("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="admin-card admin-enter p-6" style={stagger(1)}>
        <h2 className="mb-5 font-serif text-lg font-bold text-navy">{t("staffSectionProfile")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("staffFormName")}>
            <input required value={v.name} onChange={(e) => set("name", e.target.value)} className="admin-input w-full" />
          </Field>
          <Field label={t("staffFormEmail")}>
            <input required type="email" value={v.email} onChange={(e) => set("email", e.target.value)} className="admin-input w-full" />
          </Field>
          <Field label={t("staffFormRole")}>
            <select value={v.role} onChange={(e) => set("role", e.target.value as StaffRole)} className="admin-input w-full">
              <option value="despachador">{t("staffFormRoleDespachador")}</option>
              <option value="delivery">{t("staffFormRoleDelivery")}</option>
            </select>
          </Field>
          <Field label={t("staffFieldLocale")}>
            <select value={v.preferredLocale} onChange={(e) => set("preferredLocale", e.target.value as Locale)} className="admin-input w-full">
              <option value="en">{t("staffLocaleEn")}</option>
              <option value="es">{t("staffLocaleEs")}</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="admin-card admin-enter p-6" style={stagger(2)}>
        <h2 className="mb-5 font-serif text-lg font-bold text-navy">{t("staffSectionContact")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("staffFieldPhone")}>
            <input type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} className="admin-input w-full" />
          </Field>
          <span className="hidden sm:block" />
          <Field label={t("staffFieldEmergencyName")}>
            <input value={v.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} className="admin-input w-full" />
          </Field>
          <Field label={t("staffFieldEmergencyPhone")}>
            <input type="tel" value={v.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} className="admin-input w-full" />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("staffFieldNotes")} hint={t("staffFieldNotesHint")}>
              <textarea rows={3} value={v.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} className="admin-input w-full resize-y" />
            </Field>
          </div>
        </div>
      </section>

      <section className="admin-card admin-enter p-6" style={stagger(3)}>
        <h2 className="mb-5 font-serif text-lg font-bold text-navy">{t("staffSectionAccess")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("staffFieldNewPassword")} hint={t("staffFieldNewPasswordHint")}>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setStatus("idle");
              }}
              className="admin-input w-full"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 sm:pt-6">
            <button type="button" role="switch" aria-checked={v.isActive} onClick={handleToggleActive} className="flex items-center gap-3 text-sm text-navy">
              <span className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${v.isActive ? "bg-emerald-500" : "bg-navy/25"}`}>
                <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all duration-200 ${v.isActive ? "left-[22px]" : "left-0.5"}`} />
              </span>
              {v.isActive ? t("staffStatusActive") : t("staffStatusInactive")}
            </button>
            <button type="button" onClick={handleResetPin} className="admin-link">
              {t("staffResetPinButton")}
            </button>
            {pin && (
              <span className="admin-enter font-mono text-sm text-sin-red">
                {t("staffPinRevealPrefix")}: {pin}
              </span>
            )}
          </div>
        </div>
        <div className="mt-5 border-t border-navy/[0.07] pt-5">
          <Field label={t("staffFormPin")} hint={t("staffPinManualHint")}>
            <div className="flex flex-wrap items-center gap-3">
              <input
                inputMode="numeric"
                maxLength={6}
                value={manualPin}
                onChange={(e) => {
                  setManualPin(e.target.value.replace(/\D/g, ""));
                  setPinStatus("idle");
                }}
                className="admin-input w-40 font-mono tracking-[0.3em]"
              />
              <button type="button" onClick={handleSetPin} disabled={manualPin.length === 0} className="admin-btn">
                {t("staffPinSetButton")}
              </button>
              {pinStatus === "saved" && <span role="status" className="admin-enter text-[13px] font-medium text-emerald-700">✓ {t("staffPinSaved")}</span>}
              {pinStatus === "invalid" && <span role="alert" className="text-[13px] text-sin-red">{t("staffPinInvalid")}</span>}
            </div>
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={saving} className="admin-btn">
          {saving ? t("staffSaving") : t("staffSaveButton")}
        </button>
        {status === "saved" && (
          <span role="status" className="admin-enter text-[13px] font-medium text-emerald-700">
            ✓ {t("staffSaved")}
          </span>
        )}
        {status === "emailTaken" && <span role="alert" className="text-[13px] text-sin-red">{t("staffFormEmailExists")}</span>}
        {status === "error" && <span role="alert" className="text-[13px] text-sin-red">{t("staffSaveError")}</span>}
      </div>
    </form>
  );
}
