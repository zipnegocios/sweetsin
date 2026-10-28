import { pgEnum, pgTable, uuid, text, doublePrecision, timestamp } from "drizzle-orm/pg-core";

export const trailerStopStatusEnum = pgEnum("trailer_stop_status", [
  "scheduled",
  "active",
  "completed",
  "cancelled",
]);

export const trailerStopsTable = pgTable("trailer_stops", {
  id: uuid("id").primaryKey().defaultRandom(),
  location: text("location").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  status: trailerStopStatusEnum("status").notNull().default("scheduled"),
  originalLocation: text("original_location"),
  originalLat: doublePrecision("original_lat"),
  originalLng: doublePrecision("original_lng"),
  originalStartTime: timestamp("original_start_time", { withTimezone: true }),
  originalEndTime: timestamp("original_end_time", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
