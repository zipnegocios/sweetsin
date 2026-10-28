"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { completeTrailerStopAction, cancelTrailerStopAction, reactivateTrailerStopAction } from "@/app/actions/admin-trailer-stops";

export function TrailerStopRowActions({ stopId, status }: { stopId: string; status: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(false);

  async function handle(action: (id: string) => Promise<void>) {
    setError(false);
    setIsPending(true);
    try {
      await action(stopId);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setIsPending(false);
    }
  }

  // Una parada abierta se cierra desde su detalle (resumen + confirmación de pedidos sin entregar).
  if (status === "completed" || status === "active") return null;

  const cls = "text-[12px] text-navy/60 hover:text-sin-red disabled:opacity-50";
  return (
    <div className="flex gap-2">
      {status === "cancelled" ? (
        <button disabled={isPending} onClick={() => handle(reactivateTrailerStopAction)} className={cls}>
          {t("stopsReactivateButton")}
        </button>
      ) : (
        <>
          <button disabled={isPending} onClick={() => handle(completeTrailerStopAction)} className={cls}>
            {t("stopsCompleteButton")}
          </button>
          {status === "scheduled" && (
            <button disabled={isPending} onClick={() => handle(cancelTrailerStopAction)} className={cls}>
              {t("stopsCancelButton")}
            </button>
          )}
        </>
      )}
      {error && <span className="text-[12px] text-sin-red">{t("stopFormSubmitError")}</span>}
    </div>
  );
}
