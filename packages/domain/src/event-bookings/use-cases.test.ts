import { describe, it, expect } from "vitest";
import { requestEventQuote } from "./use-cases";
import type { EventBooking } from "./entities";
import type { EventBookingRepository } from "./ports";

function fakeEventBookingRepo(): EventBookingRepository & { created: Omit<EventBooking, "id">[] } {
  const created: Omit<EventBooking, "id">[] = [];
  return {
    created,
    async create(booking) {
      created.push(booking);
      return { ...booking, id: `booking-${created.length}` };
    },
    async findOverlapping() {
      return [];
    },
  };
}

describe("requestEventQuote", () => {
  it("creates a booking with status quote_requested and no items by default", async () => {
    const repo = fakeEventBookingRepo();

    const booking = await requestEventQuote(repo, {
      clientName: "Acme Corp",
      clientCompany: "Acme",
      clientEmail: "events@acme.com",
      clientPhone: "+61400000000",
      eventType: "corporate",
      eventDate: new Date("2026-11-01"),
      startTime: new Date("2026-11-01T17:00:00Z"),
      endTime: new Date("2026-11-01T20:00:00Z"),
      location: "Adelaide CBD",
      estimatedGuests: 40,
      notes: null,
    });

    expect(booking.status).toBe("quote_requested");
    expect(booking.items).toEqual([]);
  });
});
