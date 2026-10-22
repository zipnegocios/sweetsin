import type { UserRepository } from "../users";
import type { DeliveryLocationRepository } from "./ports";

const MAX_FUTURE_MS = 60_000;
const MAX_AGE_MS = 10 * 60_000;

export async function recordDeliveryLocation(
  deps: { locations: DeliveryLocationRepository; users: UserRepository },
  input: { userId: string; lat: number; lng: number; accuracyMeters: number | null; recordedAt: Date },
  now: Date = new Date(),
): Promise<void> {
  const user = await deps.users.findById(input.userId);
  if (!user || user.role !== "delivery" || !user.isActive) {
    throw new Error("Only an active delivery user can record a location");
  }
  if (!(input.lat >= -90 && input.lat <= 90)) throw new Error("Latitude out of range");
  if (!(input.lng >= -180 && input.lng <= 180)) throw new Error("Longitude out of range");
  const age = now.getTime() - input.recordedAt.getTime();
  if (!(age >= -MAX_FUTURE_MS)) throw new Error("Location timestamp is in the future");
  if (!(age <= MAX_AGE_MS)) throw new Error("Location timestamp is too old");
  await deps.locations.upsert(input);
}

export async function endDeliveryShift(deps: { locations: DeliveryLocationRepository }, userId: string): Promise<void> {
  await deps.locations.remove(userId);
}
