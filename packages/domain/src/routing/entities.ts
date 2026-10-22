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
  computedAt: Date;
}
