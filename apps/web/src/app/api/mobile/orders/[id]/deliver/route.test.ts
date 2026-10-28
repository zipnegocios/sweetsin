import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { userId: string; role: string } | null,
  order: null as Record<string, unknown> | null,
  writes: [] as { status: string; ctx: { occurredAt?: Date } & Record<string, unknown> }[],
}));

vi.mock("../../../_lib/require-mobile-auth", () => ({ requireMobileAuth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleOrderRepository: class {
    async findById() {
      return state.order;
    }
    async updateFulfillmentStatus(_id: string, status: string, ctx: { occurredAt?: Date }) {
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
const req = (body?: unknown) =>
  new Request("http://localhost/x", {
    method: "PATCH",
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    headers: { authorization: "Bearer t" },
  });

beforeEach(() => {
  state.session = { userId: "d1", role: "delivery" };
  state.order = { id: ID, fulfillmentStatus: "out_for_delivery", assignedDeliveryUserId: "d1" };
  state.writes = [];
});

describe("PATCH /api/mobile/orders/[id]/deliver", () => {
  it("401 sin sesion y 403 para otro rol", async () => {
    state.session = null;
    expect((await PATCH(req(), ctx())).status).toBe(401);
    state.session = { userId: "x", role: "despachador" };
    expect((await PATCH(req(), ctx())).status).toBe(403);
  });

  it("404 con id no UUID o inexistente", async () => {
    expect((await PATCH(req(), ctx("o1"))).status).toBe(404);
    state.order = null;
    expect((await PATCH(req(), ctx())).status).toBe(404);
  });

  it("sin cuerpo (cola offline previa) entrega con source mobile y sin occurredAt", async () => {
    const res = await PATCH(req(), ctx());
    expect(res.status).toBe(200);
    expect(state.writes).toEqual([{ status: "delivered", ctx: { actorUserId: "d1", source: "mobile", record: true } }]);
  });

  it("pasa occurredAt ISO en el contexto", async () => {
    const at = "2026-10-28T01:00:00.000Z";
    expect((await PATCH(req({ occurredAt: at }), ctx())).status).toBe(200);
    expect(state.writes[0].ctx.occurredAt).toEqual(new Date(at));
  });

  it("una occurredAt futura no rechaza la entrega (el repositorio la reemplaza por la hora del servidor)", async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const res = await PATCH(req({ occurredAt: future }), ctx());
    expect(res.status).toBe(200);
    expect(state.writes.map((w) => w.status)).toEqual(["delivered"]);
  });

  it("400 con occurredAt invalida o JSON roto", async () => {
    expect((await PATCH(req({ occurredAt: "ayer" }), ctx())).status).toBe(400);
    expect((await PATCH(req("{no"), ctx())).status).toBe(400);
    expect(state.writes).toHaveLength(0);
  });

  it("409 si el usuario no es el asignado", async () => {
    state.order = { id: ID, fulfillmentStatus: "out_for_delivery", assignedDeliveryUserId: "otro" };
    expect((await PATCH(req(), ctx())).status).toBe(409);
  });
});
