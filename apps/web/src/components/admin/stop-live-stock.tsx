"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { restockStopProductAction, wasteStopProductAction } from "@/app/actions/admin-trailer-stops";
import { useStopOperation } from "@/components/admin/use-stop-operation";

interface LiveRow {
  productId: string;
  productName: string;
  currentStock: number;
}

/** Reposición y merma de una parada abierta (solo si `liveStockEnabled` está encendido). */
export function StopLiveStock({ stopId, rows }: { stopId: string; rows: LiveRow[] }) {
  const t = useTranslations("admin");
  return (
    <div className="admin-card admin-enter overflow-x-auto">
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t("stockColumnProduct")}</th>
            <th>{t("stockColumnCurrent")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <LiveStockRow key={r.productId} stopId={stopId} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LiveStockRow({ stopId, row }: { stopId: string; row: LiveRow }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const { isPending, error, setError, run } = useStopOperation();
  const [quantityRaw, setQuantityRaw] = useState("1");
  const [reason, setReason] = useState("");
  const [recorded, setRecorded] = useState(false);

  function submit(kind: "restock" | "waste") {
    setRecorded(false);
    const raw = quantityRaw.trim();
    if (!/^\d+$/.test(raw) || Number(raw) < 1) {
      setError({ key: "opErrorQuantity" });
      return;
    }
    const quantity = Number(raw);
    void run(
      () =>
        kind === "restock"
          ? restockStopProductAction(stopId, row.productId, quantity)
          : wasteStopProductAction(stopId, row.productId, quantity, reason || null),
      () => {
        setReason("");
        setRecorded(true);
        router.refresh();
      },
    );
  }

  const btn = "text-[12px] text-navy/60 hover:text-sin-red disabled:opacity-50";
  return (
    <tr>
      <td>{row.productName}</td>
      <td>{row.currentStock}</td>
      <td>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            step={1}
            value={quantityRaw}
            onChange={(e) => setQuantityRaw(e.target.value)}
            aria-label={t("liveStockQuantity")}
            className="w-16 border border-navy/15 rounded-lg px-2 py-1 text-sm"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("stockWasteReasonPlaceholder")}
            aria-label={t("stockWasteReasonPlaceholder")}
            className="w-36 border border-navy/15 rounded-lg px-2 py-1 text-sm"
          />
          <button type="button" disabled={isPending} onClick={() => submit("restock")} className={btn}>
            {t("stockRestockButton")}
          </button>
          <button type="button" disabled={isPending} onClick={() => submit("waste")} className={btn}>
            {t("stockWasteButton")}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-[12px] text-sin-red mt-1">
            {t(error.key, error.values)}
          </p>
        )}
        {recorded && !error && (
          <p role="status" className="text-[12px] text-navy/60 mt-1">
            {t("liveStockRecorded")}
          </p>
        )}
      </td>
    </tr>
  );
}
