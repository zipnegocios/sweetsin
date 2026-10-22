import { distanceMeters, type LatLng } from "./haversine";

export type TimedPosition = LatLng & { atMs: number };
export type SendPolicy = { minIntervalMs: number; minDistanceMeters: number };

/** Envía si no hay posición previa enviada, si pasó el intervalo mínimo o si se movió lo suficiente. */
export function shouldSendLocation(prev: TimedPosition | null, next: TimedPosition, opts: SendPolicy): boolean {
  if (!prev) return true;
  return next.atMs - prev.atMs >= opts.minIntervalMs || distanceMeters(prev, next) >= opts.minDistanceMeters;
}

/** Puerta final de un reporte: turno persistido, seguimiento no detenido en este proceso y política cumplida. */
export function canReport(g: { shiftFlagActive: boolean; trackingActive: boolean; policyPasses: boolean }): boolean {
  return g.shiftFlagActive && g.trackingActive && g.policyPasses;
}
