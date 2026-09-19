import { Expo } from "expo-server-sdk";
import type { NotificationPort } from "@workspace/domain/notifications";
import type {
  StaffNotificationPort,
  PushTokenRepository,
  PushLogRepository,
} from "@workspace/domain/notifications";
import type { Locale } from "@workspace/domain/shared";

const expo = new Expo();

export class ExpoNotificationAdapter implements NotificationPort, StaffNotificationPort {
  constructor(
    private readonly pushTokens: PushTokenRepository,
    private readonly pushLogs: PushLogRepository,
  ) {}

  async sendOrderConfirmation(
    order: { customerEmail: string; totalCents: number; id: string },
    locale: Locale,
  ): Promise<void> {
    throw new Error("Not implemented — customer push notifications are out of scope for Phase 7");
  }

  async sendEventQuoteRequestReceipt(booking: { clientEmail: string; id: string }, locale: Locale): Promise<void> {
    throw new Error("Not implemented — customer push notifications are out of scope for Phase 7");
  }

  async notifyNewOrderInQueue(
    despachadorUserIds: string[],
    order: { id: string; customerName: string },
  ): Promise<void> {
    const tokens = await this.pushTokens.findByUserIds(despachadorUserIds);
    const tokenByUserId = new Map(tokens.map(({ userId, token }) => [userId, token]));
    for (const userId of despachadorUserIds) {
      const token = tokenByUserId.get(userId);
      if (!token) {
        await this.pushLogs.create({
          to: userId,
          type: "new_order_in_queue",
          status: "blocked",
          errorMessage: "No push token registered",
        });
        continue;
      }
      await this.sendOne(userId, token, "new_order_in_queue", {
        title: "Nueva orden en cola",
        body: `Pedido de ${order.customerName} listo para preparar`,
      });
    }
  }

  async notifyDeliveryAssigned(
    deliveryUserId: string,
    order: { id: string; deliveryAddress: string | null },
  ): Promise<void> {
    const token = await this.pushTokens.findByUserId(deliveryUserId);
    if (!token) {
      await this.pushLogs.create({ to: deliveryUserId, type: "delivery_assigned", status: "blocked", errorMessage: "No push token registered" });
      return;
    }
    await this.sendOne(deliveryUserId, token, "delivery_assigned", {
      title: "Entrega asignada",
      body: order.deliveryAddress ? `Entregar en ${order.deliveryAddress}` : "Nueva entrega asignada",
    });
  }

  private async sendOne(
    userId: string,
    token: string,
    type: "new_order_in_queue" | "delivery_assigned",
    message: { title: string; body: string },
  ): Promise<void> {
    if (!Expo.isExpoPushToken(token)) {
      await this.pushLogs.create({ to: userId, type, status: "blocked", errorMessage: "Invalid Expo push token" });
      return;
    }
    try {
      await expo.sendPushNotificationsAsync([{ to: token, ...message }]);
      await this.pushLogs.create({ to: userId, type, status: "sent", errorMessage: null });
    } catch (error) {
      await this.pushLogs.create({
        to: userId,
        type,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
