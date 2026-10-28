import type { TrailerStopRepository } from "./ports";
import type { TrailerStop } from "./entities";

interface StopInput {
  location: string;
  lat: number;
  lng: number;
  startTime: Date;
  endTime: Date;
}

// Mensajes de reglas de negocio que la capa web traduce a 409 (el resto es un error inesperado).
export function isStopConflictMessage(message: string): boolean {
  return (
    [
      "Invalid date",
      "startTime must be before endTime",
      "Completed stops cannot be edited",
      "Only scheduled stops can be cancelled",
      "Only cancelled stops can be reactivated",
      "Stop has orders",
    ].includes(message) || message.startsWith("Cannot complete a ")
  );
}

// Granularidad de minuto: segundos/ms nunca cuentan como cambio de horario (R7).
const minute = (d: Date): number => Math.floor(d.getTime() / 60000);

function assertValidRange({ startTime, endTime }: StopInput): void {
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) throw new Error("Invalid date");
  if (startTime >= endTime) throw new Error("startTime must be before endTime");
}

export function listVisibleTrailerStops(repo: TrailerStopRepository): Promise<TrailerStop[]> {
  return repo.listVisible();
}

export function listAllTrailerStops(repo: TrailerStopRepository): Promise<TrailerStop[]> {
  return repo.listAll();
}

export async function createTrailerStop(repo: TrailerStopRepository, input: StopInput): Promise<TrailerStop> {
  assertValidRange(input);
  return repo.create({ ...input, status: "scheduled" });
}

async function requireStop(repo: TrailerStopRepository, id: string): Promise<TrailerStop> {
  const stop = await repo.findById(id);
  if (!stop) throw new Error("Stop not found");
  return stop;
}

export async function updateTrailerStop(
  repo: TrailerStopRepository,
  id: string,
  input: StopInput,
): Promise<TrailerStop> {
  const stop = await requireStop(repo, id);
  if (stop.status === "completed") throw new Error("Completed stops cannot be edited");
  assertValidRange(input);

  const changed =
    input.location !== stop.location ||
    input.lat !== stop.lat ||
    input.lng !== stop.lng ||
    minute(input.startTime) !== minute(stop.startTime) ||
    minute(input.endTime) !== minute(stop.endTime);

  const patch: Partial<Omit<TrailerStop, "id">> = { ...input };
  if (changed && stop.originalLocation === null) {
    patch.originalLocation = stop.location;
    patch.originalLat = stop.lat;
    patch.originalLng = stop.lng;
    patch.originalStartTime = stop.startTime;
    patch.originalEndTime = stop.endTime;
  }
  await repo.update(id, patch);
  return { ...stop, ...patch };
}

export function getStopChanges(stop: TrailerStop): { locationChanged: boolean; dateChanged: boolean } {
  return {
    locationChanged: stop.originalLocation !== null && stop.location !== stop.originalLocation,
    dateChanged:
      (stop.originalStartTime !== null && minute(stop.startTime) !== minute(stop.originalStartTime)) ||
      (stop.originalEndTime !== null && minute(stop.endTime) !== minute(stop.originalEndTime)),
  };
}

export async function completeTrailerStop(repo: TrailerStopRepository, id: string): Promise<void> {
  const stop = await requireStop(repo, id);
  if (stop.status === "cancelled" || stop.status === "completed") {
    throw new Error(`Cannot complete a ${stop.status} stop`);
  }
  await repo.updateStatus(id, "completed");
}

export async function cancelTrailerStop(repo: TrailerStopRepository, id: string): Promise<void> {
  const stop = await requireStop(repo, id);
  if (stop.status !== "scheduled") throw new Error("Only scheduled stops can be cancelled");
  await repo.updateStatus(id, "cancelled");
}

export async function reactivateTrailerStop(repo: TrailerStopRepository, id: string): Promise<void> {
  const stop = await requireStop(repo, id);
  if (stop.status !== "cancelled") throw new Error("Only cancelled stops can be reactivated");
  await repo.updateStatus(id, "scheduled");
}

export async function deleteTrailerStop(repo: TrailerStopRepository, id: string): Promise<void> {
  if ((await repo.countOrders(id)) > 0) throw new Error("Stop has orders");
  await repo.deleteWithStock(id);
}
