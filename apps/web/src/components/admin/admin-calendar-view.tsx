"use client";

import { useMemo } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useTranslations } from "next-intl";
import type { CalendarEvent } from "@/app/actions/admin-calendar";

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: enUS }),
  getDay,
  locales,
});

export function AdminCalendarView({ events }: { events: CalendarEvent[] }) {
  const t = useTranslations("admin");

  const calendarEvents = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: new Date(e.start),
        end: new Date(e.end),
        resource: e.type,
      })),
    [events],
  );

  return (
    <div>
      <div className="flex gap-4 mb-4 text-[12px] text-navy/60">
        <span><span className="inline-block w-3 h-3 rounded-full bg-sin-red mr-1" /> {t("calendarLegendStop")}</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-navy mr-1" /> {t("calendarLegendBooking")}</span>
      </div>
      <div style={{ height: 700 }} className="bg-white rounded-xl p-4">
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          eventPropGetter={(event) => ({
            style: { backgroundColor: event.resource === "stop" ? "#E63946" : "#0F1B3D" },
          })}
        />
      </div>
    </div>
  );
}
