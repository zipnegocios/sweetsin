import type { LatLng, RouteInfo, RoutePlanner, TrafficSegment } from "@workspace/domain/routing";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const ROUTES_TIMEOUT_MS = 10_000;
const FIELD_MASK = "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.endLocation,routes.travelAdvisory";

export class RoutesNotConfiguredError extends Error {
  constructor() {
    super("Routes service is not configured yet.");
  }
}

export class RouteNotFoundError extends Error {
  constructor() {
    super("No route found for this destination.");
  }
}

// Fallo del proveedor (HTTP no 2xx, timeout, red). El mensaje nunca incluye texto de Google.
export class RoutesUpstreamError extends Error {
  constructor(detail: string) {
    super(`Routes upstream failure: ${detail}`);
  }
}

interface ComputeRoutesResponse {
  routes?: {
    duration: string;
    distanceMeters: number;
    polyline: { encodedPolyline: string };
    legs: { endLocation: { latLng: { latitude: number; longitude: number } } }[];
    travelAdvisory?: { speedReadingIntervals?: unknown };
  }[];
}

const SPEEDS: Record<string, TrafficSegment["speed"]> = { NORMAL: "normal", SLOW: "slow", TRAFFIC_JAM: "jam" };

// Cuenta los puntos de una polilinea codificada: cada coordenada termina en un byte < 0x20 tras restar 63; un punto son dos.
function countPolylinePoints(encoded: string): number {
  let terminators = 0;
  for (let i = 0; i < encoded.length; i++) if (encoded.charCodeAt(i) - 63 < 0x20) terminators++;
  return Math.floor(terminators / 2);
}

// proto3 omite startPolylinePointIndex cuando vale 0. Google usa fin EXCLUSIVO (el ultimo intervalo puede terminar en
// pointCount); el contrato es inclusivo (<= pointCount - 1), asi que se recorta. Mal formados o fuera de rango se descartan.
function parseTrafficSegments(raw: unknown, pointCount: number): TrafficSegment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const segments = raw.flatMap((item): TrafficSegment[] => {
    if (typeof item !== "object" || item === null) return [];
    const { startPolylinePointIndex = 0, endPolylinePointIndex, speed } = item as Record<string, unknown>;
    const mapped = typeof speed === "string" ? SPEEDS[speed] : undefined;
    if (!mapped || !Number.isInteger(startPolylinePointIndex) || !Number.isInteger(endPolylinePointIndex)) return [];
    const start = startPolylinePointIndex as number;
    const end = endPolylinePointIndex as number;
    if (start < 0 || end <= start || end > pointCount) return [];
    const endIndex = Math.min(end, pointCount - 1);
    if (endIndex <= start) return [];
    return [{ startIndex: start, endIndex, speed: mapped }];
  });
  return segments.length > 0 ? segments : undefined;
}

// Clave solo de servidor, distinta de NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Se valida al usarse, no al importar.
function getRoutesApiKey(): string {
  const key = process.env.GOOGLE_ROUTES_API_KEY;
  if (!key) throw new RoutesNotConfiguredError();
  return key;
}

export class GoogleRoutesPlanner implements RoutePlanner {
  async computeRoute(origin: LatLng, destinationAddress: string): Promise<RouteInfo> {
    const apiKey = getRoutesApiKey();
    let res: Response;
    try {
      res = await fetch(ROUTES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
          destination: { address: destinationAddress },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
          extraComputations: ["TRAFFIC_ON_POLYLINE"],
          languageCode: "en-US",
          units: "METRIC",
        }),
        signal: AbortSignal.timeout(ROUTES_TIMEOUT_MS),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : "unknown";
      throw new RoutesUpstreamError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network");
    }
    // El cuerpo del error no se propaga: podria reflejar la clave.
    if (!res.ok) throw new RoutesUpstreamError(`status ${res.status}`);

    let body: ComputeRoutesResponse;
    try {
      body = (await res.json()) as ComputeRoutesResponse;
    } catch {
      throw new RoutesUpstreamError("invalid body");
    }
    const route = body?.routes?.[0];
    if (!route) throw new RouteNotFoundError();
    if (!Array.isArray(route.legs)) throw new RoutesUpstreamError("invalid body");
    const end = route.legs.at(-1)?.endLocation?.latLng;
    // proto3 omite los campos escalares en cero: sin distanceMeters la distancia es 0 (duration es un mensaje, siempre presente).
    const distanceMeters = route.distanceMeters ?? 0;
    const etaSeconds = Number.parseInt(route.duration, 10);
    const polyline = route.polyline?.encodedPolyline;
    if (
      !end ||
      !Number.isFinite(end.latitude) ||
      !Number.isFinite(end.longitude) ||
      !Number.isFinite(etaSeconds) ||
      !Number.isFinite(distanceMeters) ||
      typeof polyline !== "string"
    ) {
      throw new RoutesUpstreamError("invalid body");
    }
    const trafficSegments = parseTrafficSegments(
      route.travelAdvisory?.speedReadingIntervals,
      countPolylinePoints(polyline),
    );
    return {
      etaSeconds,
      distanceMeters,
      encodedPolyline: polyline,
      origin,
      destination: { lat: end.latitude, lng: end.longitude },
      computedAt: new Date(),
      ...(trafficSegments && { trafficSegments }),
    };
  }
}
