"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { restockAction, reportWasteAction } from "@/app/actions/admin-trailer-stops";

export function StockRow({
  stopId,
  productId,
  productName,
  currentStock,
  maxStock,
}: {
  stopId: string;
  productId: string;
  productName: string;
  currentStock: number;
  maxStock: number;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleRestock() {
    setIsPending(true);
    try {
      await restockAction(stopId, productId, quantity);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleWaste() {
    setIsPending(true);
    try {
      await reportWasteAction(stopId, productId, quantity, reason || null);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <tr className="border-t border-navy/5">
      <td className="px-4 py-3">{productName}</td>
      <td className="px-4 py-3">{currentStock}</td>
      <td className="px-4 py-3">{maxStock}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-16 border border-navy/15 rounded-lg px-2 py-1 text-sm"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("stockWasteReasonPlaceholder")}
            className="w-32 border border-navy/15 rounded-lg px-2 py-1 text-sm"
          />
          <button disabled={isPending} onClick={handleRestock} className="text-[12px] text-navy/60 hover:text-sin-red disabled:opacity-50">
            {t("stockRestockButton")}
          </button>
          <button disabled={isPending} onClick={handleWaste} className="text-[12px] text-navy/60 hover:text-sin-red disabled:opacity-50">
            {t("stockWasteButton")}
          </button>
        </div>
      </td>
    </tr>
  );
}
