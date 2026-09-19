import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listAssignedAction } from "@/app/actions/delivery";
import { AssignedList } from "./assigned-list";

export const dynamic = "force-dynamic";

export default async function DeliveryPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dispatch");

  const orders = await listAssignedAction();

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{t("deliveryTitle")}</h1>
      <AssignedList orders={orders} />
    </div>
  );
}
