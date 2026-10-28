"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  retryOrderStockAction,
  resolveOrderAttentionAction,
  updateOrderStatusAction,
} from "@/app/actions/admin-orders";
import { useStopOperation } from "@/components/admin/use-stop-operation";

/**
 * Acciones rápidas de un pedido: en atención, Reintentar descuento / Marcar resuelto / Cancelar
 * (cancelar pide un segundo clic); en retiro listo, "Entregado al cliente".
 */
export function OrderAttentionActions({
  orderId,
  requiresAttention,
  canHandOver,
}: {
  orderId: string;
  requiresAttention: boolean;
  canHandOver: boolean;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const { isPending, error, run } = useStopOperation();
  const [cancelArmed, setCancelArmed] = useState(false);

  if (!requiresAttention && !canHandOver) return null;

  const refresh = () => router.refresh();
  const cls = "text-[12px] text-navy/60 hover:text-sin-red disabled:opacity-50";

  function handleCancel() {
    if (!cancelArmed) return setCancelArmed(true);
    void run(() => updateOrderStatusAction({ orderId, fulfillmentStatus: "cancelled" }), refresh);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {requiresAttention && (
          <>
            <button type="button" disabled={isPending} onClick={() => void run(() => retryOrderStockAction(orderId), refresh)} className={cls}>
              {t("orderRetryStock")}
            </button>
            <button type="button" disabled={isPending} onClick={() => void run(() => resolveOrderAttentionAction(orderId), refresh)} className={cls}>
              {t("orderResolveAttention")}
            </button>
            <button type="button" disabled={isPending} onClick={handleCancel} className={cancelArmed ? `${cls} text-sin-red!` : cls}>
              {cancelArmed ? t("orderCancelConfirm") : t("orderCancel")}
            </button>
          </>
        )}
        {canHandOver && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => void run(() => updateOrderStatusAction({ orderId, fulfillmentStatus: "delivered" }), refresh)}
            className={cls}
          >
            {t("orderHandOver")}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[12px] text-sin-red">
          {t(error.key, error.values)}
        </p>
      )}
    </div>
  );
}
