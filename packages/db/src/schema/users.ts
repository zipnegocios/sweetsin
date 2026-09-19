import { pgEnum, pgTable, uuid, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "despachador", "delivery", "customer"]);

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").unique(),
  role: userRoleEnum("role").notNull(),
  pinHash: text("pin_hash"),
  passwordHash: text("password_hash"),
  isActive: boolean("is_active").notNull().default(true),
  preferredLocale: text("preferred_locale").notNull().default("en"),
  failedPinAttempts: integer("failed_pin_attempts").notNull().default(0),
  pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
