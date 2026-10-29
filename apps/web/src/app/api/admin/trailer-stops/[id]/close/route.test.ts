import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { user: { id?: string; role: string } } | null,
  stop: null as { id: string; status: string } | null,
  undelivered: 0,
  updates: [] as [string, string][],
}));

vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleTrailerStopRepository: class {
    async findById() {
      return state.stop && { kind: "trailer", ...state.stop };
    }
    async updateStatus(id: string, status: string) {
      state.updates.push([id, status]);
    }
  },
  DrizzleOrderRepository: class {
    async countUndeliveredForStop() {
      return state.undelivered;
    }
  },
}));

import { POST } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) });
const post = (body?: string) => new Request("http://x", { method: "POST", body });

beforeEach(() => {
  state.session = { user: { id: "admin-1", role: "admin" } };
  state.stop = { id: ID, status: "active" };
  state.undelivered = 0;
  state.updates = [];
});

describe("POST /api/admin/trailer-stops/[id]/close", () => {
  it("401 sin sesión y 403 para otro rol", async () => {
    state.session = null;
    expect((await POST(post(), ctx())).status).toBe(401);
    state.session = { user: { role: "delivery" } };
    expect((await POST(post(), ctx())).status).toBe(403);
  });

  it("404 con id no UUID o parada inexistente", async () => {
    expect((await POST(post(), ctx("nope"))).status).toBe(404);
    state.stop = null;
    expect((await POST(post(), ctx())).status).toBe(404);
  });

  it("400 con cuerpo inválido", async () => {
    expect((await POST(post("{"), ctx())).status).toBe(400);
    expect((await POST(post(JSON.stringify({ confirmUndelivered: "si" })), ctx())).status).toBe(400);
  });

  it("409 si la parada no está activa", async () => {
    state.stop = { id: ID, status: "scheduled" };
    const res = await POST(post(), ctx());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Only active stops can be closed");
  });

  it("409 con pedidos sin entregar y sin confirmar; 200 al confirmar", async () => {
    state.undelivered = 2;
    const res = await POST(post(), ctx());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Stop has undelivered orders");
    expect(state.updates).toEqual([]);
    expect((await POST(post(JSON.stringify({ confirmUndelivered: true })), ctx())).status).toBe(200);
    expect(state.updates).toEqual([[ID, "completed"]]);
  });

  it("200 sin cuerpo cuando no hay pedidos pendientes", async () => {
    expect((await POST(post(), ctx())).status).toBe(200);
    expect(state.updates).toEqual([[ID, "completed"]]);
  });
});
