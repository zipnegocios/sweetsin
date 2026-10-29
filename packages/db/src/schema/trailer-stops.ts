import { sql } from "drizzle-orm";
import { pgEnum, pgTable, uuid, text, doublePrecision, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const trailerStopStatusEnum = pgEnum("trailer_stop_status", [
  "scheduled",
  "active",
  "completed",
  "cancelled",
]);

export const ONE_OPEN_JORNADA_INDEX = "trailer_stops_one_open_jornada_idx";

export const trailerStopKindEnum = pgEnum("trailer_stop_kind", ["trailer", "delivery"]);

export const trailerStopsTable = pgTable("trailer_stops", {
  id: uuid("id").primaryKey().defaultRandom(),
  location: text("location").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  status: trailerStopStatusEnum("status").notNull().default("scheduled"),
  kind: trailerStopKindEnum("kind").notNull().default("trailer"),
  originalLocation: text("original_location"),
  originalLat: doublePrecision("original_lat"),
  originalLng: doublePrecision("original_lng"),
  originalStartTime: timestamp("original_start_time", { withTimezone: true }),
  originalEndTime: timestamp("original_end_time", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Una sola jornada de delivery abierta a la vez, garantizado por la DB (dos aperturas concurrentes).
  uniqueIndex(ONE_OPEN_JORNADA_INDEX).on(t.kind).where(sql`${t.kind} = 'delivery' and ${t.status} = 'active'`),
]);
