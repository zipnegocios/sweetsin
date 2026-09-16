// packages/db/src/repositories/event-booking-repository.test.ts
import { describe, it, expect } from "vitest";
import { requestEventQuote } from "@workspace/domain/event-bookings";
import { DrizzleEventBookingRepository } from "./event-booking-repository";

describe("DrizzleEventBookingRepository", () => {
  it("creates a booking, finds it by id, lists it, updates its status and adds an item", async () => {
    const repo = new DrizzleEventBookingRepository();

    const booking = await requestEventQuote(repo, {
      clientName: "Integration Test Client",
      clientCompany: null,
      clientEmail: `event-test-${Date.now()}@example.com`,
      clientPhone: "+61400000005",
      eventType: "wedding",
      eventDate: new Date("2026-12-01"),
      startTime: new Date("2026-12-01T15:00:00Z"),
      endTime: new Date("2026-12-01T22:00:00Z"),
      location: "Adelaide Hills",
      estimatedGuests: 80,
      notes: null,
    });

    const found = await repo.findById(booking.id);
    expect(found?.clientName).toBe("Integration Test Client");

    const all = await repo.listAll({ status: "quote_requested" });
    expect(all.some((b) => b.id === booking.id)).toBe(true);

    await repo.updateStatus(booking.id, "quoted");
    expect((await repo.findById(booking.id))?.status).toBe("quoted");

    const withItem = await repo.addItem(booking.id, {
      description: "Wedding cake tier",
      quantity: 1,
      agreedUnitPriceCents: 25000,
    });
    expect(withItem.items).toEqual([
      { description: "Wedding cake tier", quantity: 1, agreedUnitPriceCents: 25000 },
    ]);

    await repo.update(booking.id, { location: "Adelaide Hills Winery", estimatedGuests: 100 });
    const updated = await repo.findById(booking.id);
    expect(updated?.location).toBe("Adelaide Hills Winery");
    expect(updated?.estimatedGuests).toBe(100);
  });
});
