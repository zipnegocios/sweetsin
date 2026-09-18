import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { DrizzleOrderRepository } from "@workspace/db/repositories";

export default async function AccountOrdersPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");

  const session = await auth();
  const orders = await new DrizzleOrderRepository().listByCustomerId(session!.user.id);

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{t("ordersTitle")}</h1>
      {orders.length === 0 ? (
        <p className="text-navy/40 text-sm">{t("noOrders")}</p>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="bg-white rounded-xl p-4 border border-navy/10">
              <p className="text-sm font-medium text-navy">{t("orderTotal")}: ${(order.totalCents / 100).toFixed(2)}</p>
              <p className="text-[13px] text-navy/50">{t("orderStatus")}: {order.fulfillmentStatus}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
