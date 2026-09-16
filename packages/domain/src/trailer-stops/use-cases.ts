import type { TrailerStopRepository } from "./ports";
import type { TrailerStop } from "./entities";

export function listActiveTrailerStops(repo: TrailerStopRepository): Promise<TrailerStop[]> {
  return repo.listActive();
}

export async function createTrailerStop(
  repo: TrailerStopRepository,
  input: { location: string; lat: number; lng: number; startTime: Date; endTime: Date },
): Promise<TrailerStop> {
  if (input.startTime >= input.endTime) {
    throw new Error("startTime must be before endTime");
  }
  return repo.create({ ...input, status: "scheduled" });
}

export async function completeTrailerStop(repo: TrailerStopRepository, id: string): Promise<void> {
  await repo.updateStatus(id, "completed");
}

export async function cancelTrailerStop(repo: TrailerStopRepository, id: string): Promise<void> {
  await repo.updateStatus(id, "cancelled");
}
