import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { listQueueAction, listDeliveryStaffAction } from "@/app/actions/dispatch";
import { signOutAction } from "@/app/actions/auth";
import { QueueList } from "./queue-list";

export const dynamic = "force-dynamic";

export default async function DispatchPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dispatch");

  const [orders, deliveryStaff] = await Promise.all([listQueueAction(), listDeliveryStaffAction()]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif font-bold text-navy text-2xl">{t("queueTitle")}</h1>
        <form action={async () => { "use server"; await signOutAction(); redirect({ href: "/login", locale }); }}>
          <button type="submit" className="text-[13px] text-navy/50 hover:text-sin-red transition-colors">
            Sign out
          </button>
        </form>
      </div>
      <QueueList orders={orders} deliveryStaff={deliveryStaff} />
    </div>
  );
}
