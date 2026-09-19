import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const pushLogsTable = pgTable("push_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  to: text("to").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
