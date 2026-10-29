import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  created: [] as Array<Record<string, unknown>>,
  deps: [] as Array<Record<string, unknown>>,
  options: [] as Array<Record<string, unknown> | undefined>,
  autoSoldOutEnabled: true,
  createError: null as Error | null,
  stopStock: [] as Array<{ productId: string; currentStock: number }>,
  allStops: [] as Array<{ status: string; endTime: Date }>,
  findByIdCalls: 0,
  findByIdFails: false,
}));

vi.mock("@workspace/domain/orders", () => ({
  createOrder: vi.fn(
    async (deps: Record<string, unknown>, input: Record<string, unknown>, options?: Record<string, unknown>) => {
    if (state.createError) throw state.createError;
    state.deps.push(deps);
    state.created.push(input);
    state.options.push(options);
    return { id: "o1", customerEmail: "a@b.co", totalCents: 1000 };
    },
  ),
}));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleOrderRepository: class {},
  DrizzleProductRepository: class {
    async findById(id: string) {
      state.findByIdCalls++;
      if (state.findByIdFails) throw new Error("db down");
      return { id, nameEn: "Gluttony", nameEs: "Gula" };
    }
  },
  DrizzleCapacityRepository: class {},
  DrizzleStockRepository: class {
    async listByStop() {
      return state.stopStock;
    }
  },
  DrizzleTrailerStopRepository: class {
    async listAll() {
      return state.allStops;
    }
  },
  DrizzleSettingsRepository: class {
    async get() {
      return { deliveryFeeCents: 500, autoSoldOutEnabled: state.autoSoldOutEnabled };
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

import { CapacityRejectedError } from "@workspace/domain/capacity";
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

const STOP = "22222222-2222-4222-8222-222222222222";
const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  state.created.length = 0;
  state.deps.length = 0;
  state.options.length = 0;
  state.autoSoldOutEnabled = true;
  state.createError = null;
  state.stopStock = [];
  state.allStops = [];
  state.findByIdCalls = 0;
  state.findByIdFails = false;
});

describe("placeOrderAction - stopId", () => {
  const pickup: PlaceOrderInput = { ...base, fulfillmentType: "pickup", deliveryAddress: undefined };

  it("rechaza stopId con self_delivery sin crear la orden", async () => {
    await expect(placeOrderAction({ ...base, stopId: STOP })).rejects.toThrow();
    expect(state.created).toHaveLength(0);
  });

  it("acepta pickup con un UUID y lo pasa a createOrder", async () => {
    const result = await placeOrderAction({ ...pickup, stopId: STOP });
    expect(result).toEqual({ ok: true, orderId: "o1", totalCents: 1000 });
    expect(state.created[0].stopId).toBe(STOP);
  });

  it("rechaza un stopId que no es UUID", async () => {
    await expect(placeOrderAction({ ...pickup, stopId: "no-uuid" })).rejects.toThrow();
    expect(state.created).toHaveLength(0);
  });

  it("pasa autoSoldOutEnabled de Settings como enforceAvailability", async () => {
    await placeOrderAction({ ...pickup, stopId: STOP });
    state.autoSoldOutEnabled = false;
    await placeOrderAction({ ...pickup, stopId: STOP });
    expect(state.options).toEqual([{ enforceAvailability: true }, { enforceAvailability: false }]);
  });

  it("pickup sin parada con paradas elegibles se rechaza sin crear la orden", async () => {
    state.allStops = [{ status: "active", endTime: new Date(Date.now() - 1000) }];
    expect(await placeOrderAction(pickup)).toEqual({ ok: false, error: "stopUnavailable" });
    expect(state.created).toHaveLength(0);
  });

  it("producto no disponible con parada se traduce a stockChanged", async () => {
    state.createError = new Error("Product not available");
    state.stopStock = [{ productId: P1, currentStock: 3 }];
    const result = await placeOrderAction({ ...pickup, stopId: STOP });
    expect(result).toEqual({ ok: false, error: "stockChanged", available: [{ productId: P1, available: 3 }] });
  });

  it("producto no disponible sin parada devuelve stockChanged controlado", async () => {
    state.createError = new Error("Product not available");
    expect(await placeOrderAction(pickup)).toEqual({ ok: false, error: "stockChanged", available: [] });
  });

  it("pickup sin parada sigue mandando stopId null", async () => {
    await placeOrderAction(pickup);
    expect(state.created[0].stopId).toBeNull();
  });

  it("si el stock cambió devuelve el disponible de los productos pedidos con fila (sin fila = ausente)", async () => {
    state.createError = new Error("Quantity exceeds availability");
    state.stopStock = [
      { productId: P1, currentStock: 2 },
      { productId: "44444444-4444-4444-8444-444444444444", currentStock: 9 },
    ];
    const result = await placeOrderAction({
      ...pickup,
      stopId: STOP,
      items: [
        { productId: P1, quantity: 5 },
        { productId: P2, quantity: 1 },
      ],
    });
    expect(result).toEqual({
      ok: false,
      error: "stockChanged",
      available: [{ productId: P1, available: 2 }],
    });
  });

  it("traduce la parada no disponible a un código", async () => {
    state.createError = new Error("Stop not available");
    const result = await placeOrderAction({ ...pickup, stopId: STOP });
    expect(result).toEqual({ ok: false, error: "stopUnavailable" });
  });

  it("relanza errores que no son de parada ni de stock", async () => {
    state.createError = new Error("boom");
    await expect(placeOrderAction({ ...pickup, stopId: STOP })).rejects.toThrow("boom");
  });
});

