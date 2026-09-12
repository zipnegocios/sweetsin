export interface NotificationPort {
  sendOrderConfirmation(order: { customerEmail: string; totalCents: number; id: string }): Promise<void>;
  sendEventQuoteRequestReceipt(booking: { clientEmail: string; id: string }): Promise<void>;
}
