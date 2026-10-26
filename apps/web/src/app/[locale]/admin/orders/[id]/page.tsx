import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { OrderStatusForm } from "@/components/admin/order-status-form";

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
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{order.customerName}</h1>

      <div className="bg-white rounded-xl p-5 mb-6">
        <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-2">{t("detailCustomer")}</h2>
        <p className="text-sm">{order.customerName} — {order.customerEmail} — {order.customerPhone}</p>
        {order.deliveryAddress && (
          <p className="text-sm mt-1">{t("detailAddress")}: {order.deliveryAddress}</p>
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

      <div className="bg-white rounded-xl p-5">
        <OrderStatusForm orderId={order.id} fulfillmentStatus={order.fulfillmentStatus} paymentStatus={order.paymentStatus} />
      </div>
    </div>
  );
}
