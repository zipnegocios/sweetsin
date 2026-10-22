import { pgTable, uuid, doublePrecision, real, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const deliveryLocationsTable = pgTable("delivery_locations", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => usersTable.id),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  accuracyM: real("accuracy_m"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
});
