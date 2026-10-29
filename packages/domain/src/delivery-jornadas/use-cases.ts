import type { TrailerStopRepository } from "../trailer-stops/ports";
import type { TrailerStop } from "../trailer-stops/entities";

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
