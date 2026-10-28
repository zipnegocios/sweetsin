import type { Locale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listOrdersAction } from "@/app/actions/admin-orders";
import type { FulfillmentStatus, PaymentStatus, OrderChannel } from "@workspace/domain/orders";

import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge, AttentionBadge } from "@/components/admin/status-badge";
import { OrderAttentionActions } from "@/components/admin/order-attention-actions";

type SearchParams = Record<string, string | undefined>;

const FULFILLMENT_STATUSES = ["pending", "received", "in_prep", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled"] as const;
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const sp = await searchParams;

  const orders = await listOrdersAction({
    fulfillmentStatus: (sp.fulfillmentStatus as FulfillmentStatus) || undefined,
    paymentStatus: (sp.paymentStatus as PaymentStatus) || undefined,
    channel: (sp.channel as OrderChannel) || undefined,
    dateFrom: sp.dateFrom || undefined,
    dateTo: sp.dateTo || undefined,
    search: sp.search || undefined,
    sortBy: "createdAt",
    sortDir: "desc",
  });

  return (
    <div>
      <PageHeader title={t("ordersTitle")} />

      <form method="get" className="admin-card admin-enter flex flex-wrap gap-3 p-4 mb-6" style={{ "--i": 1 } as React.CSSProperties}>
        <input name="search" defaultValue={sp.search ?? ""} placeholder={t("searchPlaceholder")} className="admin-input min-w-56 flex-1" />
        <select name="fulfillmentStatus" defaultValue={sp.fulfillmentStatus ?? ""} className="admin-input">
          <option value="">{t("filterFulfillmentStatus")}</option>
          {FULFILLMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{t(`status_${s}`)}</option>
          ))}
        </select>
        <select name="paymentStatus" defaultValue={sp.paymentStatus ?? ""} className="admin-input">
          <option value="">{t("filterPaymentStatus")}</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{t(`status_${s}`)}</option>
          ))}
        </select>
        <select name="channel" defaultValue={sp.channel ?? ""} className="admin-input">
          <option value="">{t("filterChannel")}</option>
          <option value="web">{t("channel_web")}</option>
          <option value="whatsapp">{t("channel_whatsapp")}</option>
        </select>
        <input type="date" name="dateFrom" defaultValue={sp.dateFrom ?? ""} aria-label={t("filterDateFrom")} className="admin-input" />
        <input type="date" name="dateTo" defaultValue={sp.dateTo ?? ""} aria-label={t("filterDateTo")} className="admin-input" />
        <button type="submit" className="admin-btn">{t("applyFilters")}</button>
      </form>

      <div className="admin-card admin-enter overflow-x-auto" style={{ "--i": 2 } as React.CSSProperties}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("columnCustomer")}</th>
              <th>{t("columnStatus")}</th>
              <th>{t("columnPayment")}</th>
              <th>{t("columnChannel")}</th>
              <th className="text-right">{t("columnTotal")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <span className="block font-medium text-navy">{order.customerName}</span>
                  <span className="block text-navy/45 text-xs mt-0.5">{order.customerEmail}</span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge status={order.fulfillmentStatus} />
                    {order.attentionReason && <AttentionBadge reason={order.attentionReason} />}
                  </div>
                </td>
                <td><StatusBadge status={order.paymentStatus} /></td>
                <td className="text-navy/70">{t(`channel_${order.channel}`)}</td>
                <td className="text-right font-mono tabular-nums text-navy">${(order.totalCents / 100).toFixed(2)}</td>
                <td className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    <Link href={`/admin/orders/${order.id}`} className="admin-link">{t("viewDetail")} →</Link>
                    <OrderAttentionActions
                      orderId={order.id}
                      requiresAttention={Boolean(order.attentionReason)}
                      canHandOver={order.fulfillmentType === "pickup" && order.fulfillmentStatus === "ready_for_pickup"}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
