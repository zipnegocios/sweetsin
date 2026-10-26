import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { userId: string; role: string } | null,
  orders: [] as Record<string, unknown>[],
}));

vi.mock("../../_lib/require-mobile-auth", () => ({ requireMobileAuth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleOrderRepository: class {
    async findQueueForDespachador() {
      return state.orders;
    }
  },
}));

import { GET } from "./route";

const req = () => new Request("http://localhost/x", { headers: { authorization: "Bearer t" } });

beforeEach(() => {
  state.session = { userId: "u1", role: "despachador" };
  state.orders = [];
});

describe("GET /api/mobile/orders/queue", () => {
  it("401 sin sesion valida y 403 para otro rol", async () => {
    state.session = null;
    expect((await GET(req())).status).toBe(401);
    state.session = { userId: "x", role: "delivery" };
    expect((await GET(req())).status).toBe(403);
  });

  it("projects only the dispatcher fields", async () => {
    state.orders = [
      {
        id: "o1",
        customerId: "c1",
        customerName: "Ana",
        customerEmail: "ana@example.com",
        customerPhone: "+61 400",
        fulfillmentType: "self_delivery",
        deliveryAddress: "1 Main St",
        stopId: null,
        paymentStatus: "paid",
        fulfillmentStatus: "received",
        subtotalCents: 4000,
        discountCents: 0,
        deliveryFeeCents: 500,
        totalCents: 4500,
        channel: "web",
        stripePaymentIntentId: "pi_secret",
        assignedDeliveryUserId: null,
        items: [
          { productId: "p1", quantity: 2, unitPriceCents: 1000, lineDiscountCents: 0 },
          { productId: "p2", quantity: 3, unitPriceCents: 700, lineDiscountCents: 0 },
        ],
      },
    ];
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      orders: [
        {
          id: "o1",
          customerName: "Ana",
          customerPhone: "+61 400",
          fulfillmentType: "self_delivery",
          fulfillmentStatus: "received",
          deliveryAddress: "1 Main St",
          totalCents: 4500,
          itemCount: 5,
        },
      ],
    });
  });
});
