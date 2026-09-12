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
