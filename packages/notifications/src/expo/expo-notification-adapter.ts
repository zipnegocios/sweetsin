import type { NotificationPort } from "@workspace/domain/notifications";
import type { Locale } from "@workspace/domain/shared";

// Scaffold sin consumidor real — Fase 7 registra tokens de dispositivo y
// conecta esta clase. Cada método lanza a propósito para no simular un
// envío que todavía no puede pasar.
export class ExpoNotificationAdapter implements NotificationPort {
  async sendOrderConfirmation(
    order: { customerEmail: string; totalCents: number; id: string },
    locale: Locale,
  ): Promise<void> {
    throw new Error("Not implemented until Phase 7");
  }

  async sendEventQuoteRequestReceipt(booking: { clientEmail: string; id: string }, locale: Locale): Promise<void> {
    throw new Error("Not implemented until Phase 7");
  }
}
