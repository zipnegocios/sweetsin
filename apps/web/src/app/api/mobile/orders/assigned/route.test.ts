import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { userId: string; role: string } | null,
  orders: [] as Record<string, unknown>[],
}));

vi.mock("../../_lib/require-mobile-auth", () => ({ requireMobileAuth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleOrderRepository: class {
    async findAssignedToDelivery() {
      return state.orders;
    }
  },
  DrizzleSettingsRepository: class {
    async get() {
      return { deliveryEvidenceRequired: false };
    }
  },
}));

import { GET } from "./route";

const req = () => new Request("http://localhost/x", { headers: { authorization: "Bearer t" } });

beforeEach(() => {
  state.session = { userId: "d1", role: "delivery" };
  state.orders = [];
});

describe("GET /api/mobile/orders/assigned", () => {
  it("401 sin sesion valida y 403 para otro rol", async () => {
    state.session = null;
    expect((await GET(req())).status).toBe(401);
    state.session = { userId: "x", role: "despachador" };
    expect((await GET(req())).status).toBe(403);
  });

  it("devuelve solo los campos que la app necesita (sin email, Stripe ni montos)", async () => {
    state.orders = [
      {
        id: "o1",
        customerName: "Ana",
        customerPhone: "+61 400",
        customerEmail: "ana@example.com",
        deliveryAddress: "1 Main St",
        deliveryEvidenceKey: null,
        stripePaymentIntentId: "pi_secret",
        total: 42,
        items: [{ productId: "p1" }],
      },
    ];
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      orders: [
        { id: "o1", customerName: "Ana", customerPhone: "+61 400", deliveryAddress: "1 Main St", deliveryEvidenceKey: null },
      ],
      deliveryEvidenceRequired: false,
    });
  });
});
