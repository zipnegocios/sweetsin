import type { LatLng, RouteInfo, RoutePlanner } from "@workspace/domain/routing";

// Cada calculo con trafico es una llamada paga: se memoriza por destino + origen a ~100 m.
export class CachingRoutePlanner implements RoutePlanner {
  // Se guarda la promesa: dos fallos de cache simultaneos con la misma clave comparten una sola llamada.
  private readonly entries = new Map<string, { route: Promise<RouteInfo>; expiresAt: number }>();
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

    const route = this.inner.computeRoute(origin, destinationAddress);
    const entry = { route, expiresAt: now + this.opts.ttlMs };
    this.entries.set(key, entry);
    // Los errores nunca se cachean.
    route.catch(() => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
    });
    return route;
  }
}
