import type { EventBooking, EventBookingStatus, EventBookingItem } from "./entities";

export interface EventBookingRepository {
  create(booking: Omit<EventBooking, "id">): Promise<EventBooking>;
  findOverlapping(eventDate: Date, startTime: Date, endTime: Date): Promise<EventBooking[]>;
  findById(id: string): Promise<EventBooking | null>;
  listAll(filters?: { status?: EventBookingStatus }): Promise<EventBooking[]>;
  updateStatus(id: string, status: EventBookingStatus): Promise<void>;
  addItem(eventBookingId: string, item: EventBookingItem): Promise<EventBooking>;
  update(id: string, fields: Partial<Pick<EventBooking, "location" | "startTime" | "endTime" | "estimatedGuests" | "notes">>): Promise<void>;
}
