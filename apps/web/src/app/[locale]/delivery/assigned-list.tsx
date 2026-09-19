"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Order } from "@workspace/domain/orders";
import { markDeliveredAction } from "@/app/actions/delivery";

export function AssignedList({ orders }: { orders: Order[] }) {
  const t = useTranslations("dispatch");
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleMarkDelivered(orderId: string) {
    setPendingId(orderId);
    try {
      await markDeliveredAction(orderId);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (orders.length === 0) {
    return <p className="text-navy/40 text-sm">{t("deliveryEmpty")}</p>;
  }

  return (
    <table className="w-full text-sm bg-white rounded-xl overflow-hidden">
      <thead className="bg-navy/5 text-left">
        <tr>
          <th className="px-4 py-3">{t("columnCustomer")}</th>
          <th className="px-4 py-3">{t("columnStatus")}</th>
          <th className="px-4 py-3">{t("columnItems")}</th>
          <th className="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id} className="border-t border-navy/5">
            <td className="px-4 py-3">
              {order.customerName}
              {order.deliveryAddress && (
                <p className="text-navy/50 text-[12px]">{order.deliveryAddress}</p>
              )}
            </td>
            <td className="px-4 py-3">{order.fulfillmentStatus}</td>
            <td className="px-4 py-3">
              {order.items.map((item) => `${item.quantity}x`).join(", ")}
            </td>
            <td className="px-4 py-3">
              {order.fulfillmentStatus === "out_for_delivery" && (
                <button
                  type="button"
                  disabled={pendingId === order.id}
                  onClick={() => handleMarkDelivered(order.id)}
                  className="text-sin-red hover:underline disabled:opacity-50"
                >
                  {t("markDeliveredButton")}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
