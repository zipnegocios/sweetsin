"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

export interface StockPickerProduct {
  id: string;
  nameEn: string;
}

export interface StockPickerTemplate {
  id: string;
  name: string;
  items: { productId: string; quantity: number }[];
}

/** Cantidad por producto elegido, como texto del input. */
export type StockSelection = Record<string, string>;

/** Ítems de stock inicial; una cantidad no entera queda en 0 para que el formulario la rechace. */
export function toStockItems(selection: StockSelection): { productId: string; maxStock: number }[] {
  return Object.entries(selection).map(([productId, raw]) => ({
    productId,
    maxStock: /^\d+$/.test(raw.trim()) ? Number(raw) : 0,
  }));
}

/** Stock inicial al crear una parada o abrir una jornada: plantilla (se copia, editable) + productos con cantidad. */
export function StockPicker({
  products,
  templates,
  value,
  onChange,
  label,
}: {
  products: StockPickerProduct[];
  templates: StockPickerTemplate[];
  value: StockSelection;
  onChange: (next: StockSelection) => void;
  label: string;
}) {
  const t = useTranslations("admin");
  const templateSelectId = useId();

  function toggleProduct(productId: string, checked: boolean) {
    const next = { ...value };
    if (checked) next[productId] = next[productId] ?? "10";
    else delete next[productId];
    onChange(next);
  }

  // Copia la plantilla al estado (editable después); "Ninguna" no lo toca.
  function applyTemplate(templateId: string) {
    const template = templates.find((tpl) => tpl.id === templateId);
    if (!template) return;
    const available = new Set(products.map((p) => p.id));
    onChange(
      Object.fromEntries(template.items.filter((i) => available.has(i.productId)).map((i) => [i.productId, String(i.quantity)])),
    );
  }

  return (
    <div>
      {templates.length > 0 && (
        <div className="mb-3">
          <label htmlFor={templateSelectId} className="block text-[11px] uppercase text-navy/40 mb-1">
            {t("stopFormTemplate")}
          </label>
          <select id={templateSelectId} defaultValue="" onChange={(e) => applyTemplate(e.target.value)} className="admin-input">
            <option value="">{t("stopFormTemplateNone")}</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <p className="text-[11px] uppercase text-navy/40 mb-2">{label}</p>
      <div className="space-y-2">
        {products.map((product) => (
          <div key={product.id} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={product.id in value}
              onChange={(e) => toggleProduct(product.id, e.target.checked)}
              aria-label={product.nameEn}
            />
            <span className="text-sm flex-1">{product.nameEn}</span>
            {product.id in value && (
              <input
                type="number"
                min={1}
                value={value[product.id]}
                onChange={(e) => onChange({ ...value, [product.id]: e.target.value })}
                placeholder={t("stopFormMaxStock")}
                aria-label={`${t("stopFormMaxStock")}: ${product.nameEn}`}
                className="w-24 border border-navy/15 rounded-lg px-2 py-1 text-sm"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
