import { hasAttentionActions } from "@/lib/order-attention";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { formatAdelaide } from "@/lib/adelaide-time";
import { Link } from "@/i18n/navigation";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { OrderStatusForm } from "@/components/admin/order-status-form";
import { PageHeader } from "@/components/admin/page-header";
import { AttentionBadge } from "@/components/admin/status-badge";
import { OrderAttentionActions } from "@/components/admin/order-attention-actions";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const order = await new DrizzleOrderRepository().findById(id);
  if (!order) notFound();

  return (
    <div>
      <Link href="/admin/orders" className="text-[13px] text-navy/50 hover:text-sin-red mb-4 inline-block">{t("backToOrders")}</Link>
      <PageHeader title={order.customerName} />

      <div className="bg-white rounded-xl p-5 mb-6">
        <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-2">{t("detailCustomer")}</h2>
        <p className="text-sm">{order.customerName} — {order.customerEmail} — {order.customerPhone}</p>
        {order.deliveryAddress && (
          <p className="text-sm mt-1">{t("detailAddress")}: {order.deliveryAddress}</p>
        )}
        {order.scheduledFor && (
          <p className="text-sm mt-1">{t("detailScheduledFor")}: {formatAdelaide(order.scheduledFor, locale)}</p>
        )}
        {order.deliveryNotes?.trim() && (
          <p className="text-sm mt-1">{t("detailDeliveryNotes")}: {order.deliveryNotes}</p>
        )}
      </div>

      <div className="bg-white rounded-xl p-5 mb-6">
        <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-2">{t("detailItems")}</h2>
        <ul className="text-sm space-y-1">
          {order.items.map((item) => (
            <li key={item.productId}>{item.quantity}x — ${(item.unitPriceCents / 100).toFixed(2)} c/u</li>
          ))}
        </ul>
        <p className="text-sm font-bold mt-3">{t("columnTotal")}: ${(order.totalCents / 100).toFixed(2)}</p>
      </div>

      <div className="bg-white rounded-xl p-5 space-y-4">
        {order.attentionReason && <AttentionBadge reason={order.attentionReason} />}
        <OrderAttentionActions
          orderId={order.id}
          requiresAttention={hasAttentionActions(order.attentionReason)}
          canHandOver={order.fulfillmentType === "pickup" && order.fulfillmentStatus === "ready_for_pickup"}
        />
        <OrderStatusForm
          orderId={order.id}
          fulfillmentStatus={order.fulfillmentStatus}
          paymentStatus={order.paymentStatus}
          requiresAttention={Boolean(order.attentionReason)}
        />
      </div>
    </div>
  );
}
