import { describe, it, expect } from "vitest";
import { ExpoNotificationAdapter } from "./expo-notification-adapter";

describe("ExpoNotificationAdapter", () => {
  it("is not implemented until Phase 7", async () => {
    const adapter = new ExpoNotificationAdapter();
    await expect(
      adapter.sendOrderConfirmation({ customerEmail: "a@example.com", totalCents: 1000, id: "order-1" }, "en"),
    ).rejects.toThrow("Not implemented until Phase 7");
  });
});
