import { pgTable, uuid, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const stockTemplatesTable = pgTable("stock_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stockTemplateItemsTable = pgTable(
  "stock_template_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id").notNull().references(() => stockTemplatesTable.id),
    productId: uuid("product_id").notNull().references(() => productsTable.id),
    quantity: integer("quantity").notNull(),
  },
  (t) => [unique().on(t.templateId, t.productId)],
);
