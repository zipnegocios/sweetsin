import { clampSegments } from "./clamp-segments";
import type { LatLng, TrafficSegment, TrafficSpeed } from "./types";

export type TrafficRun = { speed: TrafficSpeed; points: LatLng[] };

/**
 * Parte la polilinea decodificada en tramos dibujables por velocidad (indices inclusivos: los tramos contiguos
 * comparten el punto de union). Sin trafficSegments, o en los huecos sin datos, el tramo es "normal".
 */
export function trafficRuns(points: LatLng[], segments?: TrafficSegment[]): TrafficRun[] {
  if (points.length < 2) return [];
  const sorted = [...(segments ?? [])].sort((a, b) => a.startIndex - b.startIndex);
  const runs: { speed: TrafficSpeed; start: number; end: number }[] = [];
  const push = (speed: TrafficSpeed, start: number, end: number) => {
    if (end <= start) return;
    const last = runs.at(-1);
    if (last && last.speed === speed && last.end === start) last.end = end;
    else runs.push({ speed, start, end });
  };
  let cursor = 0;
  for (const s of clampSegments(sorted, points.length)) {
    const start = Math.max(s.startIndex, cursor);
    push("normal", cursor, start); // hueco sin datos de trafico
    push(s.speed, start, s.endIndex);
    cursor = Math.max(cursor, s.endIndex);
  }
  push("normal", cursor, points.length - 1);
  return runs.map((r) => ({ speed: r.speed, points: points.slice(r.start, r.end + 1) }));
}

/** Hay transito lento o detenido en algun tramo: la tarjeta lo dice en texto, no solo con color. */
export function hasTraffic(runs: TrafficRun[]): boolean {
  return runs.some((r) => r.speed !== "normal");
}
