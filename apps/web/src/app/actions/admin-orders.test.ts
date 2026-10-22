import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Order } from "@workspace/domain/orders";

const state = vi.hoisted(() => ({
  order: null as unknown as Order,
  fulfillmentWrites: [] as string[],
  notify: null as unknown as ReturnType<typeof vi.fn>,
}));

vi.mock("@/lib/require-admin", () => ({ requireAdmin: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/staff-notifications", () => ({
  createStaffNotifications: () => ({ notifyNewOrderInQueue: state.notify, notifyDeliveryAssigned: vi.fn() }),
}));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleOrderRepository: class {
    async findById(id: string) {
      return id === state.order.id ? { ...state.order } : null;
    }
    async markAsPaid() {
      state.order.paymentStatus = "paid";
    }
    async updateFulfillmentStatus(_id: string, status: Order["fulfillmentStatus"]) {
      state.fulfillmentWrites.push(status);
      state.order.fulfillmentStatus = status;
    }
    async updatePaymentStatus(_id: string, status: Order["paymentStatus"]) {
      state.order.paymentStatus = status;
    }
  },
  DrizzleStockRepository: class {},
  DrizzleUserRepository: class {
    async listActiveByRole() {
      return [{ id: "d1" }];
    }
  },
}));

import { updateOrderStatusAction } from "./admin-orders";

beforeEach(() => {
  state.fulfillmentWrites = [];
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
    items: [],
  };
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
