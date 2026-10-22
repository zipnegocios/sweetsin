import type { LatLng, RouteInfo, RoutePlanner } from "@workspace/domain/routing";

// Cada calculo con trafico es una llamada paga: se memoriza por destino + origen a ~100 m.
export class CachingRoutePlanner implements RoutePlanner {
  private readonly entries = new Map<string, { route: RouteInfo; expiresAt: number }>();
  private readonly now: () => number;

  constructor(
    private readonly inner: RoutePlanner,
    private readonly opts: { ttlMs: number; now?: () => number },
  ) {
    this.now = opts.now ?? Date.now;
  }

  get size(): number {
    return this.entries.size;
  }

  async computeRoute(origin: LatLng, destinationAddress: string): Promise<RouteInfo> {
    const now = this.now();
    for (const [k, e] of this.entries) if (e.expiresAt <= now) this.entries.delete(k);

    const key = `${destinationAddress}|${origin.lat.toFixed(3)}|${origin.lng.toFixed(3)}`;
    const hit = this.entries.get(key);
    if (hit) return hit.route;

    const route = await this.inner.computeRoute(origin, destinationAddress);
    this.entries.set(key, { route, expiresAt: now + this.opts.ttlMs });
    return route;
  }
}
