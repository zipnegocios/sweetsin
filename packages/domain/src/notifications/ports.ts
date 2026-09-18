import type { Locale } from "../shared";
import type { EmailLog } from "./entities";

export interface NotificationPort {
  sendOrderConfirmation(order: { customerEmail: string; totalCents: number; id: string }, locale: Locale): Promise<void>;
  sendEventQuoteRequestReceipt(booking: { clientEmail: string; id: string }, locale: Locale): Promise<void>;
}

export interface EmailLogRepository {
  create(entry: Omit<EmailLog, "id" | "createdAt">): Promise<EmailLog>;
  listAll(): Promise<EmailLog[]>;
}
