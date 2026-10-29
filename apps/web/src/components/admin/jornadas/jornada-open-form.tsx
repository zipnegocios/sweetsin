"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { openJornadaAction } from "@/app/actions/admin-jornadas";
import { useStopOperation } from "@/components/admin/use-stop-operation";
import {
  StockPicker,
  toStockItems,
  type StockPickerProduct,
  type StockPickerTemplate,
  type StockSelection,
} from "@/components/admin/stock-picker";

/** Abrir una jornada: nombre opcional y stock inicial (a mano o copiado de una plantilla). */
export function JornadaOpenForm({
  products,
  templates,
}: {
  products: StockPickerProduct[];
  templates: StockPickerTemplate[];
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const { isPending, error, setError, run } = useStopOperation();
  const [name, setName] = useState("");
  const [selection, setSelection] = useState<StockSelection>({});
  const [invalid, setInvalid] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInvalid(false);
    setError(null);
    const items = toStockItems(selection);
    if (items.some((i) => i.maxStock < 1)) {
      setInvalid(true);
      return;
    }
    let id = "";
    void run(
      async () => {
        const result = await openJornadaAction({ name: name.trim() || undefined, products: items });
        if (result.ok) id = result.id;
        else if (result.error === "Invalid body") {
          // Error de datos del formulario, no de operación: se muestra su propio mensaje (onOk no navega sin id).
          setInvalid(true);
          return { ok: true };
        }
        return result;
      },
      () => {
        if (!id) return;
        router.push(`/admin/jornadas/${id}`);
        router.refresh();
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="admin-card p-5 space-y-4 max-w-xl">
      <h2 className="font-serif font-bold text-navy text-lg">{t("jornadaOpenTitle")}</h2>
      <label className="block">
        <span className="block text-[11px] uppercase text-navy/40 mb-1">{t("jornadaName")}</span>
        <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className="w-full admin-input" />
      </label>
      <StockPicker
        products={products}
        templates={templates}
        value={selection}
        onChange={setSelection}
        label={t("stopFormMaxStock")}
      />
      {invalid && (
        <p role="alert" className="text-[13px] text-sin-red">
          {t("jornadaErrorInvalid")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-sin-red">
          {t(error.key, error.values)}
        </p>
      )}
      <button type="submit" disabled={isPending} className="admin-btn disabled:opacity-50">
        {t("jornadaOpenButton")}
      </button>
    </form>
  );
}
