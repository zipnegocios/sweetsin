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

describe("ExpoNotificationAdapter.notifyNewOrderInQueue", () => {
  it("loguea blocked para un despachador de la lista que no tiene push token", async () => {
    const deps = makeDeps();
    deps.pushTokens.findByUserIds = async (ids) =>
      ids.filter((id) => id !== "despachador-2").map((userId) => ({ userId, token: "ExponentPushToken[fake]" }));
    const adapter = new ExpoNotificationAdapter(deps.pushTokens, deps.pushLogs);

    await adapter.notifyNewOrderInQueue(["despachador-1", "despachador-2"], {
      id: "order-1",
      customerName: "Juan",
    });

    const blockedLog = deps.logs.find((log) => (log as { to: string }).to === "despachador-2") as
      | { status: string; errorMessage: string | null }
      | undefined;
    expect(blockedLog).toBeDefined();
    expect(blockedLog?.status).toBe("blocked");
    expect(blockedLog?.errorMessage).toBe("No push token registered");
  });
});

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
