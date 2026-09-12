import { and, eq, gt, lt } from "drizzle-orm";
import type { EventBooking, EventBookingRepository } from "@workspace/domain/event-bookings";
import { db } from "../index";
import { eventBookingItemsTable, eventBookingsTable } from "../schema";

export class DrizzleEventBookingRepository implements EventBookingRepository {
  async create(booking: Omit<EventBooking, "id">): Promise<EventBooking> {
    return db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(eventBookingsTable)
        .values({
          clientName: booking.clientName,
          clientCompany: booking.clientCompany,
          clientEmail: booking.clientEmail,
          clientPhone: booking.clientPhone,
          eventType: booking.eventType,
          eventDate: booking.eventDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
          location: booking.location,
          estimatedGuests: booking.estimatedGuests,
          status: booking.status,
          notes: booking.notes,
        })
        .returning();

      if (booking.items.length > 0) {
        await tx.insert(eventBookingItemsTable).values(
          booking.items.map((item) => ({
            eventBookingId: inserted.id,
            description: item.description,
            quantity: item.quantity,
            agreedUnitPriceCents: item.agreedUnitPriceCents,
          })),
        );
      }

      return { ...inserted, items: booking.items };
    });
  }

  async findOverlapping(eventDate: Date, startTime: Date, endTime: Date): Promise<EventBooking[]> {
    const rows = await db
      .select()
      .from(eventBookingsTable)
      .where(
        and(
          eq(eventBookingsTable.status, "confirmed"),
          lt(eventBookingsTable.startTime, endTime),
          gt(eventBookingsTable.endTime, startTime),
        ),
      );

    return rows.map((row) => ({ ...row, items: [] }));
  }
}
