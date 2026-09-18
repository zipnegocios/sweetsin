import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const emailLogsTable = pgTable("email_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  to: text("to").notNull(),
  type: text("type").notNull(),
  locale: text("locale").notNull(),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
