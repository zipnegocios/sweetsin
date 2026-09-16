import { describe, it, expect } from "vitest";
import {
  requestEventQuote,
  quoteEventBooking,
  confirmEventBooking,
  cancelEventBooking,
  completeEventBooking,
  addEventBookingItem,
  updateEventBookingDetails,
} from "./use-cases";
import type { EventBooking } from "./entities";
import type { EventBookingRepository } from "./ports";

function fakeBooking(overrides: Partial<EventBooking> = {}): EventBooking {
  return {
    id: "booking1",
    clientName: "Acme Corp",
    clientCompany: "Acme",
    clientEmail: "events@acme.com",
    clientPhone: "+61400000000",
    eventType: "corporate",
    eventDate: new Date("2026-11-01"),
    startTime: new Date("2026-11-01T17:00:00Z"),
    endTime: new Date("2026-11-01T20:00:00Z"),
    location: "TBD",
    estimatedGuests: 40,
    status: "quote_requested",
    notes: null,
    items: [],
    ...overrides,
  };
}

function fakeEventBookingRepo(
  bookings: EventBooking[] = [],
): EventBookingRepository & { created: Omit<EventBooking, "id">[] } {
  const created: Omit<EventBooking, "id">[] = [];
  return {
    created,
    async create(booking) {
      created.push(booking);
      const inserted = { ...booking, id: `booking-${created.length}` };
      bookings.push(inserted);
      return inserted;
    },
    async findOverlapping() {
      return [];
    },
    async findById(id) {
      return bookings.find((b) => b.id === id) ?? null;
    },
    async listAll(filters) {
      if (filters?.status) return bookings.filter((b) => b.status === filters.status);
      return bookings;
    },
    async updateStatus(id, status) {
      const booking = bookings.find((b) => b.id === id);
      if (booking) booking.status = status;
    },
    async addItem(eventBookingId, item) {
      const booking = bookings.find((b) => b.id === eventBookingId);
      if (!booking) throw new Error("not found");
      booking.items.push(item);
      return booking;
    },
    async update(id, fields) {
      const booking = bookings.find((b) => b.id === id);
      if (booking) Object.assign(booking, fields);
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

describe("quoteEventBooking", () => {
  it("moves a booking to status quoted", async () => {
    const repo = fakeEventBookingRepo([fakeBooking({ id: "b1", status: "quote_requested" })]);

    await quoteEventBooking(repo, "b1");

    expect((await repo.findById("b1"))?.status).toBe("quoted");
  });
});

describe("confirmEventBooking", () => {
  it("moves a booking to status confirmed when location is defined", async () => {
    const repo = fakeEventBookingRepo([fakeBooking({ id: "b1", status: "quoted", location: "Adelaide CBD" })]);

    await confirmEventBooking(repo, "b1");

    expect((await repo.findById("b1"))?.status).toBe("confirmed");
  });

  it("throws when trying to confirm a booking with location still TBD", async () => {
    const repo = fakeEventBookingRepo([fakeBooking({ id: "b1", status: "quoted", location: "TBD" })]);

    await expect(confirmEventBooking(repo, "b1")).rejects.toThrow(
      "Cannot confirm a booking with location still TBD",
    );
    expect((await repo.findById("b1"))?.status).toBe("quoted");
  });

  it("throws when the booking does not exist", async () => {
    const repo = fakeEventBookingRepo([]);

    await expect(confirmEventBooking(repo, "missing")).rejects.toThrow("Event booking not found: missing");
  });
});

describe("cancelEventBooking / completeEventBooking", () => {
  it("cancels a booking", async () => {
    const repo = fakeEventBookingRepo([fakeBooking({ id: "b1", status: "quoted" })]);

    await cancelEventBooking(repo, "b1");

    expect((await repo.findById("b1"))?.status).toBe("cancelled");
  });

  it("completes a booking", async () => {
    const repo = fakeEventBookingRepo([fakeBooking({ id: "b1", status: "confirmed" })]);

    await completeEventBooking(repo, "b1");

    expect((await repo.findById("b1"))?.status).toBe("completed");
  });
});

describe("addEventBookingItem", () => {
  it("appends an item to the booking", async () => {
    const repo = fakeEventBookingRepo([fakeBooking({ id: "b1" })]);

    const updated = await addEventBookingItem(repo, "b1", {
      description: "Custom dessert platter",
      quantity: 40,
      agreedUnitPriceCents: 1200,
    });

    expect(updated.items).toEqual([
      { description: "Custom dessert platter", quantity: 40, agreedUnitPriceCents: 1200 },
    ]);
  });
});

describe("updateEventBookingDetails", () => {
  it("updates location, schedule and guest count", async () => {
    const repo = fakeEventBookingRepo([fakeBooking({ id: "b1", location: "TBD" })]);

    await updateEventBookingDetails(repo, "b1", {
      location: "Adelaide Hills Winery",
      startTime: new Date("2026-11-01T18:00:00Z"),
      endTime: new Date("2026-11-01T23:00:00Z"),
      estimatedGuests: 60,
    });

    const updated = await repo.findById("b1");
    expect(updated?.location).toBe("Adelaide Hills Winery");
    expect(updated?.estimatedGuests).toBe(60);
  });
});
