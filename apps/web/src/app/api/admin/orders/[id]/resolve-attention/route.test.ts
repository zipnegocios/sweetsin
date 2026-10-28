import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { user: { id?: string; role: string } } | null,
  order: null as Record<string, unknown> | null,
  resolved: [] as { id: string; ctx: unknown }[],
  failWith: null as Error | null,
}));

vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleOrderRepository: class {
    async findById() {
      return state.order;
    }
    async resolveAttention(id: string, ctx: unknown) {
      if (state.failWith) throw state.failWith;
      state.resolved.push({ id, ctx });
    }
  },
  DrizzleSettingsRepository: class {
    async get() {
      return { timingEnabled: false };
    }
  },
}));

import { POST } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) });
const post = () => new Request("http://localhost/x", { method: "POST" });

beforeEach(() => {
  state.session = { user: { id: "admin-1", role: "admin" } };
  state.order = { id: ID, stopId: "s1", attentionReason: "stop_cancelled", fulfillmentStatus: "pending", items: [] };
  state.resolved = [];
  state.failWith = null;
});

describe("POST /api/admin/orders/[id]/resolve-attention", () => {
  it("401 sin sesion y 403 para otro rol", async () => {
    state.session = null;
    expect((await POST(post(), ctx())).status).toBe(401);
    state.session = { user: { role: "delivery" } };
    expect((await POST(post(), ctx())).status).toBe(403);
  });

  it("404 con id no UUID o pedido inexistente", async () => {
    expect((await POST(post(), ctx("nope"))).status).toBe(404);
    state.order = null;
    expect((await POST(post(), ctx())).status).toBe(404);
  });

  it("409 si el pedido no está en atención o ya salió de pending", async () => {
    state.order = { ...state.order, attentionReason: null };
    expect((await POST(post(), ctx())).status).toBe(409);
    state.order = { ...state.order, attentionReason: "stop_cancelled", fulfillmentStatus: "cancelled" };
    expect((await POST(post(), ctx())).status).toBe(409);
    expect(state.resolved).toHaveLength(0);
  });

  it("200: resuelve con source web y respeta timingEnabled apagado", async () => {
    const res = await POST(post(), ctx());
    expect(res.status).toBe(200);
    expect(state.resolved).toEqual([{ id: ID, ctx: { actorUserId: "admin-1", source: "web", record: false } }]);
  });

  it("500 sin filtrar el detalle ante un error inesperado", async () => {
    state.failWith = new Error("connection reset");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(post(), ctx());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal error" });
  });
});
