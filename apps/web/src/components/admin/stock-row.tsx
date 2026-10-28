"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { setStopProductQuantityAction, removeStopProductAction } from "@/app/actions/admin-trailer-stops";
import { stockTemplateErrorKey, type StockTemplateErrorKey } from "@/lib/stock-template-error";

export function StockRow({
  stopId,
  productId,
  productName,
  currentStock,
  maxStock,
  soldUnits,
  readOnly,
}: {
  stopId: string;
  productId: string;
  productName: string;
  currentStock: number;
  maxStock: number;
  soldUnits: number;
  readOnly: boolean;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [maxRaw, setMaxRaw] = useState(String(maxStock));
  const [errorKey, setErrorKey] = useState<StockTemplateErrorKey | null>(null);

  async function handleSaveQuantity() {
    setErrorKey(null);
    const raw = maxRaw.trim();
    if (!/^\d+$/.test(raw) || Number(raw) < 1) {
      setErrorKey("tplErrorQuantity");
      return;
    }
    setIsPending(true);
    try {
      const result = await setStopProductQuantityAction(stopId, productId, Number(raw));
      if (!result.ok) setErrorKey(stockTemplateErrorKey(result.error));
      else router.refresh();
    } catch {
      setErrorKey("tplErrorGeneric");
    } finally {
      setIsPending(false);
    }
  }

  async function handleRemove() {
    setErrorKey(null);
    setIsPending(true);
    try {
      const result = await removeStopProductAction(stopId, productId);
      if (!result.ok) {
        setErrorKey(stockTemplateErrorKey(result.error));
        setIsPending(false);
        return;
      }
      router.refresh();
    } catch {
      setErrorKey("tplErrorGeneric");
      setIsPending(false);
    }
  }

  return (
    <tr>
      <td>{productName}</td>
      <td>{soldUnits}</td>
      <td>{currentStock}</td>
      <td>
        {readOnly ? (
          maxStock
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              step={1}
              value={maxRaw}
              onChange={(e) => setMaxRaw(e.target.value)}
              aria-label={t("stockQuantityLabel")}
              className="w-20 border border-navy/15 rounded-lg px-2 py-1 text-sm"
            />
            <button disabled={isPending} onClick={handleSaveQuantity} className="text-[12px] text-navy/60 hover:text-sin-red disabled:opacity-50">
              {t("stockSaveQuantity")}
            </button>
          </div>
        )}
        {errorKey && (
          <p role="alert" className="text-[12px] text-sin-red mt-1">
            {t(errorKey)}
          </p>
        )}
      </td>
      <td>
        {!readOnly && (
          <div className="flex items-center gap-2">
          <button disabled={isPending} onClick={handleRemove} className="text-[12px] text-navy/60 hover:text-sin-red disabled:opacity-50">
            {t("stockRemoveButton")}
          </button>
        </div>
        )}
      </td>
    </tr>
  );
}
