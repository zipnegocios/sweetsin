import { pgEnum, pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "despachador", "delivery", "customer"]);

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").unique(),
  role: userRoleEnum("role").notNull(),
  pinHash: text("pin_hash"),
  passwordHash: text("password_hash"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
