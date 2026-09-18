import { describe, it, expect } from "vitest";
import { DrizzleEmailLogRepository } from "./email-log-repository";

describe("DrizzleEmailLogRepository", () => {
  it("creates an entry and lists it back", async () => {
    const repo = new DrizzleEmailLogRepository();
    const created = await repo.create({
      to: `email-log-test-${Date.now()}@example.com`,
      type: "order_confirmation",
      locale: "en",
      status: "sent",
      errorMessage: null,
    });

    expect(created.id).toBeTruthy();
    expect(created.status).toBe("sent");

    const all = await repo.listAll();
    expect(all.some((entry) => entry.id === created.id)).toBe(true);
  });

  it("stores a blocked entry with its error message", async () => {
    const repo = new DrizzleEmailLogRepository();
    const created = await repo.create({
      to: `email-log-test-${Date.now()}@example.com`,
      type: "event_quote_receipt",
      locale: "es",
      status: "blocked",
      errorMessage: "SMTP is not configured yet",
    });

    expect(created.status).toBe("blocked");
    expect(created.errorMessage).toBe("SMTP is not configured yet");
  });
});
