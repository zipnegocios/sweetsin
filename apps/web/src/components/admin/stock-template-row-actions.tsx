"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  archiveStockTemplateAction,
  unarchiveStockTemplateAction,
  deleteStockTemplateAction,
  type StockTemplateActionResult,
} from "@/app/actions/admin-stock-templates";
import { stockTemplateErrorKey, type StockTemplateErrorKey } from "@/lib/stock-template-error";

export function StockTemplateRowActions({ templateId, archived }: { templateId: string; archived: boolean }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [errorKey, setErrorKey] = useState<StockTemplateErrorKey | null>(null);

  async function handle(action: (id: string) => Promise<StockTemplateActionResult>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setErrorKey(null);
    setIsPending(true);
    try {
      const result = await action(templateId);
      if (!result.ok) setErrorKey(stockTemplateErrorKey(result.error));
      else router.refresh();
    } catch {
      setErrorKey("tplErrorGeneric");
    } finally {
      setIsPending(false);
    }
  }

  const cls = "text-[12px] text-navy/60 hover:text-sin-red disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        disabled={isPending}
        onClick={() => handle(archived ? unarchiveStockTemplateAction : archiveStockTemplateAction)}
        className={cls}
      >
        {t(archived ? "tplUnarchiveButton" : "tplArchiveButton")}
      </button>
      <button
        disabled={isPending}
        onClick={() => handle(deleteStockTemplateAction, t("tplDeleteConfirm"))}
        className="text-[12px] text-sin-red hover:text-sin-red-dark disabled:opacity-50"
      >
        {t("tplDeleteButton")}
      </button>
      {errorKey && (
        <span role="alert" className="text-[12px] text-sin-red">
          {t(errorKey)}
        </span>
      )}
    </div>
  );
}
