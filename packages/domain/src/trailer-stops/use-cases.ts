import type { TrailerStopRepository } from "./ports";
import type { TrailerStop } from "./entities";
import type { OrderRepository, TransitionContext } from "../orders/ports";
import type { StockRepository } from "../stock/ports";
import type { StopStockSummary } from "../stock/entities";

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
      "Only scheduled stops can be opened",
      "Only active stops can be closed",
      "Stop has undelivered orders",
      "Stop has paid orders",
      "Active stops must be closed",
      "A jornada is already open",
      "Only open jornadas can be closed",
    ].includes(message) ||
    message.startsWith("Cannot complete a ") ||
    message.startsWith("Another stop is active")
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

// Una jornada de delivery (kind "delivery") no es una parada del trailer: para estos casos de uso no existe.
// Las funciones de stock no lo usan porque se reutilizan para las jornadas.
async function requireStop(repo: TrailerStopRepository, id: string): Promise<TrailerStop> {
  const stop = await repo.findById(id);
  if (!stop || stop.kind !== "trailer") throw new Error("Stop not found");
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
  if (stop.status === "active") throw new Error("Active stops must be closed");
  await repo.updateStatus(id, "completed");
}

export async function openTrailerStop(
  deps: { stops: TrailerStopRepository },
  id: string,
  options: { allowMultipleActive: boolean },
): Promise<void> {
  const stop = await requireStop(deps.stops, id);
  if (stop.status === "active") return;
  if (stop.status !== "scheduled") throw new Error("Only scheduled stops can be opened");
  if (!options.allowMultipleActive) {
    const other = (await deps.stops.listAll()).find((s) => s.status === "active" && s.id !== id);
    if (other) throw new Error(`Another stop is active: ${other.location}`);
  }
  await deps.stops.updateStatus(id, "active");
}

export async function getStopCloseSummary(
  deps: { stock: StockRepository; orders: OrderRepository },
  stopId: string,
): Promise<{ products: StopStockSummary[]; undeliveredOrders: number }> {
  const [products, undeliveredOrders] = await Promise.all([
    deps.stock.summarizeByStop(stopId),
    deps.orders.countUndeliveredForStop(stopId),
  ]);
  return { products, undeliveredOrders };
}

export async function closeTrailerStop(
  deps: { stops: TrailerStopRepository; orders: OrderRepository },
  id: string,
  options: { confirmUndelivered: boolean },
): Promise<void> {
  const stop = await requireStop(deps.stops, id);
  if (stop.status !== "active") throw new Error("Only active stops can be closed");
  if (!options.confirmUndelivered && (await deps.orders.countUndeliveredForStop(id)) > 0) {
    throw new Error("Stop has undelivered orders");
  }
  await deps.stops.updateStatus(id, "completed");
}

export async function cancelTrailerStop(
  deps: { stops: TrailerStopRepository; orders: OrderRepository },
  id: string,
  ctx?: TransitionContext,
): Promise<void> {
  const stop = await requireStop(deps.stops, id);
  if (stop.status !== "scheduled") throw new Error("Only scheduled stops can be cancelled");
  if ((await deps.orders.countPaidUndeliveredForStop(id)) > 0) throw new Error("Stop has paid orders");
  await deps.orders.cancelPendingOrdersForStop(id, ctx);
  await deps.stops.updateStatus(id, "cancelled");
}

export async function reactivateTrailerStop(repo: TrailerStopRepository, id: string): Promise<void> {
  const stop = await requireStop(repo, id);
  if (stop.status !== "cancelled") throw new Error("Only cancelled stops can be reactivated");
  await repo.updateStatus(id, "scheduled");
}

export async function deleteTrailerStop(repo: TrailerStopRepository, id: string): Promise<void> {
  await requireStop(repo, id);
  if ((await repo.countOrders(id)) > 0) throw new Error("Stop has orders");
  await repo.deleteWithStock(id);
}
