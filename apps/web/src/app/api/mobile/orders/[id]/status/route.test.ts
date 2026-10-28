import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { userId: string; role: string } | null,
  order: null as Record<string, unknown> | null,
  writes: [] as { status: string; ctx: unknown }[],
}));

vi.mock("../../../_lib/require-mobile-auth", () => ({ requireMobileAuth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleOrderRepository: class {
    async findById() {
      return state.order;
    }
    async updateFulfillmentStatus(_id: string, status: string, ctx: unknown) {
      state.writes.push({ status, ctx });
    }
  },
  DrizzleSettingsRepository: class {
    async get() {
      return { timingEnabled: true };
    }
  },
}));

import { PATCH } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown) =>
  new Request("http://localhost/x", {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { authorization: "Bearer t" },
  });

beforeEach(() => {
  state.session = { userId: "disp-1", role: "despachador" };
  state.order = { id: ID, fulfillmentType: "pickup", fulfillmentStatus: "ready_for_pickup" };
  state.writes = [];
});

describe("PATCH /api/mobile/orders/[id]/status", () => {
  it("401 sin sesion y 403 para otro rol", async () => {
    state.session = null;
    expect((await PATCH(req({ status: "in_prep" }), ctx())).status).toBe(401);
    state.session = { userId: "d1", role: "delivery" };
    expect((await PATCH(req({ status: "in_prep" }), ctx())).status).toBe(403);
  });

  it("400 con cuerpo invalido y 404 con id no UUID o inexistente", async () => {
    expect((await PATCH(req("no-json"), ctx())).status).toBe(400);
    expect((await PATCH(req({ status: "cancelled" }), ctx())).status).toBe(400);
    expect((await PATCH(req({ status: "in_prep" }), ctx("o1"))).status).toBe(404);
    state.order = null;
    expect((await PATCH(req({ status: "in_prep" }), ctx())).status).toBe(404);
  });

  it("in_prep registra la transicion con source mobile y el despachador como actor", async () => {
    state.order = { id: ID, fulfillmentType: "self_delivery", fulfillmentStatus: "received" };
    const res = await PATCH(req({ status: "in_prep" }), ctx());
    expect(res.status).toBe(200);
    expect(state.writes).toEqual([{ status: "in_prep", ctx: { actorUserId: "disp-1", source: "mobile", record: true } }]);
  });

  it("409 con una transicion invalida", async () => {
    state.order = { id: ID, fulfillmentType: "pickup", fulfillmentStatus: "pending" };
    expect((await PATCH(req({ status: "ready_for_pickup" }), ctx())).status).toBe(409);
  });

  it("delivered entrega en mostrador un pedido de retiro listo", async () => {
    const res = await PATCH(req({ status: "delivered" }), ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).order.fulfillmentStatus).toBe("delivered");
    expect(state.writes.map((w) => w.status)).toEqual(["delivered"]);
  });

  it("delivered rechaza (409) un pedido que no es de retiro", async () => {
    state.order = { id: ID, fulfillmentType: "self_delivery", fulfillmentStatus: "ready_for_pickup" };
    const res = await PATCH(req({ status: "delivered" }), ctx());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Only pickup orders can be handed over" });
    expect(state.writes).toHaveLength(0);
  });
});
