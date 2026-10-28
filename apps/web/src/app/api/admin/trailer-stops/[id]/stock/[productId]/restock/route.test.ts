import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { user: { id?: string; role: string } } | null,
  stopStatus: "active" as string | null,
  row: true,
  liveStock: true,
  increments: [] as [string, number][],
  events: [] as Record<string, unknown>[],
}));

vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleTrailerStopRepository: class {
    async findById() {
      return state.stopStatus ? { id: "s", status: state.stopStatus } : null;
    }
  },
  DrizzleStockRepository: class {
    async findByStopAndProduct() {
      return state.row ? { id: "r1", stopId: "s", productId: "p", maxStock: 10, currentStock: 2 } : null;
    }
    async incrementStock(id: string, q: number) {
      state.increments.push([id, q]);
    }
    async recordEvent(e: Record<string, unknown>) {
      state.events.push(e);
    }
  },
  DrizzleSettingsRepository: class {
    async get() {
      return { liveStockEnabled: state.liveStock };
    }
  },
}));

import { POST } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const ctx = (id = ID, productId = ID) => ({ params: Promise.resolve({ id, productId }) });
const post = (b: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(b) });

beforeEach(() => {
  state.session = { user: { id: "admin-1", role: "admin" } };
  state.stopStatus = "active";
  state.row = true;
  state.liveStock = true;
  state.increments = [];
  state.events = [];
});

describe("POST /api/admin/trailer-stops/[id]/stock/[productId]/restock", () => {
  it("401 sin sesión y 403 para otro rol", async () => {
    state.session = null;
    expect((await POST(post({ quantity: 1 }), ctx())).status).toBe(401);
    state.session = { user: { role: "delivery" } };
    expect((await POST(post({ quantity: 1 }), ctx())).status).toBe(403);
  });

  it("404 con ids no UUID, parada o fila inexistente", async () => {
    expect((await POST(post({ quantity: 1 }), ctx("x"))).status).toBe(404);
    expect((await POST(post({ quantity: 1 }), ctx(ID, "x"))).status).toBe(404);
    state.stopStatus = null;
    expect((await POST(post({ quantity: 1 }), ctx())).status).toBe(404);
    state.stopStatus = "active";
    state.row = false;
    expect((await POST(post({ quantity: 1 }), ctx())).status).toBe(404);
  });

  it("400 con cuerpo inválido", async () => {
    expect((await POST(post({ quantity: "a" }), ctx())).status).toBe(400);
  });

  it("409 con stock en vivo apagado", async () => {
    state.liveStock = false;
    const res = await POST(post({ quantity: 2 }), ctx());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Live stock is disabled" });
    expect(state.increments).toEqual([]);
  });

  it("409 si la parada no está activa o la cantidad no es positiva", async () => {
    state.stopStatus = "scheduled";
    expect((await POST(post({ quantity: 2 }), ctx())).status).toBe(409);
    state.stopStatus = "active";
    expect((await POST(post({ quantity: 0 }), ctx())).status).toBe(409);
    expect(state.increments).toEqual([]);
  });

  it("200: repone y registra al admin como quien reportó", async () => {
    expect((await POST(post({ quantity: 3 }), ctx())).status).toBe(200);
    expect(state.increments).toEqual([["r1", 3]]);
    expect(state.events).toEqual([
      { stopProductStockId: "r1", eventType: "restock", quantity: 3, reason: null, reportedByUserId: "admin-1" },
    ]);
  });
});
