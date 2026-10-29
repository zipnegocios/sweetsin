"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { CapacitySettings } from "@workspace/domain/capacity";
import { saveCapacitySettingsAction } from "@/app/actions/admin-capacity";
import { parseOptionalInt } from "@/lib/capacity-format";

type NumKey = "workAreaUnits" | "vehicleCapacityUnits" | "tripMinutes" | "maxDeliveryTrips";
const NUMBERS = [
  { key: "workAreaUnits", label: "capWorkArea", help: "capWorkAreaHelp" },
  { key: "vehicleCapacityUnits", label: "capVehicle", help: "capVehicleHelp" },
  { key: "tripMinutes", label: "capTripMinutes", help: "capTripMinutesHelp" },
  { key: "maxDeliveryTrips", label: "capMaxTrips", help: "capMaxTripsHelp" },
] as const satisfies readonly { key: NumKey; label: string; help: string }[];

export function CapacitySettingsForm({ initial }: { initial: CapacitySettings }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.capacityEngineEnabled);
  const [showEstimate, setShowEstimate] = useState(initial.showEstimateToCustomer);
  const [nums, setNums] = useState<Record<NumKey, string>>({
    workAreaUnits: String(initial.workAreaUnits ?? ""),
    vehicleCapacityUnits: String(initial.vehicleCapacityUnits ?? ""),
    tripMinutes: String(initial.tripMinutes ?? ""),
    maxDeliveryTrips: String(initial.maxDeliveryTrips ?? ""),
  });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<"saved" | "invalid" | "generic" | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFeedback(null);
    const parsed = NUMBERS.map((n) => [n.key, parseOptionalInt(nums[n.key])] as const);
    if (parsed.some(([, v]) => v === undefined)) {
      setFeedback("invalid");
      return;
    }
    setBusy(true);
    try {
      const result = await saveCapacitySettingsAction({
        capacityEngineEnabled: enabled,
        showEstimateToCustomer: showEstimate,
        ...Object.fromEntries(parsed),
      });
      setFeedback(result.ok ? "saved" : result.error === "Invalid body" ? "invalid" : "generic");
      if (result.ok) router.refresh();
    } catch {
      setFeedback("generic");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="admin-card p-5 space-y-2 max-w-xl">
      <h2 className="font-serif font-bold text-navy text-lg mb-2">{t("capSettingsSection")}</h2>
      <label className="flex items-start gap-3 py-2">
        <input type="checkbox" className="mt-1" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>
          <span className="block text-sm font-medium text-navy">{t("capEngineEnabled")}</span>
          <span className="block text-[13px] text-navy/55">{t("capEngineEnabledHelp")}</span>
        </span>
      </label>
      {NUMBERS.map((n) => (
        <label key={n.key} className="block py-2">
          <span className="block text-sm font-medium text-navy">{t(n.label)}</span>
          <span className="block text-[13px] text-navy/55 mb-1">{t(n.help)}</span>
          <input
            type="text"
            inputMode="numeric"
            value={nums[n.key]}
            onChange={(e) => setNums((p) => ({ ...p, [n.key]: e.target.value }))}
            className="admin-input w-32"
          />
        </label>
      ))}
      <label className="flex items-start gap-3 py-2">
        <input type="checkbox" className="mt-1" checked={showEstimate} onChange={(e) => setShowEstimate(e.target.checked)} />
        <span>
          <span className="block text-sm font-medium text-navy">{t("capShowEstimate")}</span>
          <span className="block text-[13px] text-navy/55">{t("capShowEstimateHelp")}</span>
        </span>
      </label>
      {feedback === "saved" && (
        <p role="status" className="text-[13px] text-navy/70">{t("capSaved")}</p>
      )}
      {(feedback === "invalid" || feedback === "generic") && (
        <p role="alert" className="text-[13px] text-sin-red">
          {t(feedback === "invalid" ? "capErrorInvalid" : "capErrorGeneric")}
        </p>
      )}
      <button type="submit" disabled={busy} className="admin-btn">{t("capSaveSettings")}</button>
    </form>
  );
}
