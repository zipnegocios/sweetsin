import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listCalendarEventsAction } from "@/app/actions/admin-calendar";
import { AdminCalendarView } from "@/components/admin/admin-calendar-view";
import { PageHeader } from "@/components/admin/page-header";

export default async function AdminCalendarPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const events = await listCalendarEventsAction();

  return (
    <div>
      <PageHeader title={t("calendarTitle")} />
      <AdminCalendarView events={events} />
    </div>
  );
}
