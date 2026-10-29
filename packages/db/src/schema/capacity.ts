import { pgTable, pgEnum, uuid, integer, boolean, text, timestamp, unique } from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const prepStepModeEnum = pgEnum("prep_step_mode", ["per_batch", "per_unit"]);

export const productCapacityRulesTable = pgTable("product_capacity_rules", {
  productId: uuid("product_id").primaryKey().references(() => productsTable.id),
  soldOnline: boolean("sold_online").notNull().default(true),
  deliveryMaxQty: integer("delivery_max_qty"),
  leadTimeMinutes: integer("lead_time_minutes"),
  batchUnits: integer("batch_units"),
  batchSeconds: integer("batch_seconds"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const productPrepStepsTable = pgTable(
  "product_prep_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull().references(() => productsTable.id),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    seconds: integer("seconds").notNull(),
    mode: prepStepModeEnum("mode").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.productId, t.position)],
);
