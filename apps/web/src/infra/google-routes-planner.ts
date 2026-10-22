import type { LatLng, RouteInfo, RoutePlanner } from "@workspace/domain/routing";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const ROUTES_TIMEOUT_MS = 10_000;
const FIELD_MASK = "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.endLocation";

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
  }[];
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
    return {
      etaSeconds,
      distanceMeters,
      encodedPolyline: polyline,
      origin,
      destination: { lat: end.latitude, lng: end.longitude },
      computedAt: new Date(),
    };
  }
}
