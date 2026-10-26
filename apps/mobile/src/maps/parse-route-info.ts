import type { LatLng, RouteInfo } from "./types";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseLatLng(v: unknown): LatLng | null {
  if (typeof v !== "object" || v === null) return null;
  const { lat, lng } = v as Record<string, unknown>;
  return isNum(lat) && isNum(lng) ? { lat, lng } : null;
}

/** Valida la forma de la respuesta de la ruta: un 200 con cuerpo malformado no debe llegar a RouteMap. */
export function parseRouteInfo(json: unknown): RouteInfo | null {
  if (typeof json !== "object" || json === null) return null;
  const r = json as Record<string, unknown>;
  const origin = parseLatLng(r.origin);
  const destination = parseLatLng(r.destination);
  if (!origin || !destination) return null;
  if (!isNum(r.etaSeconds) || !isNum(r.distanceMeters) || typeof r.encodedPolyline !== "string") return null;
  return {
    etaSeconds: r.etaSeconds,
    distanceMeters: r.distanceMeters,
    encodedPolyline: r.encodedPolyline,
    origin,
    destination,
    computedAt: typeof r.computedAt === "string" ? r.computedAt : "",
  };
}
