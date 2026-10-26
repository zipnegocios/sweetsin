import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  created: [] as Array<Record<string, unknown>>,
}));

vi.mock("@workspace/domain/orders", () => ({
  createOrder: vi.fn(async (_deps: unknown, input: Record<string, unknown>) => {
    state.created.push(input);
    return { id: "o1", customerEmail: "a@b.co", totalCents: 1000 };
  }),
}));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleOrderRepository: class {},
  DrizzleProductRepository: class {},
  DrizzleSettingsRepository: class {
    async get() {
      return { deliveryFeeCents: 500 };
    }
  },
  DrizzleEmailLogRepository: class {
    async create() {}
  },
}));
vi.mock("@workspace/notifications", () => ({
  SmtpNotificationAdapter: class {
    async sendOrderConfirmation() {}
  },
  SmtpNotConfiguredError: class extends Error {},
}));
vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue(null) }));

import { placeOrderAction, type PlaceOrderInput } from "./checkout";

const base: PlaceOrderInput = {
  fulfillmentType: "self_delivery",
  deliveryAddress: "1 Test St, Test",
  name: "Jane",
  phone: "+61400000000",
  email: "jane@example.com",
  channel: "whatsapp",
  items: [{ productId: "11111111-1111-4111-8111-111111111111", quantity: 1 }],
  locale: "es",
};

beforeEach(() => {
  state.created.length = 0;
});

describe("placeOrderAction - deliveryNotes", () => {
  it("recorta las notas", async () => {
    await placeOrderAction({ ...base, deliveryNotes: "  Portón azul  " });
    expect(state.created[0].deliveryNotes).toBe("Portón azul");
  });

  it("convierte notas vacías o ausentes en null", async () => {
    await placeOrderAction({ ...base, deliveryNotes: "   " });
    await placeOrderAction(base);
    expect(state.created[0].deliveryNotes).toBeNull();
    expect(state.created[1].deliveryNotes).toBeNull();
  });

  it("rechaza notas de más de 500 caracteres", async () => {
    await expect(placeOrderAction({ ...base, deliveryNotes: "x".repeat(501) })).rejects.toThrow();
    expect(state.created).toHaveLength(0);
  });
});
