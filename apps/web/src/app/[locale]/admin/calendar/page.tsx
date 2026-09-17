import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listCalendarEventsAction } from "@/app/actions/admin-calendar";
import { AdminCalendarView } from "@/components/admin/admin-calendar-view";

export default async function AdminCalendarPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const events = await listCalendarEventsAction();

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{t("calendarTitle")}</h1>
      <AdminCalendarView events={events} />
    </div>
  );
}
