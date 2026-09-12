import { pgEnum, pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const productCategoryEnum = pgEnum("product_category", ["sin", "virtue", "coffee"]);

export const productsTable = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  category: productCategoryEnum("category").notNull(),
  nameEn: text("name_en").notNull(),
  nameEs: text("name_es").notNull(),
  descriptionEn: text("description_en").notNull(),
  descriptionEs: text("description_es").notNull(),
  priceCents: integer("price_cents").notNull(),
  imageUrl: text("image_url"),
  featured: boolean("featured").notNull().default(false),
  available: boolean("available").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
