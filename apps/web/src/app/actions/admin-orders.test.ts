import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Order } from "@workspace/domain/orders";

const state = vi.hoisted(() => ({
  order: null as unknown as Order,
  fulfillmentWrites: [] as string[],
  ctxs: [] as unknown[],
  stockOk: true,
  notify: null as unknown as ReturnType<typeof vi.fn>,
}));

vi.mock("@/lib/require-admin", () => ({ requireAdmin: vi.fn().mockResolvedValue({ userId: "admin-1" }) }));
vi.mock("@/lib/staff-notifications", () => ({
  createStaffNotifications: () => ({ notifyNewOrderInQueue: state.notify, notifyDeliveryAssigned: vi.fn() }),
}));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleOrderRepository: class {
    async findById(id: string) {
      return id === state.order.id ? { ...state.order } : null;
    }
    async markAsPaid(_id: string, ctx: unknown) {
      state.ctxs.push(ctx);
      state.order.paymentStatus = "paid";
    }
    async updateFulfillmentStatus(_id: string, status: Order["fulfillmentStatus"], ctx: unknown) {
      state.ctxs.push(ctx);
      state.fulfillmentWrites.push(status);
      state.order.fulfillmentStatus = status;
    }
    async updatePaymentStatus(_id: string, status: Order["paymentStatus"]) {
      state.order.paymentStatus = status;
    }
    async resolveAttention(_id: string, ctx: unknown) {
      state.ctxs.push(ctx);
      state.order.attentionReason = null;
      state.order.fulfillmentStatus = "received";
    }
  },
  DrizzleStockRepository: class {
    async decrementForOrder() {
      return state.stockOk ? { ok: true } : { ok: false, productId: "p1" };
    }
  },
  DrizzleTrailerStopRepository: class {},
  DrizzleSettingsRepository: class {
    async get() {
      return { timingEnabled: true };
    }
  },
  DrizzleUserRepository: class {
    async listActiveByRole() {
      return [{ id: "d1" }];
    }
  },
}));

import { updateOrderStatusAction, retryOrderStockAction, resolveOrderAttentionAction } from "./admin-orders";

const webCtx = { actorUserId: "admin-1", source: "web", record: true };

beforeEach(() => {
  state.fulfillmentWrites = [];
  state.ctxs = [];
  state.stockOk = true;
  state.notify = vi.fn();
  state.order = {
    id: "order-1",
    customerId: null,
    customerName: "Jane",
    customerEmail: "jane@example.com",
    customerPhone: "555-0100",
    fulfillmentType: "pickup",
    deliveryAddress: null,
    stopId: null,
    paymentStatus: "pending",
    fulfillmentStatus: "pending",
    subtotalCents: 1000,
    discountCents: 0,
    deliveryFeeCents: 0,
    totalCents: 1000,
    channel: "web",
    stripePaymentIntentId: null,
    assignedDeliveryUserId: null,
    attentionReason: null,
    items: [],
  } as unknown as Order;
});

describe("updateOrderStatusAction", () => {
  it("rechaza una transicion invalida y no escribe el estado", async () => {
    const result = await updateOrderStatusAction({ orderId: "order-1", fulfillmentStatus: "delivered" });

    expect(result).toEqual({ error: expect.stringContaining("Invalid transition") });
    expect(state.fulfillmentWrites).toEqual([]);
  });

  it("marcar paid sobre una orden pending la deja paid + received y notifica una sola vez", async () => {
    expect(await updateOrderStatusAction({ orderId: "order-1", paymentStatus: "paid" })).toEqual({ ok: true });
    expect(await updateOrderStatusAction({ orderId: "order-1", paymentStatus: "paid" })).toEqual({ ok: true });

    expect(state.order.paymentStatus).toBe("paid");
    expect(state.order.fulfillmentStatus).toBe("received");
    expect(state.notify).toHaveBeenCalledTimes(1);
  });

  it("aplica el pago primero y luego el cumplimiento cuando vienen ambos", async () => {
    const result = await updateOrderStatusAction({
      orderId: "order-1",
      paymentStatus: "paid",
      fulfillmentStatus: "received",
    });

    expect(result).toEqual({ ok: true });
    expect(state.order.fulfillmentStatus).toBe("received");
  });
});

describe("contexto de transicion", () => {
  it("updateOrderStatusAction registra pago y cumplimiento con el admin como actor web", async () => {
    await updateOrderStatusAction({ orderId: "order-1", paymentStatus: "paid" });
    expect(state.ctxs).toEqual([webCtx, webCtx]);
  });
});

describe("retryOrderStockAction / resolveOrderAttentionAction", () => {
  const attention = () => {
    Object.assign(state.order, { stopId: "s1", paymentStatus: "paid", attentionReason: "insufficient_stock:p1" });
  };

  it("retry descuenta y resuelve el pedido en atencion", async () => {
    attention();
    expect(await retryOrderStockAction("order-1")).toEqual({ ok: true });
    expect(state.order.fulfillmentStatus).toBe("received");
    expect(state.ctxs).toEqual([webCtx]);
  });

  it("retry devuelve el motivo de dominio si el stock sigue sin alcanzar", async () => {
    attention();
    state.stockOk = false;
    expect(await retryOrderStockAction("order-1")).toEqual({ ok: false, error: "Stock still insufficient" });
  });

  it("resolve marca resuelto sin tocar stock", async () => {
    attention();
    expect(await resolveOrderAttentionAction("order-1")).toEqual({ ok: true });
    expect(state.order.fulfillmentStatus).toBe("received");
  });

  it("resolve sobre un pedido sin atencion devuelve el conflicto y un error desconocido sale generico", async () => {
    expect(await resolveOrderAttentionAction("order-1")).toEqual({ ok: false, error: "Order does not require attention" });
    expect(await resolveOrderAttentionAction("missing")).toEqual({ ok: false, error: "generic" });
  });
});
