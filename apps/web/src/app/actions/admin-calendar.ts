"use server";

import { listAllTrailerStops } from "@workspace/domain/trailer-stops";
import { DrizzleTrailerStopRepository, DrizzleEventBookingRepository } from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: "stop" | "booking";
}

export async function listCalendarEventsAction(): Promise<CalendarEvent[]> {
  await requireAdmin();

  const stops = await listAllTrailerStops(new DrizzleTrailerStopRepository());
  const bookings = await new DrizzleEventBookingRepository().listAll({ status: "confirmed" });

  const stopEvents: CalendarEvent[] = stops
    .filter((s) => s.status !== "cancelled")
    .map((s) => ({
      id: s.id,
      title: s.location,
      start: s.startTime.toISOString(),
      end: s.endTime.toISOString(),
      type: "stop",
    }));

  const bookingEvents: CalendarEvent[] = bookings.map((b) => ({
    id: b.id,
    title: b.clientName,
    start: b.startTime.toISOString(),
    end: b.endTime.toISOString(),
    type: "booking",
  }));

  return [...stopEvents, ...bookingEvents];
}
