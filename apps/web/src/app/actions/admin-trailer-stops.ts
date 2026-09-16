"use server";

import { listAllTrailerStops, createTrailerStop, completeTrailerStop, cancelTrailerStop } from "@workspace/domain/trailer-stops";
import type { TrailerStop } from "@workspace/domain/trailer-stops";
import { initializeStopStock } from "@workspace/domain/stock";
import { DrizzleTrailerStopRepository, DrizzleStockRepository, DrizzleEventBookingRepository } from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";

export async function listTrailerStopsAction(): Promise<TrailerStop[]> {
  await requireAdmin();
  return listAllTrailerStops(new DrizzleTrailerStopRepository());
}

export async function checkStopOverlapAction(
  startTime: string,
  endTime: string,
): Promise<{ clientName: string; eventDate: string }[]> {
  await requireAdmin();
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const overlapping = await new DrizzleEventBookingRepository().findOverlapping(start, start, end);
  return overlapping.map((b) => ({ clientName: b.clientName, eventDate: b.eventDate.toISOString() }));
}

export interface CreateTrailerStopInput {
  location: string;
  lat: number;
  lng: number;
  startTime: string;
  endTime: string;
  products: { productId: string; maxStock: number }[];
}

export async function createTrailerStopAction(input: CreateTrailerStopInput): Promise<TrailerStop> {
  await requireAdmin();
  const stop = await createTrailerStop(new DrizzleTrailerStopRepository(), {
    location: input.location,
    lat: input.lat,
    lng: input.lng,
    startTime: new Date(input.startTime),
    endTime: new Date(input.endTime),
  });

  if (input.products.length > 0) {
    await initializeStopStock(new DrizzleStockRepository(), stop.id, input.products);
  }

  return stop;
}

export async function completeTrailerStopAction(id: string): Promise<void> {
  await requireAdmin();
  await completeTrailerStop(new DrizzleTrailerStopRepository(), id);
}

export async function cancelTrailerStopAction(id: string): Promise<void> {
  await requireAdmin();
  await cancelTrailerStop(new DrizzleTrailerStopRepository(), id);
}
