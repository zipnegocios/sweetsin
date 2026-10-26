export interface LatLng {
  lat: number;
  lng: number;
}

export type TrafficSpeed = "normal" | "slow" | "jam";

/**
 * Tramo de la polilinea decodificada. Los indices son de puntos decodificados (0..N-1) e INCLUSIVOS en ambos
 * extremos: se dibuja con points.slice(startIndex, endIndex + 1), asi los tramos contiguos comparten un punto.
 */
export interface TrafficSegment {
  startIndex: number;
  endIndex: number;
  speed: TrafficSpeed;
}

export interface RouteInfo {
  etaSeconds: number;
  distanceMeters: number;
  encodedPolyline: string;
  origin: LatLng;
  destination: LatLng;
  computedAt: Date;
  trafficSegments?: TrafficSegment[];
}
