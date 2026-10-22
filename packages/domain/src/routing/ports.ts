import type { LatLng, RouteInfo } from "./entities";

export interface RoutePlanner {
  computeRoute(origin: LatLng, destinationAddress: string): Promise<RouteInfo>;
}
