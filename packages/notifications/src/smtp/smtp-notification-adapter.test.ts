import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SmtpNotificationAdapter } from "./smtp-notification-adapter";
import { SmtpNotConfiguredError } from "./errors";

const ENV_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"] as const;

describe("SmtpNotificationAdapter", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it("throws SmtpNotConfiguredError when SMTP env vars are missing", async () => {
    const adapter = new SmtpNotificationAdapter();

    await expect(
      adapter.sendOrderConfirmation({ customerEmail: "a@example.com", totalCents: 1000, id: "order-1" }, "en"),
    ).rejects.toThrow(SmtpNotConfiguredError);
  });

  it("does not throw at construction time even without env vars", () => {
    expect(() => new SmtpNotificationAdapter()).not.toThrow();
  });
});
