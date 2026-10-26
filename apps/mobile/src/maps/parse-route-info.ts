import type { LatLng, RouteInfo, TrafficSegment } from "./types";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseLatLng(v: unknown): LatLng | null {
  if (typeof v !== "object" || v === null) return null;
  const { lat, lng } = v as Record<string, unknown>;
  return isNum(lat) && isNum(lng) ? { lat, lng } : null;
}

const SPEEDS = ["normal", "slow", "jam"];

// No se conoce el largo decodificado aqui: el renderizador debe usar clampSegments(segments, points.length).
function parseTrafficSegments(v: unknown): TrafficSegment[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const segments = v.flatMap((item): TrafficSegment[] => {
    if (typeof item !== "object" || item === null) return [];
    const { startIndex, endIndex, speed } = item as Record<string, unknown>;
    if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex) || !SPEEDS.includes(speed as string)) return [];
    const start = startIndex as number;
    const end = endIndex as number;
    if (start < 0 || end <= start) return [];
    return [{ startIndex: start, endIndex: end, speed: speed as TrafficSegment["speed"] }];
  });
  return segments.length > 0 ? segments : undefined;
}

/** Valida la forma de la respuesta de la ruta: un 200 con cuerpo malformado no debe llegar a RouteMap. */
export function parseRouteInfo(json: unknown): RouteInfo | null {
  if (typeof json !== "object" || json === null) return null;
  const r = json as Record<string, unknown>;
  const origin = parseLatLng(r.origin);
  const destination = parseLatLng(r.destination);
  if (!origin || !destination) return null;
  if (!isNum(r.etaSeconds) || !isNum(r.distanceMeters) || typeof r.encodedPolyline !== "string") return null;
  const trafficSegments = parseTrafficSegments(r.trafficSegments);
  return {
    etaSeconds: r.etaSeconds,
    distanceMeters: r.distanceMeters,
    encodedPolyline: r.encodedPolyline,
    origin,
    destination,
    computedAt: typeof r.computedAt === "string" ? r.computedAt : "",
    ...(trafficSegments && { trafficSegments }),
  };
}
