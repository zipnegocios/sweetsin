import { pgEnum, pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { trailerStopsTable } from "./trailer-stops";
import { productsTable } from "./products";

export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid", "failed", "refunded"]);

export const fulfillmentStatusEnum = pgEnum("fulfillment_status", [
  "pending",
  "received",
  "in_prep",
  "ready_for_pickup",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);

export const fulfillmentTypeEnum = pgEnum("fulfillment_type", ["pickup", "self_delivery"]);
export const orderChannelEnum = pgEnum("order_channel", ["web", "whatsapp"]);

export const ordersTable = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => usersTable.id),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  fulfillmentType: fulfillmentTypeEnum("fulfillment_type").notNull(),
  deliveryAddress: text("delivery_address"),
  stopId: uuid("stop_id").references(() => trailerStopsTable.id),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  fulfillmentStatus: fulfillmentStatusEnum("fulfillment_status").notNull().default("pending"),
  subtotalCents: integer("subtotal_cents").notNull(),
  discountCents: integer("discount_cents").notNull().default(0),
  deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  channel: orderChannelEnum("channel").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const orderItemsTable = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => ordersTable.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => productsTable.id),
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  lineDiscountCents: integer("line_discount_cents").notNull().default(0),
});
