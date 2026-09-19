import { describe, it, expect, vi } from "vitest";
import { ExpoNotificationAdapter } from "./expo-notification-adapter";
import type { PushTokenRepository, PushLogRepository } from "@workspace/domain/notifications";

function makeDeps() {
  const sentPushes: unknown[] = [];
  const logs: unknown[] = [];
  const pushTokens: PushTokenRepository = {
    upsert: async () => {},
    findByUserId: async () => "ExponentPushToken[fake]",
    findByUserIds: async (ids) => ids.map((userId) => ({ userId, token: "ExponentPushToken[fake]" })),
  };
  const pushLogs: PushLogRepository = {
    create: async (entry) => {
      logs.push(entry);
      return { ...entry, id: "log-1", createdAt: new Date() };
    },
    listAll: async () => [],
  };
  return { pushTokens, pushLogs, sentPushes, logs };
}

describe("ExpoNotificationAdapter.notifyDeliveryAssigned", () => {
  it("loguea failed si el usuario no tiene push token registrado", async () => {
    const deps = makeDeps();
    deps.pushTokens.findByUserId = async () => null;
    const adapter = new ExpoNotificationAdapter(deps.pushTokens, deps.pushLogs);

    await adapter.notifyDeliveryAssigned("delivery-1", { id: "order-1", deliveryAddress: "Calle 123" });

    expect(deps.logs).toHaveLength(1);
    expect((deps.logs[0] as { status: string }).status).toBe("blocked");
  });
});
