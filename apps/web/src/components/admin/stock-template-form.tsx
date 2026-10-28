"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createStockTemplateAction, updateStockTemplateAction } from "@/app/actions/admin-stock-templates";
import { stockTemplateErrorKey, type StockTemplateErrorKey } from "@/lib/stock-template-error";

interface ProductOption {
  id: string;
  nameEn: string;
}

interface TemplateValue {
  id: string;
  name: string;
  items: { productId: string; quantity: number }[];
}

export function StockTemplateForm({ products, template }: { products: ProductOption[]; template?: TemplateValue }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [name, setName] = useState(template?.name ?? "");
  const [selected, setSelected] = useState<Record<string, string>>(
    Object.fromEntries(
      (template?.items ?? [])
        .filter((i) => products.some((p) => p.id === i.productId)) // productos ya no disponibles no se reenvían
        .map((i) => [i.productId, String(i.quantity)]),
    ),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<StockTemplateErrorKey | null>(null);

  function toggle(productId: string, checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) next[productId] = next[productId] ?? "10";
      else delete next[productId];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorKey(null);
    const items = Object.entries(selected).map(([productId, raw]) => ({
      productId,
      quantity: /^\d+$/.test(raw.trim()) ? Number(raw) : 0,
    }));
    if (items.some((i) => i.quantity < 1)) {
      setErrorKey("tplErrorQuantity");
      return;
    }
    setIsSubmitting(true);
    const input = { name, items };
    try {
      const result = template
        ? await updateStockTemplateAction(template.id, input)
        : await createStockTemplateAction(input);
      if (!result.ok) {
        setErrorKey(stockTemplateErrorKey(result.error));
        setIsSubmitting(false);
        return;
      }
      router.push("/admin/stock-templates");
      router.refresh();
    } catch {
      setErrorKey("tplErrorGeneric");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("tplFormName")}
        aria-label={t("tplFormName")}
        required
        className="w-full admin-input"
      />

      <div>
        <p className="text-[11px] uppercase text-navy/40 mb-2">{t("tplFormProducts")}</p>
        <div className="space-y-2">
          {products.map((product) => (
            <div key={product.id} className="flex items-center gap-3">
              <label className="flex items-center gap-3 flex-1 text-sm">
                <input
                  type="checkbox"
                  checked={product.id in selected}
                  onChange={(e) => toggle(product.id, e.target.checked)}
                />
                {product.nameEn}
              </label>
              {product.id in selected && (
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={selected[product.id]}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [product.id]: e.target.value }))}
                  aria-label={t("tplFormQuantity")}
                  className="w-24 border border-navy/15 rounded-lg px-2 py-1 text-sm"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {errorKey && (
        <p role="alert" className="text-[13px] text-sin-red">
          {t(errorKey)}
        </p>
      )}

      <button type="submit" disabled={isSubmitting} className="admin-btn disabled:opacity-50">
        {t(template ? "tplFormSave" : "tplFormSubmit")}
      </button>
    </form>
  );
}
