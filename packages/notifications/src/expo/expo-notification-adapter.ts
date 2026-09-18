import type { NotificationPort } from "@workspace/domain/notifications";

// Scaffold sin consumidor real — Fase 7 registra tokens de dispositivo y
// conecta esta clase. Cada método lanza a propósito para no simular un
// envío que todavía no puede pasar.
export class ExpoNotificationAdapter implements NotificationPort {
  async sendOrderConfirmation(): Promise<void> {
    throw new Error("Not implemented until Phase 7");
  }

  async sendEventQuoteRequestReceipt(): Promise<void> {
    throw new Error("Not implemented until Phase 7");
  }
}
