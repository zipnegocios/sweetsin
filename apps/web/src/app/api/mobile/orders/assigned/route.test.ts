import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { userId: string; role: string } | null,
  orders: [] as Record<string, unknown>[],
  products: [] as { id: string; nameEn: string }[],
  requestedIds: [] as string[][],
}));

vi.mock("../../_lib/require-mobile-auth", () => ({ requireMobileAuth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleOrderRepository: class {
    async findAssignedToDelivery() {
      return state.orders;
    }
  },
  DrizzleProductRepository: class {
    async findByIds(ids: string[]) {
      state.requestedIds.push(ids);
      return state.products.filter((p) => ids.includes(p.id));
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
  state.products = [{ id: "p1", nameEn: "Gluttony" }];
  state.requestedIds = [];
});

describe("GET /api/mobile/orders/assigned", () => {
  it("401 sin sesion valida y 403 para otro rol", async () => {
    state.session = null;
    expect((await GET(req())).status).toBe(401);
    state.session = { userId: "x", role: "despachador" };
    expect((await GET(req())).status).toBe(403);
  });

  it("devuelve el detalle del pedido y nada de email, Stripe ni ids de producto", async () => {
    state.orders = [
      {
        id: "o1",
        customerName: "Ana",
        customerPhone: "+61 400",
        customerEmail: "ana@example.com",
        deliveryAddress: "1 Main St",
        deliveryEvidenceKey: null,
        stripePaymentIntentId: "pi_secret",
        fulfillmentType: "self_delivery",
        subtotalCents: 3000,
        discountCents: 200,
        deliveryFeeCents: 500,
        totalCents: 3300,
        channel: "whatsapp",
        paymentStatus: "paid",
        items: [
          { productId: "p1", quantity: 2, unitPriceCents: 1500, lineDiscountCents: 0 },
          { productId: "gone", quantity: 1, unitPriceCents: 0, lineDiscountCents: 0 },
        ],
      },
      { id: "o2", customerName: "Bo", customerPhone: "1", deliveryAddress: null, items: [{ productId: "p1", quantity: 1 }] },
    ];
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      orders: [
        {
          id: "o1",
          customerName: "Ana",
          customerPhone: "+61 400",
          deliveryAddress: "1 Main St",
          deliveryEvidenceKey: null,
          fulfillmentType: "self_delivery",
          items: [
            { name: "Gluttony", quantity: 2 },
            { name: "?", quantity: 1 },
          ],
          subtotalCents: 3000,
          discountCents: 200,
          deliveryFeeCents: 500,
          totalCents: 3300,
          channel: "whatsapp",
          paymentStatus: "paid",
          deliveryNotes: null,
        },
        {
          id: "o2",
          customerName: "Bo",
          customerPhone: "1",
          deliveryAddress: null,
          deliveryEvidenceKey: null,
          items: [{ name: "Gluttony", quantity: 1 }],
          deliveryNotes: null,
        },
      ],
      deliveryEvidenceRequired: false,
    });
    // una sola consulta de productos para todas las órdenes, sin ids repetidos
    expect(state.requestedIds).toEqual([["p1", "gone"]]);
  });
});
