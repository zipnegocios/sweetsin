"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Order } from "@workspace/domain/orders";
import type { User } from "@workspace/domain/users";
import { markInPrepAction, markReadyAction, assignDeliveryAction } from "@/app/actions/dispatch";

export function QueueList({ orders, deliveryStaff }: { orders: Order[]; deliveryStaff: User[] }) {
  const t = useTranslations("dispatch");
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<Record<string, string>>({});

  async function handleMarkInPrep(orderId: string) {
    setPendingId(orderId);
    try {
      await markInPrepAction(orderId);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function handleMarkReady(orderId: string) {
    setPendingId(orderId);
    try {
      await markReadyAction(orderId);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function handleAssignDelivery(orderId: string) {
    const deliveryUserId = selectedDelivery[orderId];
    if (!deliveryUserId) return;
    setPendingId(orderId);
    try {
      await assignDeliveryAction(orderId, deliveryUserId);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (orders.length === 0) {
    return <p className="text-navy/40 text-sm">{t("queueEmpty")}</p>;
  }

  return (
    <table className="w-full text-sm bg-white rounded-xl overflow-hidden">
      <thead className="bg-navy/5 text-left">
        <tr>
          <th className="px-4 py-3">{t("columnCustomer")}</th>
          <th className="px-4 py-3">{t("columnStatus")}</th>
          <th className="px-4 py-3">{t("columnItems")}</th>
          <th className="px-4 py-3">{t("assignDeliveryLabel")}</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id} className="border-t border-navy/5 align-top">
            <td className="px-4 py-3">{order.customerName}</td>
            <td className="px-4 py-3">{order.fulfillmentStatus}</td>
            <td className="px-4 py-3">
              {order.items.map((item) => `${item.quantity}x`).join(", ")}
            </td>
            <td className="px-4 py-3 space-y-2">
              {order.fulfillmentStatus === "received" && (
                <button
                  type="button"
                  disabled={pendingId === order.id}
                  onClick={() => handleMarkInPrep(order.id)}
                  className="text-sin-red hover:underline disabled:opacity-50 block"
                >
                  {t("markInPrepButton")}
                </button>
              )}
              {order.fulfillmentStatus === "in_prep" && (
                <button
                  type="button"
                  disabled={pendingId === order.id}
                  onClick={() => handleMarkReady(order.id)}
                  className="text-sin-red hover:underline disabled:opacity-50 block"
                >
                  {t("markReadyButton")}
                </button>
              )}
              {order.fulfillmentStatus === "ready_for_pickup" && (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedDelivery[order.id] ?? ""}
                    onChange={(e) =>
                      setSelectedDelivery((prev) => ({ ...prev, [order.id]: e.target.value }))
                    }
                    className="border border-navy/15 rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option value="">{t("assignDeliveryPlaceholder")}</option>
                    {deliveryStaff.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={pendingId === order.id || !selectedDelivery[order.id]}
                    onClick={() => handleAssignDelivery(order.id)}
                    className="text-sin-red hover:underline disabled:opacity-50"
                  >
                    {t("assignDeliveryButton")}
                  </button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
