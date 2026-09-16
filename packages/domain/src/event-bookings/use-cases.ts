import type { EventBookingRepository } from "./ports";
import type { EventBooking, EventBookingItem } from "./entities";

type RequestEventQuoteInput = Omit<EventBooking, "id" | "status" | "items"> & {
  items?: EventBookingItem[];
};

export async function requestEventQuote(
  repo: EventBookingRepository,
  input: RequestEventQuoteInput,
): Promise<EventBooking> {
  return repo.create({
    ...input,
    status: "quote_requested",
    items: input.items ?? [],
  });
}

export async function quoteEventBooking(repo: EventBookingRepository, id: string): Promise<void> {
  await repo.updateStatus(id, "quoted");
}

export async function confirmEventBooking(repo: EventBookingRepository, id: string): Promise<void> {
  const booking = await repo.findById(id);
  if (!booking) throw new Error(`Event booking not found: ${id}`);
  if (booking.location === "TBD") {
    throw new Error("Cannot confirm a booking with location still TBD");
  }
  await repo.updateStatus(id, "confirmed");
}

export async function cancelEventBooking(repo: EventBookingRepository, id: string): Promise<void> {
  await repo.updateStatus(id, "cancelled");
}

export async function completeEventBooking(repo: EventBookingRepository, id: string): Promise<void> {
  await repo.updateStatus(id, "completed");
}

export async function addEventBookingItem(
  repo: EventBookingRepository,
  eventBookingId: string,
  item: EventBookingItem,
): Promise<EventBooking> {
  return repo.addItem(eventBookingId, item);
}

export async function updateEventBookingDetails(
  repo: EventBookingRepository,
  id: string,
  fields: Partial<Pick<EventBooking, "location" | "startTime" | "endTime" | "estimatedGuests" | "notes">>,
): Promise<void> {
  await repo.update(id, fields);
}
