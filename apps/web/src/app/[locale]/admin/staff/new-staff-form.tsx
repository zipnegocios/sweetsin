"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createStaffAction } from "@/app/actions/admin-staff";

export function NewStaffForm() {
  const t = useTranslations("admin");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"despachador" | "delivery">("despachador");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [newPin, setNewPin] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const result = await createStaffAction({ name, email, role, password });
      if (!result.ok) {
        setSubmitError(
          result.message.includes("already exists") ? t("staffFormEmailExists") : result.message || t("staffFormSubmitError"),
        );
        return;
      }
      setNewPin(result.plainPin);
      setName("");
      setEmail("");
      setPassword("");
      router.refresh();
    } catch {
      setSubmitError(t("staffFormSubmitError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mb-8">
      {newPin && (
        <div className="bg-sin-red/10 border border-sin-red/30 rounded-lg p-3 text-[13px] text-sin-red mb-4">
          {t("staffPinRevealPrefix")}: {newPin}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("staffFormName")}
          required
          className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("staffFormEmail")}
          required
          className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm"
        />
        <div>
          <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("staffFormRole")}</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "despachador" | "delivery")}
            className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm"
          >
            <option value="despachador">{t("staffFormRoleDespachador")}</option>
            <option value="delivery">{t("staffFormRoleDelivery")}</option>
          </select>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("staffFormPassword")}
          required
          className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm"
        />

        {submitError && <p className="text-[13px] text-sin-red">{submitError}</p>}

        <button type="submit" disabled={isSubmitting} className="bg-sin-red text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">
          {t("staffFormSubmit")}
        </button>
      </form>
    </div>
  );
}
