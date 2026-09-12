import type { EventBooking } from "./entities";

export interface EventBookingRepository {
  create(booking: Omit<EventBooking, "id">): Promise<EventBooking>;
  findOverlapping(eventDate: Date, startTime: Date, endTime: Date): Promise<EventBooking[]>;
}
