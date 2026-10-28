"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updateOrderStatusAction } from "@/app/actions/admin-orders";
import type { FulfillmentStatus, PaymentStatus } from "@workspace/domain/orders";

const FULFILLMENT_STATUSES: FulfillmentStatus[] = [
  "pending", "received", "in_prep", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled",
];
const PAYMENT_STATUSES: PaymentStatus[] = ["pending", "paid", "failed", "refunded"];

export function OrderStatusForm({
  orderId,
  fulfillmentStatus,
  paymentStatus,
}: {
  orderId: string;
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: PaymentStatus;
}) {
  const t = useTranslations("admin");
  const [fulfillment, setFulfillment] = useState(fulfillmentStatus);
  const [payment, setPayment] = useState(paymentStatus);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  async function handleSave() {
    setSaved(false);
    setError(false);
    const result = await updateOrderStatusAction({
      orderId,
      fulfillmentStatus: fulfillment !== fulfillmentStatus ? fulfillment : undefined,
      paymentStatus: payment !== paymentStatus ? payment : undefined,
    });
    if ("error" in result) setError(true);
    else setSaved(true);
  }

  return (
    <div className="flex items-end gap-3">
      <div>
        <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("filterFulfillmentStatus")}</label>
        <select
          value={fulfillment}
          onChange={(e) => setFulfillment(e.target.value as FulfillmentStatus)}
          className="admin-input"
        >
          {FULFILLMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("filterPaymentStatus")}</label>
        <select
          value={payment}
          onChange={(e) => setPayment(e.target.value as PaymentStatus)}
          className="admin-input"
        >
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <button onClick={handleSave} className="admin-btn">{t("saveStatus")}</button>
      {saved && <span className="text-[12px] text-green-700">{t("statusSaved")}</span>}
      {error && <span className="text-[12px] text-red-700">{t("statusChangeError")}</span>}
    </div>
  );
}
