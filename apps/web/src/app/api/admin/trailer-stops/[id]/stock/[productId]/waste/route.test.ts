import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { user: { id?: string; role: string } } | null,
  stopStatus: "active" as string | null,
  row: true,
  liveStock: true,
  current: 5,
  waste: [] as unknown[][],
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
      return state.row ? { id: "r1", stopId: "s", productId: "p", maxStock: 10, currentStock: state.current } : null;
    }
    async recordWaste(id: string, q: number, reason: string | null, by: string | null) {
      if (q > state.current) return false;
      state.waste.push([id, q, reason, by]);
      return true;
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
  state.current = 5;
  state.waste = [];
});

describe("POST /api/admin/trailer-stops/[id]/stock/[productId]/waste", () => {
  it("401 sin sesión y 403 para otro rol", async () => {
    state.session = null;
    expect((await POST(post({ quantity: 1 }), ctx())).status).toBe(401);
    state.session = { user: { role: "despachador" } };
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
    expect((await POST(post({ quantity: 1, reason: 3 }), ctx())).status).toBe(400);
  });

  it("409 con stock en vivo apagado", async () => {
    state.liveStock = false;
    const res = await POST(post({ quantity: 1 }), ctx());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Live stock is disabled" });
    expect(state.waste).toEqual([]);
  });

  it("409 si la merma supera el stock actual o la parada no está activa", async () => {
    let res = await POST(post({ quantity: 6 }), ctx());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Waste exceeds current stock");
    state.stopStatus = "completed";
    res = await POST(post({ quantity: 1 }), ctx());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Stop is not active");
  });

  it("200: registra la merma con motivo y el admin como quien reportó", async () => {
    expect((await POST(post({ quantity: 2, reason: "  Dropped  " }), ctx())).status).toBe(200);
    expect((await POST(post({ quantity: 1 }), ctx())).status).toBe(200);
    expect(state.waste).toEqual([
      ["r1", 2, "Dropped", "admin-1"],
      ["r1", 1, null, "admin-1"],
    ]);
  });
});
