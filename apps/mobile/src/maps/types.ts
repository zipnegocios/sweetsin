/** Contrato de GET /api/mobile/orders/[id]/route (computedAt llega como ISO string). */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteInfo {
  etaSeconds: number;
  distanceMeters: number;
  encodedPolyline: string;
  origin: LatLng;
  destination: LatLng;
  computedAt: string;
}
