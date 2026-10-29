"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { PrepStepMode, ProductCapacityRule } from "@workspace/domain/capacity";
import { saveProductRuleAction } from "@/app/actions/admin-capacity";
import type { CalibrationRow } from "@/lib/capacity-calibration";
import { calibrationState, parseOptionalInt, secondsParts } from "@/lib/capacity-format";

export interface ProductRuleRow {
  productId: string;
  name: string;
  rule: ProductCapacityRule;
  steps: { name: string; seconds: number; mode: PrepStepMode }[];
  calibration: CalibrationRow | null;
}

type NumLabel = "capDeliveryMaxQty" | "capLeadTime" | "capBatchUnits" | "capBatchSeconds";
type StepDraft = { name: string; seconds: string; mode: PrepStepMode };
type Fmt = (seconds: number) => string;

function useFormatSeconds(): Fmt {
  const t = useTranslations("admin");
  return (seconds) => {
    const { m, s } = secondsParts(seconds);
    return m > 0 ? t("repDurationMin", { m, s }) : t("repDurationSec", { s });
  };
}

function Calibration({ cal, fmt }: { cal: CalibrationRow | null; fmt: Fmt }) {
  const t = useTranslations("admin");
  const state = cal ? calibrationState(cal) : "noData";
  return (
    <div className="text-[13px] text-navy/70 space-y-1 min-w-44">
      <p>
        {cal?.configuredSeconds != null
          ? t("capConfigured", { time: fmt(cal.configuredSeconds) })
          : t("capNoConfigured")}
      </p>
      {cal && cal.measuredMedianSeconds !== null ? (
        <p>{t("capMeasured", { time: fmt(cal.measuredMedianSeconds), n: cal.sampleSize })}</p>
      ) : (
        <p>{t("capNoData")}</p>
      )}
      {state === "small" && <p className="text-sin-red">{t("capSmallSample")}</p>}
    </div>
  );
}

