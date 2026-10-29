import { index, pgEnum, pgTable, uuid, integer, text, timestamp } from "drizzle-orm/pg-core";
import { trailerStopsTable } from "./trailer-stops";
import { productsTable } from "./products";
import { usersTable } from "./users";
import { ordersTable } from "./orders";

export const stockEventTypeEnum = pgEnum("stock_event_type", ["sale", "waste", "early_sellout", "restock", "sale_reversal"]);

export const stopProductStockTable = pgTable("stop_product_stock", {
  id: uuid("id").primaryKey().defaultRandom(),
  stopId: uuid("stop_id").notNull().references(() => trailerStopsTable.id),
  productId: uuid("product_id").notNull().references(() => productsTable.id),
  maxStock: integer("max_stock").notNull(),
  currentStock: integer("current_stock").notNull(),
});

export const stockEventsTable = pgTable("stock_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  stopProductStockId: uuid("stop_product_stock_id")
    .notNull()
    .references(() => stopProductStockTable.id),
  eventType: stockEventTypeEnum("event_type").notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  orderId: uuid("order_id").references(() => ordersTable.id),
  reportedByUserId: uuid("reported_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("stock_events_order_id_idx").on(t.orderId)]);
