import type { Locale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listOrdersAction } from "@/app/actions/admin-orders";
import type { FulfillmentStatus, PaymentStatus, OrderChannel } from "@workspace/domain/orders";

type SearchParams = Record<string, string | undefined>;

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
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{t("ordersTitle")}</h1>

      <form method="get" className="flex flex-wrap gap-3 mb-6">
        <input name="search" defaultValue={sp.search ?? ""} placeholder={t("searchPlaceholder")} className="border border-navy/15 rounded-lg px-3 py-2 text-sm" />
        <select name="fulfillmentStatus" defaultValue={sp.fulfillmentStatus ?? ""} className="border border-navy/15 rounded-lg px-3 py-2 text-sm">
          <option value="">{t("filterFulfillmentStatus")}</option>
          {["pending", "received", "in_prep", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="paymentStatus" defaultValue={sp.paymentStatus ?? ""} className="border border-navy/15 rounded-lg px-3 py-2 text-sm">
          <option value="">{t("filterPaymentStatus")}</option>
          {["pending", "paid", "failed", "refunded"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="channel" defaultValue={sp.channel ?? ""} className="border border-navy/15 rounded-lg px-3 py-2 text-sm">
          <option value="">{t("filterChannel")}</option>
          <option value="web">web</option>
          <option value="whatsapp">whatsapp</option>
        </select>
        <input type="date" name="dateFrom" defaultValue={sp.dateFrom ?? ""} className="border border-navy/15 rounded-lg px-3 py-2 text-sm" />
        <input type="date" name="dateTo" defaultValue={sp.dateTo ?? ""} className="border border-navy/15 rounded-lg px-3 py-2 text-sm" />
        <button type="submit" className="bg-navy text-white rounded-lg px-4 py-2 text-sm">{t("applyFilters")}</button>
      </form>

      <table className="w-full text-sm bg-white rounded-xl overflow-hidden">
        <thead className="bg-navy/5 text-left">
          <tr>
            <th className="px-4 py-3">{t("columnCustomer")}</th>
            <th className="px-4 py-3">{t("columnStatus")}</th>
            <th className="px-4 py-3">{t("columnPayment")}</th>
            <th className="px-4 py-3">{t("columnChannel")}</th>
            <th className="px-4 py-3">{t("columnTotal")}</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t border-navy/5">
              <td className="px-4 py-3">{order.customerName}<br /><span className="text-navy/40 text-xs">{order.customerEmail}</span></td>
              <td className="px-4 py-3">{order.fulfillmentStatus}</td>
              <td className="px-4 py-3">{order.paymentStatus}</td>
              <td className="px-4 py-3">{order.channel}</td>
              <td className="px-4 py-3">${(order.totalCents / 100).toFixed(2)}</td>
              <td className="px-4 py-3">
                <Link href={`/admin/orders/${order.id}`} className="text-sin-red hover:underline">{t("viewDetail")}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
