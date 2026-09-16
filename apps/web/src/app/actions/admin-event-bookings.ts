"use server";

import {
  quoteEventBooking,
  confirmEventBooking,
  cancelEventBooking,
  completeEventBooking,
  addEventBookingItem,
  updateEventBookingDetails,
} from "@workspace/domain/event-bookings";
import type { EventBooking, EventBookingStatus } from "@workspace/domain/event-bookings";
import { DrizzleEventBookingRepository } from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";

export async function listEventBookingsAction(status?: EventBookingStatus): Promise<EventBooking[]> {
  await requireAdmin();
  return new DrizzleEventBookingRepository().listAll(status ? { status } : undefined);
}

export async function quoteEventBookingAction(id: string): Promise<void> {
  await requireAdmin();
  await quoteEventBooking(new DrizzleEventBookingRepository(), id);
}

export async function confirmEventBookingAction(id: string): Promise<{ error: string } | { ok: true }> {
  await requireAdmin();
  try {
    await confirmEventBooking(new DrizzleEventBookingRepository(), id);
    return { ok: true };
  } catch {
    return { error: "location_tbd" };
  }
}

export async function cancelEventBookingAction(id: string): Promise<void> {
  await requireAdmin();
  await cancelEventBooking(new DrizzleEventBookingRepository(), id);
}

export async function completeEventBookingAction(id: string): Promise<void> {
  await requireAdmin();
  await completeEventBooking(new DrizzleEventBookingRepository(), id);
}

export async function addEventBookingItemAction(
  id: string,
  item: { description: string; quantity: number; agreedUnitPriceCents: number },
): Promise<void> {
  await requireAdmin();
  await addEventBookingItem(new DrizzleEventBookingRepository(), id, item);
}

export interface UpdateEventBookingDetailsInput {
  location?: string;
  startTime?: string;
  endTime?: string;
  estimatedGuests?: number;
  notes?: string | null;
}

export async function updateEventBookingDetailsAction(id: string, fields: UpdateEventBookingDetailsInput): Promise<void> {
  await requireAdmin();
  await updateEventBookingDetails(new DrizzleEventBookingRepository(), id, {
    ...fields,
    startTime: fields.startTime ? new Date(fields.startTime) : undefined,
    endTime: fields.endTime ? new Date(fields.endTime) : undefined,
  });
}
