import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { userId: string; role: string } | null,
  order: null as Record<string, unknown> | null,
  user: null as Record<string, unknown> | null,
  assigned: [] as { deliveryUserId: string; ctx: unknown }[],
}));

vi.mock("../../../_lib/require-mobile-auth", () => ({ requireMobileAuth: async () => state.session }));
vi.mock("@/lib/staff-notifications", () => ({ createStaffNotifications: () => ({ notifyDeliveryAssigned: vi.fn() }) }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleOrderRepository: class {
    async findById() {
      return state.order;
    }
    async assignDelivery(_id: string, deliveryUserId: string, ctx: unknown) {
      state.assigned.push({ deliveryUserId, ctx });
    }
  },
  DrizzleUserRepository: class {
    async findById() {
      return state.user;
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
const DELIVERY = "22222222-2222-4222-8222-222222222222";
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) });
const req = (body: unknown) =>
  new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify(body), headers: { authorization: "Bearer t" } });

beforeEach(() => {
  state.session = { userId: "disp-1", role: "despachador" };
  state.order = { id: ID, fulfillmentStatus: "ready_for_pickup" };
  state.user = { id: DELIVERY, role: "delivery", isActive: true };
  state.assigned = [];
});

describe("PATCH /api/mobile/orders/[id]/assign", () => {
  it("401 sin sesion y 403 para otro rol", async () => {
    state.session = null;
    expect((await PATCH(req({ deliveryUserId: DELIVERY }), ctx())).status).toBe(401);
    state.session = { userId: "d1", role: "delivery" };
    expect((await PATCH(req({ deliveryUserId: DELIVERY }), ctx())).status).toBe(403);
  });

  it("404 con id no UUID o inexistente", async () => {
    expect((await PATCH(req({ deliveryUserId: DELIVERY }), ctx("o1"))).status).toBe(404);
    state.order = null;
    expect((await PATCH(req({ deliveryUserId: DELIVERY }), ctx())).status).toBe(404);
  });

  it("409 con un repartidor invalido o desde un estado invalido", async () => {
    state.user = { id: DELIVERY, role: "delivery", isActive: false };
    expect((await PATCH(req({ deliveryUserId: DELIVERY }), ctx())).status).toBe(409);
    state.order = { id: ID, fulfillmentStatus: "in_prep" };
    expect((await PATCH(req({ deliveryUserId: DELIVERY }), ctx())).status).toBe(409);
  });

  it("200: asigna registrando al despachador con source mobile", async () => {
    expect((await PATCH(req({ deliveryUserId: DELIVERY }), ctx())).status).toBe(200);
    expect(state.assigned).toEqual([{ deliveryUserId: DELIVERY, ctx: { actorUserId: "disp-1", source: "mobile", record: true } }]);
  });
});
