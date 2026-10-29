import type { TrailerStopRepository } from "../trailer-stops/ports";
import type { TrailerStop } from "../trailer-stops/entities";
import type { AppSettings } from "../settings";

const JORNADA_HOURS = 24;

/**
 * Una jornada es una parada `kind: "delivery"`. Ubicación y horario son placeholders
 * (no se muestran): la jornada vive mientras está `active`, hasta que se cierra.
 */
export async function openJornada(
  deps: { stops: TrailerStopRepository },
  input: { name?: string },
  now: Date,
): Promise<TrailerStop> {
  const open = (await deps.stops.listAll("delivery")).some((s) => s.status === "active");
  if (open) throw new Error("A jornada is already open");
  return deps.stops.create({
    location: input.name?.trim() || "Delivery",
    lat: 0,
    lng: 0,
    startTime: now,
    endTime: new Date(now.getTime() + JORNADA_HOURS * 3_600_000),
    status: "active",
    kind: "delivery",
  });
}

/** Cierra la jornada; los pedidos ya pagados siguen su reparto, los nuevos se rechazan. */
export async function closeJornada(deps: { stops: TrailerStopRepository }, id: string): Promise<void> {
  const stop = await deps.stops.findById(id);
  // Una parada del trailer no es una jornada: para este caso de uso no existe.
  if (!stop || stop.kind !== "delivery") throw new Error("Stop not found");
  if (stop.status !== "active") throw new Error("Only open jornadas can be closed");
  await deps.stops.updateStatus(id, "completed");
}

/**
 * Descarta una jornada recién abierta cuya carga de stock falló (compensación: abrir y cargar
 * stock no son una transacción). Solo una jornada sin pedidos; borra también su stock parcial.
 */
export async function discardJornada(deps: { stops: TrailerStopRepository }, id: string): Promise<void> {
  const stop = await deps.stops.findById(id);
  if (!stop || stop.kind !== "delivery") throw new Error("Stop not found");
  if ((await deps.stops.countOrders(id)) > 0) throw new Error("Stop has orders");
  await deps.stops.deleteWithStock(id);
}

/**
 * Parada de la que descuenta una entrega con el control de stock a domicilio encendido:
 * `separate` = la jornada activa; `shared` = la parada del trailer activa. null si no hay.
 * Decisión provisional: en `shared` con varias activas (allowMultipleActiveStops) se usa la
 * más antigua, la primera de listAll (el repositorio ordena por startTime ascendente).
 */
export async function findDeliveryStop(
  stops: TrailerStopRepository,
  mode: AppSettings["deliveryStockMode"],
): Promise<TrailerStop | null> {
  const kind = mode === "separate" ? "delivery" : "trailer";
  return (await stops.listAll(kind)).find((s) => s.status === "active") ?? null;
}
