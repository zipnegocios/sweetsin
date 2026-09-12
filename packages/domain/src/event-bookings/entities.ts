export type EventBookingStatus = "quote_requested" | "quoted" | "confirmed" | "completed" | "cancelled";

export interface EventBookingItem {
  description: string;
  quantity: number;
  agreedUnitPriceCents: number;
}

export interface EventBooking {
  id: string;
  clientName: string;
  clientCompany: string | null;
  clientEmail: string;
  clientPhone: string;
  eventType: string;
  eventDate: Date;
  startTime: Date;
  endTime: Date;
  location: string;
  estimatedGuests: number;
  status: EventBookingStatus;
  notes: string | null;
  items: EventBookingItem[];
}
