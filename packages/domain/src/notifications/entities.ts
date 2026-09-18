import type { Locale } from "../shared";

export type EmailLogType = "order_confirmation" | "event_quote_receipt";
export type EmailLogStatus = "sent" | "failed" | "blocked";

export interface EmailLog {
  id: string;
  to: string;
  type: EmailLogType;
  locale: Locale;
  status: EmailLogStatus;
  errorMessage: string | null;
  createdAt: Date;
}
