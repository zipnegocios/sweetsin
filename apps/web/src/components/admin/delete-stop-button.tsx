"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { deleteTrailerStopAction } from "@/app/actions/admin-trailer-stops";

export function DeleteStopButton({ stopId, stockCount }: { stopId: string; stockCount: number }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick() {
    const message =
      stockCount > 0
        ? `${t("stopsDeleteConfirm")} ${t("stopsDeleteStockWarning", { count: stockCount })}`
        : t("stopsDeleteConfirm");
    if (!window.confirm(message)) return;
    setError(false);
    setIsPending(true);
    try {
      await deleteTrailerStopAction(stopId);
      router.push("/admin/trailer-stops");
      router.refresh();
    } catch {
      setError(true);
      setIsPending(false);
    }
  }

  return (
    <>
      <button disabled={isPending} onClick={handleClick} className="text-[12px] text-sin-red hover:text-sin-red-dark disabled:opacity-50">
        {t("stopsDeleteButton")}
      </button>
      {error && <span className="text-[12px] text-sin-red">{t("stopsDeleteError")}</span>}
    </>
  );
}
