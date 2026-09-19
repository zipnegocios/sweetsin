import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listQueueAction, listDeliveryStaffAction } from "@/app/actions/dispatch";
import { QueueList } from "./queue-list";

export const dynamic = "force-dynamic";

export default async function DispatchPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dispatch");

  const [orders, deliveryStaff] = await Promise.all([listQueueAction(), listDeliveryStaffAction()]);

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{t("queueTitle")}</h1>
      <QueueList orders={orders} deliveryStaff={deliveryStaff} />
    </div>
  );
}
