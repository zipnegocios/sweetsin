"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  closeTrailerStopAction,
  getStopCloseSummaryAction,
  type StopCloseSummary,
} from "@/app/actions/admin-trailer-stops";
import { closeJornadaAction } from "@/app/actions/admin-jornadas";
import { useStopOperation } from "@/components/admin/use-stop-operation";

/**
 * Cerrar una parada abierta: muestra el resumen (vendido, merma, sobrante, agotados) y,
 * si hay pedidos sin entregar, exige un segundo clic explícito (confirmUndelivered).
 * Con `jornada`, cierra una jornada de delivery (el dominio no exige la confirmación; el segundo clic queda como aviso).
 */
export function StopCloseDialog({
  stopId,
  productNames,
  jornada = false,
}: {
  stopId: string;
  productNames: Record<string, string>;
  jornada?: boolean;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { isPending, error, run } = useStopOperation();
  const [summary, setSummary] = useState<StopCloseSummary | null>(null);
  const [armed, setArmed] = useState(false);

  function handleOpen() {
    setSummary(null);
    setArmed(false);
    dialogRef.current?.showModal();
    void run(async () => {
      const result = await getStopCloseSummaryAction(stopId);
      if (result.ok) setSummary(result.summary);
      return result;
    });
  }

  function handleConfirm() {
    const needsSecondClick = (summary?.undeliveredOrders ?? 0) > 0;
    if (needsSecondClick && !armed) {
      setArmed(true);
      return;
    }
    void run(
      async () => {
        const result = jornada
          ? await closeJornadaAction(stopId)
          : await closeTrailerStopAction(stopId, { confirmUndelivered: armed });
        // Apareció un pedido sin entregar entre el resumen y el clic: el próximo clic confirma.
        if (!result.ok && result.error === "Stop has undelivered orders") setArmed(true);
        return result;
      },
      () => {
        dialogRef.current?.close();
        router.refresh();
      },
    );
  }

  return (
    <div>
      <button type="button" disabled={isPending} onClick={handleOpen} className="admin-btn disabled:opacity-50">
        {t("stopCloseButton")}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`close-title-${stopId}`}
        className="m-auto w-full max-w-2xl rounded-xl p-6 backdrop:bg-navy/40"
      >
        <h2 id={`close-title-${stopId}`} className="font-serif font-bold text-navy text-xl mb-4">
          {t("stopCloseTitle")}
        </h2>

        {!summary && isPending && (
          <p role="status" className="text-[13px] text-navy/60">
            {t("stopCloseLoading")}
          </p>
        )}

        {summary && (
          <>
            {summary.products.length === 0 ? (
              <p className="text-[13px] text-navy/60">{t("stopCloseNoStock")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t("stockColumnProduct")}</th>
                      <th>{t("stockColumnSold")}</th>
                      <th>{t("stopCloseColumnWaste")}</th>
                      <th>{t("stopCloseColumnRemaining")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.products.map((p) => (
                      <tr key={p.productId}>
                        <td>{productNames[p.productId] ?? p.productId}</td>
                        <td>{p.sold}</td>
                        <td>{p.wasted}</td>
                        <td>{p.currentStock}</td>
                        <td>{p.soldOut && <span className="text-[12px] font-medium text-sin-red">{t("stopCloseSoldOut")}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {summary.undeliveredOrders > 0 && (
              <p role="alert" className="mt-4 rounded-lg bg-gold/15 p-3 text-[13px] text-[#8A611C]">
                {t("stopCloseUndeliveredWarning", { count: String(summary.undeliveredOrders) })}
              </p>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 text-[13px] text-sin-red">
            {t(error.key, error.values)}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" disabled={isPending} onClick={() => dialogRef.current?.close()} className="admin-link text-[13px]">
            {t("stopDialogCancel")}
          </button>
          <button
            type="button"
            disabled={isPending || !summary}
            onClick={handleConfirm}
            className={`admin-btn disabled:opacity-50 ${armed ? "bg-sin-red! hover:bg-sin-red-dark!" : ""}`}
          >
            {armed ? t("stopCloseConfirmUndelivered") : t("stopCloseConfirm")}
          </button>
        </div>
      </dialog>
    </div>
  );
}
