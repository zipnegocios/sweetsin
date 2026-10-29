"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { DeliveryEvaluation } from "@workspace/domain/capacity";
import { simulateAction } from "@/app/actions/admin-capacity";
import { parseAdelaideLocal, formatAdelaide } from "@/lib/adelaide-time";
import { parseOptionalInt, reasonMessage, secondsParts } from "@/lib/capacity-format";

export function CapacitySimulator({ products }: { products: { id: string; name: string }[] }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [scheduled, setScheduled] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"lines" | "generic" | null>(null);
  const [result, setResult] = useState<DeliveryEvaluation | null>(null);

  const names = new Map(products.map((p) => [p.id, p.name]));
  const fmt = (seconds: number) => {
    const { m, s } = secondsParts(seconds);
    return m > 0 ? t("repDurationMin", { m, s }) : t("repDurationSec", { s });
  };

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setResult(null);
    const lines = products.flatMap((p) => {
      const q = parseOptionalInt(qty[p.id] ?? "");
      return q ? [{ productId: p.id, quantity: q }] : [];
    });
    if (lines.length === 0) {
      setError("lines");
      return;
    }
    setBusy(true);
    try {
      const res = await simulateAction({
        lines,
        ...(scheduled ? { scheduledFor: parseAdelaideLocal(scheduled).toISOString() } : {}),
      });
      if (res.ok) setResult(res.evaluation);
      else setError("generic");
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-card p-5 max-w-xl">
      <h2 className="font-serif font-bold text-navy text-lg">{t("capSimTitle")}</h2>
      <p className="text-[13px] text-navy/55 mb-3">{t("capSimHelp")}</p>
      <form onSubmit={run} className="space-y-3">
        <ul className="space-y-2">
          {products.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-navy">{p.name}</span>
              <input
                aria-label={`${p.name} · ${t("capSimQuantity")}`}
                placeholder={t("capSimQuantity")}
                inputMode="numeric"
                value={qty[p.id] ?? ""}
                onChange={(e) => setQty((prev) => ({ ...prev, [p.id]: e.target.value }))}
                className="admin-input w-24"
              />
            </li>
          ))}
        </ul>
        <label className="block">
          <span className="block text-sm font-medium text-navy mb-1">{t("capSimScheduledFor")}</span>
          <input type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} className="admin-input" />
        </label>
        <button type="submit" disabled={busy} className="admin-btn">
          {t("capSimRun")}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-[13px] text-sin-red mt-3">
          {t(error === "lines" ? "capSimNoLines" : "capSimError")}
        </p>
      )}
      {result && (
        <div role="status" className="mt-4 space-y-1 text-sm text-navy">
          <p className="font-medium">{t(result.ok ? "capSimOk" : "capSimRejected")}</p>
          {result.reasons.length > 0 && (
            <ul className="list-disc pl-5">
              {result.reasons.map((r, i) => {
                const m = reasonMessage(r, {
                  productName: (id) => names.get(id) ?? id,
                  formatAt: (d) => formatAdelaide(d, locale),
                });
                return <li key={i}>{t(m.key, m.values)}</li>;
              })}
            </ul>
          )}
          <p>{t("capSimPrep", { time: fmt(result.estimate.prepSeconds) })}</p>
          <p>{t("capSimTrips", { n: result.estimate.trips })}</p>
          <p>{t("capSimTransport", { n: result.estimate.transportMinutes })}</p>
        </div>
      )}
    </section>
  );
}