describe("placeOrderAction - dependencias", () => {
  it("cablea paradas y stock en createOrder y manda stopId null sin parada", async () => {
    await placeOrderAction(base);
    expect(state.deps[0]).toEqual(
      expect.objectContaining({ stops: expect.any(Object), stock: expect.any(Object) }),
    );
    expect(state.created[0].stopId).toBeNull();
  });
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

describe("placeOrderAction - cantidades", () => {
  it("rechaza cantidades por encima de 10000", async () => {
    await expect(placeOrderAction({ ...base, items: [{ productId: P1, quantity: 10_001 }] })).rejects.toThrow();
  });
});

describe("placeOrderAction - capacidad", () => {
  const earliestAt = new Date("2026-11-01T01:00:00.000Z");

  it("pasa el repositorio de capacidad y scheduledFor (Date) solo en entrega a domicilio", async () => {
    await placeOrderAction({ ...base, scheduledFor: "2026-11-01T02:00:00.000Z" });
    expect(state.deps[0]).toHaveProperty("capacity");
    expect(state.created[0]?.scheduledFor).toEqual(new Date("2026-11-01T02:00:00.000Z"));
  });

  it("rechaza scheduledFor con retiro", async () => {
    await expect(
      placeOrderAction({ ...base, fulfillmentType: "pickup", deliveryAddress: undefined, scheduledFor: "2026-11-01T02:00:00.000Z" }),
    ).rejects.toThrow();
  });

  it("devuelve capacityRejected con razones serializables, nombre según locale y WhatsApp", async () => {
    state.createError = new CapacityRejectedError([
      { code: "over_delivery_cap", productId: P1, allowedQty: 2 },
      { code: "lead_time", productId: P1, earliestAt },
      { code: "over_vehicle_trips", maxTrips: 1, neededTrips: 3 },
    ]);
    const es = await placeOrderAction(base);
    expect(es).toEqual({
      ok: false,
      error: "capacityRejected",
      whatsappUrl: expect.stringContaining("https://wa.me/61433508831"),
      reasons: [
        { code: "over_delivery_cap", productId: P1, productName: "Gula", allowedQty: 2 },
        { code: "lead_time", productId: P1, productName: "Gula", earliestAt: earliestAt.toISOString() },
        { code: "over_vehicle_trips", maxTrips: 1, neededTrips: 3 },
      ],
    });
    JSON.stringify(es);
    const en = await placeOrderAction({ ...base, locale: "en" });
    expect(en.ok === false && en.error === "capacityRejected" && en.reasons[0]?.productName).toBe("Gluttony");
  });

  it("lee cada producto una sola vez aunque varias razones lo nombren", async () => {
    state.createError = new CapacityRejectedError([
      { code: "over_delivery_cap", productId: P1, allowedQty: 2 },
      { code: "lead_time", productId: P1, earliestAt },
    ]);
    await placeOrderAction(base);
    expect(state.findByIdCalls).toBe(1);
  });

  it("si falla la lectura del catálogo responde igual, sin nombre de producto", async () => {
    state.createError = new CapacityRejectedError([{ code: "over_delivery_cap", productId: P1, allowedQty: 2 }]);
    state.findByIdFails = true;
    const result = await placeOrderAction(base);
    expect(result).toMatchObject({
      ok: false,
      error: "capacityRejected",
      reasons: [{ code: "over_delivery_cap", productId: P1, allowedQty: 2 }],
    });
    expect(result.ok === false && result.error === "capacityRejected" && result.reasons[0]).not.toHaveProperty("productName");
  });
});
