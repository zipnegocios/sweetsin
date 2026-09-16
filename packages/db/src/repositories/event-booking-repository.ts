import { and, eq, gt, lt } from "drizzle-orm";
import type { EventBooking, EventBookingRepository, EventBookingStatus, EventBookingItem } from "@workspace/domain/event-bookings";
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

    return Promise.all(rows.map((row) => this.attachItems(row)));
  }

  async findById(id: string): Promise<EventBooking | null> {
    const [row] = await db.select().from(eventBookingsTable).where(eq(eventBookingsTable.id, id));
    if (!row) return null;
    return this.attachItems(row);
  }

  async listAll(filters?: { status?: EventBookingStatus }): Promise<EventBooking[]> {
    const rows = await db
      .select()
      .from(eventBookingsTable)
      .where(filters?.status ? eq(eventBookingsTable.status, filters.status) : undefined);
    return Promise.all(rows.map((row) => this.attachItems(row)));
  }

  async updateStatus(id: string, status: EventBookingStatus): Promise<void> {
    await db.update(eventBookingsTable).set({ status }).where(eq(eventBookingsTable.id, id));
  }

  async update(
    id: string,
    fields: Partial<Pick<EventBooking, "location" | "startTime" | "endTime" | "estimatedGuests" | "notes">>,
  ): Promise<void> {
    await db.update(eventBookingsTable).set(fields).where(eq(eventBookingsTable.id, id));
  }

  async addItem(eventBookingId: string, item: EventBookingItem): Promise<EventBooking> {
    await db.insert(eventBookingItemsTable).values({ eventBookingId, ...item });
    const updated = await this.findById(eventBookingId);
    if (!updated) throw new Error(`Event booking not found: ${eventBookingId}`);
    return updated;
  }

  private async attachItems(row: typeof eventBookingsTable.$inferSelect): Promise<EventBooking> {
    const itemRows = await db
      .select()
      .from(eventBookingItemsTable)
      .where(eq(eventBookingItemsTable.eventBookingId, row.id));
    return {
      ...row,
      items: itemRows.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        agreedUnitPriceCents: item.agreedUnitPriceCents,
      })),
    };
  }
}
