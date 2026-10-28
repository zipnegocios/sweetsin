import { pgEnum, pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";
import { usersTable } from "./users";

export const orderEventKindEnum = pgEnum("order_event_kind", ["fulfillment", "payment"]);
export const orderEventSourceEnum = pgEnum("order_event_source", ["web", "mobile", "webhook", "system"]);

export const orderStatusEventsTable = pgTable(
  "order_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => ordersTable.id),
    kind: orderEventKindEnum("kind").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    actorUserId: uuid("actor_user_id").references(() => usersTable.id),
    source: orderEventSourceEnum("source").notNull(),
  },
  (t) => [index("order_status_events_order_id_idx").on(t.orderId)],
);