function ProductRow({ row, fmt }: { row: ProductRuleRow; fmt: Fmt }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [soldOnline, setSoldOnline] = useState(row.rule.soldOnline);
  const [nums, setNums] = useState({
    deliveryMaxQty: String(row.rule.deliveryMaxQty ?? ""),
    leadTimeMinutes: String(row.rule.leadTimeMinutes ?? ""),
    batchUnits: String(row.rule.batchUnits ?? ""),
    batchSeconds: String(row.rule.batchSeconds ?? ""),
  });
  const [steps, setSteps] = useState<StepDraft[]>(
    row.steps.map((s) => ({ name: s.name, seconds: String(s.seconds), mode: s.mode })),
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<"saved" | "invalid" | "generic" | null>(null);

  const setStep = (i: number, patch: Partial<StepDraft>) =>
    setSteps((p) => p.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) =>
    setSteps((p) => {
      const next = [...p];
      const [a, b] = [next[i], next[i + d]];
      if (!a || !b) return p;
      next[i] = b;
      next[i + d] = a;
      return next;
    });

  async function save() {
    if (busy) return;
    setFeedback(null);
    const rule = {
      soldOnline,
      deliveryMaxQty: parseOptionalInt(nums.deliveryMaxQty),
      leadTimeMinutes: parseOptionalInt(nums.leadTimeMinutes),
      batchUnits: parseOptionalInt(nums.batchUnits),
      batchSeconds: parseOptionalInt(nums.batchSeconds),
    };
    const parsedSteps = steps.map((s) => ({
      name: s.name.trim(),
      seconds: parseOptionalInt(s.seconds),
      mode: s.mode,
    }));
    if (Object.values(rule).some((v) => v === undefined) || parsedSteps.some((s) => !s.name || !s.seconds)) {
      setFeedback("invalid");
      return;
    }
    setBusy(true);
    try {
      const result = await saveProductRuleAction(row.productId, { rule, steps: parsedSteps });
      setFeedback(result.ok ? "saved" : result.error === "Invalid body" ? "invalid" : "generic");
      if (result.ok) router.refresh();
    } catch {
      setFeedback("generic");
    } finally {
      setBusy(false);
    }
  }

  const numField = (key: keyof typeof nums, label: NumLabel) => (
    <label className="block">
      <span className="block text-sm font-medium text-navy">{t(label)}</span>
      <span className="block text-[12px] text-navy/55 mb-1">{t(`${label}Help`)}</span>
      <input
        type="text"
        inputMode="numeric"
        value={nums[key]}
        onChange={(e) => setNums((p) => ({ ...p, [key]: e.target.value }))}
        className="admin-input w-28"
      />
    </label>
  );

  return (
    <tr className="align-top border-t border-navy/[0.07]">
      <td className="p-4 font-medium text-navy">{row.name}</td>
      <td className="p-4 space-y-3 min-w-56">
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={soldOnline} onChange={(e) => setSoldOnline(e.target.checked)} />
          <span>
            <span className="block text-sm font-medium text-navy">{t("capSoldOnline")}</span>
            <span className="block text-[12px] text-navy/55">{t("capSoldOnlineHelp")}</span>
          </span>
        </label>
        {numField("deliveryMaxQty", "capDeliveryMaxQty")}
        {numField("leadTimeMinutes", "capLeadTime")}
        {numField("batchUnits", "capBatchUnits")}
        {numField("batchSeconds", "capBatchSeconds")}
      </td>
      <td className="p-4 min-w-72">
        <p className="text-[12px] text-navy/55 mb-2">{t("capStepsHelp")}</p>
        <ul className="space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <input
                aria-label={t("capStepName")}
                placeholder={t("capStepName")}
                value={s.name}
                onChange={(e) => setStep(i, { name: e.target.value })}
                className="admin-input w-36"
              />
              <input
                aria-label={t("capStepSeconds")}
                placeholder={t("capStepSeconds")}
                inputMode="numeric"
                value={s.seconds}
                onChange={(e) => setStep(i, { seconds: e.target.value })}
                className="admin-input w-20"
              />
              <select
                aria-label={t("capStepMode")}
                value={s.mode}
                onChange={(e) => setStep(i, { mode: e.target.value as PrepStepMode })}
                className="admin-input"
              >
                <option value="per_batch">{t("capStepPerBatch")}</option>
                <option value="per_unit">{t("capStepPerUnit")}</option>
              </select>
              <button type="button" aria-label={t("capStepUp")} disabled={i === 0} onClick={() => move(i, -1)} className="admin-link">
                ↑
              </button>
              <button
                type="button"
                aria-label={t("capStepDown")}
                disabled={i === steps.length - 1}
                onClick={() => move(i, 1)}
                className="admin-link"
              >
                ↓
              </button>
              <button type="button" onClick={() => setSteps((p) => p.filter((_, j) => j !== i))} className="admin-link">
                {t("capStepRemove")}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setSteps((p) => [...p, { name: "", seconds: "", mode: "per_batch" }])}
          className="admin-link mt-2"
        >
          {t("capStepAdd")}
        </button>
        <div className="mt-3">
          <button type="button" onClick={save} disabled={busy} className="admin-btn">
            {t("capSaveProduct")}
          </button>
          {feedback === "saved" && <p role="status" className="text-[13px] text-navy/70 mt-1">{t("capProductSaved")}</p>}
          {feedback === "invalid" && <p role="alert" className="text-[13px] text-sin-red mt-1">{t("capErrorInvalid")}</p>}
          {feedback === "generic" && <p role="alert" className="text-[13px] text-sin-red mt-1">{t("capErrorGeneric")}</p>}
        </div>
      </td>
      <td className="p-4">
        <Calibration cal={row.calibration} fmt={fmt} />
      </td>
    </tr>
  );
}

export function ProductRulesTable({ rows }: { rows: ProductRuleRow[] }) {
  const t = useTranslations("admin");
  const fmt = useFormatSeconds();
  return (
    <section className="admin-card overflow-x-auto">
      <div className="p-5 pb-2">
        <h2 className="font-serif font-bold text-navy text-lg">{t("capProductsSection")}</h2>
        <p className="text-[13px] text-navy/55">{t("capProductsHelp")}</p>
        <p className="text-[13px] text-navy/55">{t("capCalibrationHelp")}</p>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-[12px] uppercase tracking-wide text-navy/55">
            <th className="p-4">{t("capColProduct")}</th>
            <th className="p-4">{t("capColRules")}</th>
            <th className="p-4">{t("capColSteps")}</th>
            <th className="p-4">{t("capColCalibration")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <ProductRow key={r.productId} row={r} fmt={fmt} />
          ))}
        </tbody>
      </table>
    </section>
  );
}
