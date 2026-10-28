"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { StockRow } from "@/components/admin/stock-row";
import { addStopProductAction, saveStopStockAsTemplateAction } from "@/app/actions/admin-trailer-stops";
import { stockTemplateErrorKey, type StockTemplateErrorKey } from "@/lib/stock-template-error";

interface EditorRow {
  id: string;
  productId: string;
  productName: string;
  currentStock: number;
  maxStock: number;
  soldUnits: number;
}

export function StopStockEditor({
  stopId,
  rows,
  availableProducts,
  readOnly,
}: {
  stopId: string;
  rows: EditorRow[];
  availableProducts: { id: string; nameEn: string }[];
  readOnly: boolean;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [quantityRaw, setQuantityRaw] = useState("10");
  const [templateName, setTemplateName] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [errorKey, setErrorKey] = useState<StockTemplateErrorKey | null>(null);
  const [savedTemplate, setSavedTemplate] = useState(false);

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, onOk: () => void) {
    setErrorKey(null);
    setSavedTemplate(false);
    setIsPending(true);
    try {
      const result = await fn();
      if (!result.ok) setErrorKey(stockTemplateErrorKey(result.error));
      else onOk();
    } catch {
      setErrorKey("tplErrorGeneric");
    } finally {
      setIsPending(false);
    }
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const raw = quantityRaw.trim();
    if (!/^\d+$/.test(raw) || Number(raw) < 1) {
      setErrorKey("tplErrorQuantity");
      return;
    }
    void run(() => addStopProductAction(stopId, productId, Number(raw)), () => {
      setProductId("");
      router.refresh();
    });
  }

  function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    void run(() => saveStopStockAsTemplateAction(stopId, templateName), () => {
      setTemplateName("");
      setSavedTemplate(true);
    });
  }

  return (
    <div>
      <div className="admin-card admin-enter overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("stockColumnProduct")}</th>
              <th>{t("stockColumnSold")}</th>
              <th>{t("stockColumnCurrent")}</th>
              <th>{t("stockColumnMax")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <StockRow
                key={s.id}
                stopId={stopId}
                productId={s.productId}
                productName={s.productName}
                currentStock={s.currentStock}
                maxStock={s.maxStock}
                soldUnits={s.soldUnits}
                readOnly={readOnly}
              />
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="mt-4 space-y-4">
          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              aria-label={t("stockAddTitle")}
              className="admin-input"
            >
              <option value="">{t("stockAddSelect")}</option>
              {availableProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameEn}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              step={1}
              value={quantityRaw}
              onChange={(e) => setQuantityRaw(e.target.value)}
              aria-label={t("stockQuantityLabel")}
              className="w-24 border border-navy/15 rounded-lg px-2 py-1 text-sm"
            />
            <button type="submit" disabled={isPending || !productId} className="admin-btn disabled:opacity-50">
              {t("stockAddButton")}
            </button>
          </form>

          <form onSubmit={handleSaveTemplate} className="flex items-center gap-2">
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={t("stockSaveTemplateName")}
              aria-label={t("stockSaveTemplateName")}
              required
              className="admin-input"
            />
            <button type="submit" disabled={isPending} className="admin-btn disabled:opacity-50">
              {t("stockSaveTemplateButton")}
            </button>
          </form>

          {errorKey && (
            <p role="alert" className="text-[13px] text-sin-red">
              {t(errorKey)}
            </p>
          )}
          {savedTemplate && (
            <p role="status" className="text-[13px] text-navy/60">
              {t("stockTemplateSaved")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
