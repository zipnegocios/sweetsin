import { pgEnum, pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const eventBookingStatusEnum = pgEnum("event_booking_status", [
  "quote_requested",
  "quoted",
  "confirmed",
  "completed",
  "cancelled",
]);

export const eventBookingsTable = pgTable("event_bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientName: text("client_name").notNull(),
  clientCompany: text("client_company"),
  clientEmail: text("client_email").notNull(),
  clientPhone: text("client_phone").notNull(),
  eventType: text("event_type").notNull(),
  eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  location: text("location").notNull(),
  estimatedGuests: integer("estimated_guests").notNull(),
  status: eventBookingStatusEnum("status").notNull().default("quote_requested"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const eventBookingItemsTable = pgTable("event_booking_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventBookingId: uuid("event_booking_id")
    .notNull()
    .references(() => eventBookingsTable.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  agreedUnitPriceCents: integer("agreed_unit_price_cents").notNull(),
});
