import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { userId: string; role: string } | null,
  order: null as Record<string, unknown> | null,
  planner: null as null | ((...a: unknown[]) => Promise<unknown>),
  dbCalls: 0,
  plannerCalls: 0,
}));

const errors = vi.hoisted(() => {
  class RoutesNotConfiguredError extends Error {
    constructor() {
      super("Routes service is not configured yet.");
    }
  }
  class RouteNotFoundError extends Error {
    constructor() {
      super("No route found for this destination.");
    }
  }
  return { RoutesNotConfiguredError, RouteNotFoundError };
});

vi.mock("../../../_lib/require-mobile-auth", () => ({ requireMobileAuth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleOrderRepository: class {
    async findById() {
      state.dbCalls++;
      return state.order;
    }
  },
}));
vi.mock("@/infra/google-routes-planner", () => {
  class GoogleRoutesPlanner {
    computeRoute(...a: unknown[]) {
      state.plannerCalls++;
      return state.planner!(...a);
    }
  }
  return { GoogleRoutesPlanner, ...errors };
});

const { RoutesNotConfiguredError, RouteNotFoundError } = errors;
let GET: typeof import("./route").GET;

const ctx = { params: Promise.resolve({ id: "o1" }) };
const req = (qs: string) => new Request(`http://localhost/x${qs}`, { headers: { authorization: "Bearer t" } });
const route = {
  etaSeconds: 720,
  distanceMeters: 3400,
  encodedPolyline: "abc",
  origin: { lat: 25.7, lng: -80.2 },
  destination: { lat: 25.8, lng: -80.3 },
  computedAt: new Date("2026-10-20T12:00:00Z"),
};

beforeEach(async () => {
  // Modulo fresco por test: el singleton CachingRoutePlanner de route.ts no comparte cache entre tests.
  vi.resetModules();
  ({ GET } = await import("./route"));
  state.plannerCalls = 0;
  state.session = { userId: "d1", role: "delivery" };
  state.order = {
    id: "o1",
    assignedDeliveryUserId: "d1",
    fulfillmentStatus: "out_for_delivery",
    deliveryAddress: "1 Main St",
  };
  state.planner = async () => route;
  state.dbCalls = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/mobile/orders/[id]/route", () => {
  it("403 para otro rol antes de tocar DB o red", async () => {
    state.session = { userId: "x", role: "despachador" };
    expect((await GET(req("?lat=1&lng=1"), ctx)).status).toBe(403);
    state.session = null;
    expect((await GET(req("?lat=1&lng=1"), ctx)).status).toBe(403);
    expect(state.dbCalls).toBe(0);
  });

  it.each(["", "?lat=25.7", "?lat=abc&lng=1", "?lat=NaN&lng=1", "?lat=91&lng=0", "?lat=0&lng=-181", "?lat=&lng="])(
    "400 con coordenadas invalidas %j",
    async (qs) => {
      expect((await GET(req(qs), ctx)).status).toBe(400);
      expect(state.dbCalls).toBe(0);
    },
  );

  it("404 si la orden no existe", async () => {
    state.order = null;
    expect((await GET(req("?lat=25.7&lng=-80.2"), ctx)).status).toBe(404);
  });

  it("409 ante una regla de dominio", async () => {
    state.order = { ...state.order, fulfillmentStatus: "delivered" };
    expect((await GET(req("?lat=25.7&lng=-80.2"), ctx)).status).toBe(409);
  });

  it("409 si Google no encuentra ruta", async () => {
    state.planner = async () => {
      throw new RouteNotFoundError();
    };
    expect((await GET(req("?lat=25.7&lng=-80.2"), ctx)).status).toBe(409);
  });

  it("503 sin clave de Routes", async () => {
    state.planner = async () => {
      throw new RoutesNotConfiguredError();
    };
    const res = await GET(req("?lat=25.7&lng=-80.2"), ctx);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Routes service is not configured yet." });
  });

  it("200 con RouteInfo y computedAt ISO", async () => {
    const res = await GET(req("?lat=25.7&lng=-80.2"), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...route, computedAt: "2026-10-20T12:00:00.000Z" });
  });

  it("la cache del singleton evita una segunda llamada al planificador con el mismo origen", async () => {
    await GET(req("?lat=25.7&lng=-80.2"), ctx);
    const res = await GET(req("?lat=25.7004&lng=-80.2004"), ctx);
    expect(res.status).toBe(200);
    expect(state.plannerCalls).toBe(1);
  });
});
