import { describe, it, expect, vi } from "vitest";
import type { RoutePlanner, RouteInfo } from "@workspace/domain/routing";
import { CachingRoutePlanner } from "./caching-route-planner";

function setup() {
  let t = 1_000_000;
  const inner: RoutePlanner = {
    computeRoute: vi.fn(
      async (origin, address) =>
        ({
          etaSeconds: 1,
          distanceMeters: 1,
          encodedPolyline: address,
          origin,
          destination: { lat: 0, lng: 0 },
          computedAt: new Date(t),
        }) satisfies RouteInfo,
    ),
  };
  const planner = new CachingRoutePlanner(inner, { ttlMs: 60_000, now: () => t });
  return { inner, planner, advance: (ms: number) => (t += ms) };
}
const o = { lat: 25.7001, lng: -80.2001 };

describe("CachingRoutePlanner", () => {
  it("mismo destino y origen redondeado: no vuelve a llamar al interno", async () => {
    const { inner, planner } = setup();
    const a = await planner.computeRoute(o, "A");
    const b = await planner.computeRoute({ lat: 25.7003, lng: -80.2004 }, "A");
    expect(b).toBe(a);
    expect(inner.computeRoute).toHaveBeenCalledTimes(1);
  });

  it("origen a mas de ~100 m llama de nuevo", async () => {
    const { inner, planner } = setup();
    await planner.computeRoute(o, "A");
    await planner.computeRoute({ lat: 25.7021, lng: -80.2001 }, "A");
    expect(inner.computeRoute).toHaveBeenCalledTimes(2);
  });

  it("otro destino llama de nuevo", async () => {
    const { inner, planner } = setup();
    await planner.computeRoute(o, "A");
    await planner.computeRoute(o, "B");
    expect(inner.computeRoute).toHaveBeenCalledTimes(2);
  });

  it("TTL vencido llama de nuevo; antes del TTL no", async () => {
    const { inner, planner, advance } = setup();
    await planner.computeRoute(o, "A");
    advance(59_999);
    await planner.computeRoute(o, "A");
    expect(inner.computeRoute).toHaveBeenCalledTimes(1);
    advance(1);
    await planner.computeRoute(o, "A");
    expect(inner.computeRoute).toHaveBeenCalledTimes(2);
  });

  it("no cachea los errores", async () => {
    const { inner, planner } = setup();
    vi.mocked(inner.computeRoute).mockRejectedValueOnce(new Error("boom"));
    await expect(planner.computeRoute(o, "A")).rejects.toThrow("boom");
    await planner.computeRoute(o, "A");
    expect(inner.computeRoute).toHaveBeenCalledTimes(2);
  });

  it("acota el tamano del mapa descartando entradas vencidas", async () => {
    const { planner, advance } = setup();
    for (let i = 0; i < 5; i++) await planner.computeRoute(o, `addr${i}`);
    advance(60_000);
    await planner.computeRoute(o, "nueva");
    expect(planner.size).toBe(1);
  });
});
