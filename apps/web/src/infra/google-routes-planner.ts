import type { LatLng, RouteInfo, RoutePlanner } from "@workspace/domain/routing";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
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
    const res = await fetch(ROUTES_URL, {
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
    });
    // El cuerpo del error no se propaga: podria reflejar la clave.
    if (!res.ok) throw new Error(`Routes API request failed with status ${res.status}`);

    const route = ((await res.json()) as ComputeRoutesResponse).routes?.[0];
    const end = route?.legs?.at(-1)?.endLocation.latLng;
    if (!route || !end) throw new RouteNotFoundError();
    return {
      etaSeconds: Number.parseInt(route.duration, 10),
      distanceMeters: route.distanceMeters,
      encodedPolyline: route.polyline.encodedPolyline,
      origin,
      destination: { lat: end.latitude, lng: end.longitude },
      computedAt: new Date(),
    };
  }
}
