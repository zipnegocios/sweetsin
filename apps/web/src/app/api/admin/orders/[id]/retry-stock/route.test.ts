import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { user: { id?: string; role: string } } | null,
  order: null as Record<string, unknown> | null,
  stockOk: true,
  resolved: [] as { id: string; ctx: unknown }[],
}));

vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleOrderRepository: class {
    async findById() {
      return state.order;
    }
    async resolveAttention(id: string, ctx: unknown) {
      state.resolved.push({ id, ctx });
    }
  },
  DrizzleStockRepository: class {
    async decrementForOrder() {
      return state.stockOk ? { ok: true } : { ok: false, productId: "p1" };
    }
  },
  DrizzleSettingsRepository: class {
    async get() {
      return { timingEnabled: true };
    }
  },
}));

import { POST } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) });
const post = () => new Request("http://localhost/x", { method: "POST" });

beforeEach(() => {
  state.session = { user: { id: "admin-1", role: "admin" } };
  state.order = { id: ID, stopId: "s1", attentionReason: "insufficient_stock:p1", fulfillmentStatus: "pending", items: [] };
  state.stockOk = true;
  state.resolved = [];
});

describe("POST /api/admin/orders/[id]/retry-stock", () => {
  it("401 sin sesion y 403 para otro rol", async () => {
    state.session = null;
    expect((await POST(post(), ctx())).status).toBe(401);
    state.session = { user: { role: "despachador" } };
    expect((await POST(post(), ctx())).status).toBe(403);
  });

  it("404 con id no UUID o pedido inexistente", async () => {
    expect((await POST(post(), ctx("nope"))).status).toBe(404);
    state.order = null;
    const res = await POST(post(), ctx());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Order not found" });
  });

  it("409 si el pedido no está en atención o el stock sigue sin alcanzar", async () => {
    state.order = { ...state.order, attentionReason: null };
    expect((await POST(post(), ctx())).status).toBe(409);
    state.order = { ...state.order, attentionReason: "insufficient_stock:p1" };
    state.stockOk = false;
    const res = await POST(post(), ctx());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Stock still insufficient" });
    expect(state.resolved).toHaveLength(0);
  });

  it("200: descuenta y resuelve registrando al admin como actor web", async () => {
    const res = await POST(post(), ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).order).toMatchObject({ attentionReason: null, fulfillmentStatus: "received" });
    expect(state.resolved).toEqual([{ id: ID, ctx: { actorUserId: "admin-1", source: "web", record: true } }]);
  });
});
