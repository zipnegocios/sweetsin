"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCart } from "@/lib/cart-store";
import { formatStopSchedule } from "@/lib/stop-schedule";

/** Selector de parada de retiro (arriba del menú, del carrito y del checkout). */
export function StopSelector({ tone = "light" }: { tone?: "light" | "cream" }) {
  const t = useTranslations("cart");
  const locale = useLocale() as "en" | "es";
  const { pickupStops, selectedStop, selectStop } = useCart();
  const id = useId();

  if (pickupStops.length === 0) {
    return <p className="text-[13px] text-navy/60">{t("stopSelectorEmpty")}</p>;
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-mono text-[10px] uppercase tracking-wider text-navy/60">
        {t("stopSelectorLabel")}
      </label>
      <select
        id={id}
        value={selectedStop?.stopId ?? ""}
        onChange={(e) => selectStop(e.target.value || null)}
        className={`w-full border border-navy/12 rounded-2xl px-4 py-3 text-sm text-navy focus:border-sin-red outline-none ${
          tone === "cream" ? "bg-white" : "bg-cream"
        }`}
      >
        <option value="">{t("stopSelectorNone")}</option>
        {pickupStops.map((stop) => {
          const { day, timeRange } = formatStopSchedule(stop, locale);
          return (
            <option key={stop.stopId} value={stop.stopId}>
              {`${stop.location} · ${day} ${timeRange}`}
            </option>
          );
        })}
      </select>
      {!selectedStop && <p className="text-[12px] text-navy/60">{t("stopSelectorHint")}</p>}
    </div>
  );
}

/** Aviso único (no duplicado entre menú y carrito) de lo que cambió al recortar el carrito. */
export function CartTrimNotice() {
  const t = useTranslations("cart");
  const locale = useLocale();
  const { trimChanges, dismissTrimChanges, products } = useCart();

  if (trimChanges.length === 0) return null;

  return (
    <div
      role="status"
      className="fixed left-4 right-4 bottom-20 md:bottom-6 md:left-auto md:right-6 md:max-w-sm z-[200] bg-white border border-sin-red/40 rounded-2xl shadow-[0_8px_32px_rgba(15,27,61,0.18)] p-4"
    >
      <p className="text-[13px] font-medium text-navy mb-2">{t("trimNoticeTitle")}</p>
      <ul className="text-[13px] text-navy/80 space-y-1 mb-3">
        {trimChanges.map((change) => {
          const product = products.find((p) => p.id === change.productId);
          const name = (locale === "en" ? product?.nameEn : product?.nameEs) ?? change.productId;
          return (
            <li key={change.productId}>
              {change.to === 0
                ? t("trimNoticeRemoved", { name })
                : t("trimNoticeReduced", { name, from: change.from, to: change.to })}
            </li>
          );
        })}
      </ul>
      <button
        onClick={dismissTrimChanges}
        className="font-mono text-[11px] uppercase tracking-wider text-sin-red hover:text-navy transition-colors"
      >
        {t("trimNoticeDismiss")}
      </button>
    </div>
  );
}
