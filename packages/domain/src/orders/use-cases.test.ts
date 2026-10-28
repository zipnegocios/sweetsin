import { describe, it, expect, vi } from "vitest";
import {
  createOrder,
  confirmOrderPayment,
  listOrders,
  assignDeliveryToOrder,
  markOrderInPrep,
  markOrderReady,
  markOrderDelivered,
  changeOrderFulfillmentStatus,
  recordDeliveryEvidence,
  markPickupDelivered,
  retryOrderStock,
  resolveOrderAttention,
  isOrderConflictMessage,
} from "./use-cases";
import type { Order } from "./entities";
import type { OrderRepository, OrderFilters, TransitionContext } from "./ports";
import type { TrailerStop } from "../trailer-stops/entities";
import type { TrailerStopRepository } from "../trailer-stops/ports";
import type { Product } from "../products/entities";
import type { ProductRepository } from "../products/ports";
import type { StockRepository } from "../stock/ports";
import type { StopProductStock, StockEvent } from "../stock/entities";
import type { UserRepository } from "../users/ports";
import type { User } from "../users/entities";

function fakeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "gluttony",
    category: "sin",
    nameEn: "Gluttony",
    nameEs: "Gula",
    descriptionEn: "More than you should.",
    descriptionEs: "Más de lo que deberías.",
    priceCents: 1300,
    imageUrl: null,
    featured: false,
    available: true,
    ...overrides,
  };
}

function fakeProductRepo(products: Product[]): ProductRepository {
  return {
    async findById(id) {
      return products.find((p) => p.id === id) ?? null;
    },
    async findBySlug(slug) {
      return products.find((p) => p.slug === slug) ?? null;
    },
    async listAvailable() {
      return products.filter((p) => p.available);
    },
  };
}

function fakeOrderRepo(): OrderRepository & { created: Omit<Order, "id">[] } {
  const created: Omit<Order, "id">[] = [];
  return {
    created,
    async create(order) {
      created.push(order);
      return { ...order, id: `order-${created.length}` };
    },
    async findById() {
      return null;
    },
    async attachPaymentIntent() {},
    async markAsPaid() {},
    async listAll() {
      return [];
    },
    async listByCustomerId() {
      return [];
    },
    async updateFulfillmentStatus() {},
    async updatePaymentStatus() {},
    async findQueueForDespachador() {
      return [];
    },
    async findAssignedToDelivery() {
      return [];
    },
    async assignDelivery() {},
    async recordDeliveryEvidence() {},
  };
}

describe("createOrder", () => {
  it("computes subtotal, volume discount and total for a single line", async () => {
    const products = fakeProductRepo([fakeProduct({ id: "p1", priceCents: 1300 })]);
    const orders = fakeOrderRepo();

    const order = await createOrder(
      { products, orders },
      {
        customerId: null,
        customerName: "Jane Doe",
        customerEmail: "jane@example.com",
        customerPhone: "+61400000000",
        fulfillmentType: "pickup",
        deliveryAddress: null,
        deliveryNotes: null,
        stopId: null,
        deliveryFeeCents: 0,
        channel: "web",
        items: [{ productId: "p1", quantity: 20 }],
      },
    );

    // 20 x 1300 = 26000 subtotal; tier 20 -> 5% descuento -> 1235/u -> 24700 total
    expect(order.subtotalCents).toBe(26000);
    expect(order.discountCents).toBe(1300);
    expect(order.totalCents).toBe(24700);
    expect(order.paymentStatus).toBe("pending");
    expect(order.fulfillmentStatus).toBe("pending");
    expect(order.items).toEqual([
      { productId: "p1", quantity: 20, unitPriceCents: 1300, lineDiscountCents: 1300 },
    ]);
  });

  it("conserva deliveryNotes y guarda null cuando no viene", async () => {
    const products = fakeProductRepo([fakeProduct({ id: "p1", priceCents: 1000, category: "virtue" })]);
    const base = {
      customerId: null,
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",
      customerPhone: "+61400000000",
      fulfillmentType: "self_delivery" as const,
      deliveryAddress: "1 Test St",
      stopId: null,
      deliveryFeeCents: 500,
      channel: "web" as const,
      items: [{ productId: "p1", quantity: 1 }],
    };

    const withNotes = await createOrder({ products, orders: fakeOrderRepo() }, { ...base, deliveryNotes: "Timbre roto, llamar" });
    const withoutNotes = await createOrder({ products, orders: fakeOrderRepo() }, { ...base, deliveryNotes: null });

    expect(withNotes.deliveryNotes).toBe("Timbre roto, llamar");
    expect(withoutNotes.deliveryNotes).toBeNull();
  });

  it("adds the delivery fee on top of the discounted subtotal", async () => {
    const products = fakeProductRepo([fakeProduct({ id: "p1", priceCents: 1000, category: "virtue" })]);
    const orders = fakeOrderRepo();

    const order = await createOrder(
      { products, orders },
      {
        customerId: null,
        customerName: "Jane Doe",
        customerEmail: "jane@example.com",
        customerPhone: "+61400000000",
        fulfillmentType: "self_delivery",
        deliveryAddress: "1 Test St",
        deliveryNotes: null,
        stopId: null,
        deliveryFeeCents: 500,
        channel: "web",
        items: [{ productId: "p1", quantity: 2 }],
      },
    );

    expect(order.subtotalCents).toBe(2000);
    expect(order.discountCents).toBe(0);
    expect(order.totalCents).toBe(2500);
  });

  it("throws when the order has no items", async () => {
    const products = fakeProductRepo([]);
    const orders = fakeOrderRepo();

    await expect(
      createOrder(
        { products, orders },
        {
          customerId: null,
          customerName: "Jane Doe",
          customerEmail: "jane@example.com",
          customerPhone: "+61400000000",
          fulfillmentType: "pickup",
          deliveryAddress: null,
          deliveryNotes: null,
          stopId: null,
          deliveryFeeCents: 0,
          channel: "web",
          items: [],
        },
      ),
    ).rejects.toThrow("Order must have at least one item");
  });

  it("throws when a product does not exist", async () => {
    const products = fakeProductRepo([]);
    const orders = fakeOrderRepo();

    await expect(
      createOrder(
        { products, orders },
        {
          customerId: null,
          customerName: "Jane Doe",
          customerEmail: "jane@example.com",
          customerPhone: "+61400000000",
          fulfillmentType: "pickup",
          deliveryAddress: null,
          deliveryNotes: null,
          stopId: null,
          deliveryFeeCents: 0,
          channel: "web",
          items: [{ productId: "missing", quantity: 1 }],
        },
      ),
    ).rejects.toThrow("Product not found: missing");
  });
});

function fakeOrderRepoWithOrder(order: Order): OrderRepository & { paidCalls: string[] } {
  const paidCalls: string[] = [];
  return {
    paidCalls,
    async create(o) {
      return { ...o, id: "unused" };
    },
    async findById(id) {
      return id === order.id ? order : null;
    },
    async attachPaymentIntent() {},
    async markAsPaid(id, _ctx, attentionReason) {
      paidCalls.push(id);
      order.paymentStatus = "paid";
      if (attentionReason !== undefined) order.attentionReason = attentionReason;
    },
    async resolveAttention() {
      order.attentionReason = null;
      order.fulfillmentStatus = "received";
    },
    async listAll() {
      return [];
    },
    async listByCustomerId() {
      return [];
    },
    async updateFulfillmentStatus(_id, status) {
      order.fulfillmentStatus = status;
    },
    async updatePaymentStatus() {},
    async findQueueForDespachador() {
      return [];
    },
    async findAssignedToDelivery() {
      return [];
    },
    async assignDelivery() {},
    async recordDeliveryEvidence() {},
  };
}

function fakeStockRepo(
  stock: StopProductStock[],
): StockRepository & { events: Omit<StockEvent, "id">[]; reversals: string[] } {
  const events: Omit<StockEvent, "id">[] = [];
  const reversals: string[] = [];
  return {
    events,
    reversals,
    async findByStopAndProduct(stopId, productId) {
      return stock.find((s) => s.stopId === stopId && s.productId === productId) ?? null;
    },
    async decrementForOrder(stopId, orderId, lines) {
      const rows = lines.map((l) => stock.find((s) => s.stopId === stopId && s.productId === l.productId));
      const shortIdx = lines.findIndex((l, i) => !rows[i] || rows[i]!.currentStock < l.quantity);
      if (shortIdx !== -1) return { ok: false as const, productId: lines[shortIdx].productId };
      lines.forEach((l, i) => {
        rows[i]!.currentStock -= l.quantity;
        events.push({ stopProductStockId: rows[i]!.id, eventType: "sale", quantity: l.quantity, reason: null, reportedByUserId: null, orderId });
      });
      return { ok: true as const };
    },
    async reverseOrderSale(orderId) {
      reversals.push(orderId);
      const reversed = new Set(events.filter((e) => e.eventType === "sale_reversal" && e.orderId === orderId).map((e) => e.stopProductStockId));
      for (const sale of events.filter((e) => e.eventType === "sale" && e.orderId === orderId && !reversed.has(e.stopProductStockId))) {
        stock.find((s) => s.id === sale.stopProductStockId)!.currentStock += sale.quantity;
        events.push({ ...sale, eventType: "sale_reversal" });
      }
    },
    async decrementStock(id, quantity) {
      const item = stock.find((s) => s.id === id);
      if (!item) throw new Error("not found");
      item.currentStock -= quantity;
      return item;
    },
    async recordEvent(event) {
      events.push(event);
      return { ...event, id: `event-${events.length}` };
    },
  };
}

describe("confirmOrderPayment", () => {
  it("marks the order as paid and does nothing else when there is no stopId", async () => {
    const order: Order = {
      id: "order-1",
      customerId: null,
      customerName: "Jane",
      customerEmail: "jane@example.com",
      customerPhone: "+61400000000",
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
      stripePaymentIntentId: "pi_123",
      assignedDeliveryUserId: null,
      items: [{ productId: "p1", quantity: 1, unitPriceCents: 1000, lineDiscountCents: 0 }],
    };
    const orders = fakeOrderRepoWithOrder(order);
    const stock = fakeStockRepo([]);

    await confirmOrderPayment({ orders, stock }, "order-1");

    expect(orders.paidCalls).toEqual(["order-1"]);
    expect(stock.events).toHaveLength(0);
  });

  it("descuenta todas las líneas de una vez cuando el pedido tiene parada", async () => {
    const order: Order = {
      id: "order-2",
      customerId: null,
      customerName: "Jane",
      customerEmail: "jane@example.com",
      customerPhone: "+61400000000",
      fulfillmentType: "pickup",
      deliveryAddress: null,
      stopId: "stop-1",
      paymentStatus: "pending",
      fulfillmentStatus: "pending",
      subtotalCents: 2000,
      discountCents: 0,
      deliveryFeeCents: 0,
      totalCents: 2000,
      channel: "web",
      stripePaymentIntentId: "pi_456",
      assignedDeliveryUserId: null,
      items: [{ productId: "p1", quantity: 2, unitPriceCents: 1000, lineDiscountCents: 0 }],
    };
    const orders = fakeOrderRepoWithOrder(order);
    const stock = fakeStockRepo([{ id: "stock-1", stopId: "stop-1", productId: "p1", maxStock: 10, currentStock: 10 }]);

    await confirmOrderPayment({ orders, stock, stops: fakeStopRepo([fakeStop()]) }, "order-2");

    expect(stock.events).toEqual([
      { stopProductStockId: "stock-1", eventType: "sale", quantity: 2, reason: null, reportedByUserId: null, orderId: "order-2" },
    ]);
    expect(order.fulfillmentStatus).toBe("received");
  });

  it("is idempotent: does nothing if the order is already paid", async () => {
    const order: Order = {
      id: "order-3",
      customerId: null,
      customerName: "Jane",
      customerEmail: "jane@example.com",
      customerPhone: "+61400000000",
      fulfillmentType: "pickup",
      deliveryAddress: null,
      stopId: "stop-1",
      paymentStatus: "paid",
      fulfillmentStatus: "pending",
      subtotalCents: 1000,
      discountCents: 0,
      deliveryFeeCents: 0,
      totalCents: 1000,
      channel: "web",
      stripePaymentIntentId: "pi_789",
      assignedDeliveryUserId: null,
      items: [{ productId: "p1", quantity: 1, unitPriceCents: 1000, lineDiscountCents: 0 }],
    };
    const orders = fakeOrderRepoWithOrder(order);
    const stock = fakeStockRepo([{ id: "stock-1", stopId: "stop-1", productId: "p1", maxStock: 10, currentStock: 10 }]);

    await confirmOrderPayment({ orders, stock }, "order-3");

    expect(orders.paidCalls).toEqual([]);
    expect(stock.events).toHaveLength(0);
  });
});

describe("confirmOrderPayment: cola de despacho", () => {
  const pendingOrder = (overrides: Partial<Order> = {}): Order => ({
    id: "order-q",
    customerId: null,
    customerName: "Jane",
    customerEmail: "jane@example.com",
    customerPhone: "+61400000000",
    fulfillmentType: "pickup",
    deliveryAddress: null,
    stopId: "stop-1",
    paymentStatus: "pending",
    fulfillmentStatus: "pending",
    subtotalCents: 1000,
    discountCents: 0,
    deliveryFeeCents: 0,
    totalCents: 1000,
    channel: "web",
    stripePaymentIntentId: "pi_q",
    assignedDeliveryUserId: null,
    items: [{ productId: "p1", quantity: 1, unitPriceCents: 1000, lineDiscountCents: 0 }],
    ...overrides,
  });
  const stockFor = () => fakeStockRepo([{ id: "stock-1", stopId: "stop-1", productId: "p1", maxStock: 10, currentStock: 10 }]);
  const staff = () =>
    fakeUserRepo([
      fakeUser({ id: "d1", role: "despachador" }),
      fakeUser({ id: "d2", role: "despachador" }),
      fakeUser({ id: "d3", role: "despachador", isActive: false }),
    ]);

  it("mueve una orden pending a received", async () => {
    const order = pendingOrder();
    await confirmOrderPayment({ orders: fakeOrderRepoWithOrder(order), stock: stockFor(), stops: fakeStopRepo([fakeStop()]) }, "order-q");
    expect(order.fulfillmentStatus).toBe("received");
  });

  it("notifica una vez a los despachadores activos", async () => {
    const notify = vi.fn().mockResolvedValue(undefined);
    await confirmOrderPayment(
      {
        orders: fakeOrderRepoWithOrder(pendingOrder()),
        stock: stockFor(),
        stops: fakeStopRepo([fakeStop()]),
        users: staff(),
        notifications: { notifyNewOrderInQueue: notify, notifyDeliveryAssigned: vi.fn() },
      },
      "order-q",
    );
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(["d1", "d2"], { id: "order-q", customerName: "Jane" });
  });

  it("no falla si la notificacion falla: la orden queda paid y received", async () => {
    const order = pendingOrder();
    const notify = vi.fn().mockRejectedValue(new Error("push down"));
    await expect(
      confirmOrderPayment(
        {
          orders: fakeOrderRepoWithOrder(order),
          stock: stockFor(),
          stops: fakeStopRepo([fakeStop()]),
          users: staff(),
          notifications: { notifyNewOrderInQueue: notify, notifyDeliveryAssigned: vi.fn() },
        },
        "order-q",
      ),
    ).resolves.toBeUndefined();
    expect(notify).toHaveBeenCalled();
    expect(order.paymentStatus).toBe("paid");
    expect(order.fulfillmentStatus).toBe("received");
  });

  it("reintento sobre orden ya paid: no cambia estado, no notifica, no descuenta stock", async () => {
    const order = pendingOrder({ paymentStatus: "paid" });
    const stock = stockFor();
    const notify = vi.fn();
    await confirmOrderPayment(
      {
        orders: fakeOrderRepoWithOrder(order),
        stock,
        stops: fakeStopRepo([fakeStop()]),
        users: staff(),
        notifications: { notifyNewOrderInQueue: notify, notifyDeliveryAssigned: vi.fn() },
      },
      "order-q",
    );
    expect(order.fulfillmentStatus).toBe("pending");
    expect(notify).not.toHaveBeenCalled();
    expect(stock.events).toHaveLength(0);
  });

  it("orden que ya no esta pending: no vuelve a cambiar estado ni notifica", async () => {
    const order = pendingOrder({ fulfillmentStatus: "in_prep" });
    const notify = vi.fn();
    await confirmOrderPayment(
      {
        orders: fakeOrderRepoWithOrder(order),
        stock: stockFor(),
        stops: fakeStopRepo([fakeStop()]),
        users: staff(),
        notifications: { notifyNewOrderInQueue: notify, notifyDeliveryAssigned: vi.fn() },
      },
      "order-q",
    );
    expect(order.fulfillmentStatus).toBe("in_prep");
    expect(notify).not.toHaveBeenCalled();
  });
});

function fakeOrderRepoForListing(orders: Order[]): OrderRepository & { listAllCalls: OrderFilters[] } {
  const listAllCalls: OrderFilters[] = [];
  return {
    listAllCalls,
    async create(o) {
      return { ...o, id: "unused" };
    },
    async findById(id) {
      return orders.find((o) => o.id === id) ?? null;
    },
    async attachPaymentIntent() {},
    async markAsPaid() {},
    async listAll(filters) {
      listAllCalls.push(filters);
      return orders;
    },
    async listByCustomerId() {
      return orders;
    },
    async updateFulfillmentStatus() {},
    async updatePaymentStatus() {},
    async findQueueForDespachador() {
      return [];
    },
    async findAssignedToDelivery() {
      return [];
    },
    async assignDelivery() {},
    async recordDeliveryEvidence() {},
  };
}

describe("listOrders", () => {
  it("passes the filters through to the repository", async () => {
    const repo = fakeOrderRepoForListing([]);
    const filters: OrderFilters = { fulfillmentStatus: "pending" };

    await listOrders(repo, filters);

    expect(repo.listAllCalls).toEqual([filters]);
  });

  it("throws when dateFrom is after dateTo", async () => {
    const repo = fakeOrderRepoForListing([]);

    await expect(
      listOrders(repo, { dateFrom: "2026-09-20", dateTo: "2026-09-01" }),
    ).rejects.toThrow("dateFrom must not be after dateTo");
  });

  it("allows a filter with only dateFrom or only dateTo", async () => {
    const repo = fakeOrderRepoForListing([]);

    await expect(listOrders(repo, { dateFrom: "2026-09-01" })).resolves.toEqual([]);
    await expect(listOrders(repo, { dateTo: "2026-09-01" })).resolves.toEqual([]);
  });
});

type RepoCall = { method: string; args: unknown[] };

function makeFakeOrderRepo(
  orders: Order[],
): OrderRepository & { ctxs: (TransitionContext | undefined)[]; calls: RepoCall[] } {
  const store = new Map(orders.map((o) => [o.id, o]));
  const ctxs: (TransitionContext | undefined)[] = [];
  const calls: RepoCall[] = [];
  return {
    ctxs,
    calls,
    resolveAttention: async (id, ctx) => {
      calls.push({ method: "resolveAttention", args: [id, ctx] });
      ctxs.push(ctx);
      const o = store.get(id);
      if (o) store.set(id, { ...o, attentionReason: null, fulfillmentStatus: "received" });
    },
    cancelPendingOrdersForStop: async () => 0,
    countPaidUndeliveredForStop: async () => 0,
    countUndeliveredForStop: async () => 0,
    create: async (data) => {
      const order = { ...data, id: `order-${store.size + 1}` };
      store.set(order.id, order);
      return order;
    },
    findById: async (id) => store.get(id) ?? null,
    attachPaymentIntent: async () => {},
    markAsPaid: async (id, ctx, attentionReason) => {
      calls.push({ method: "markAsPaid", args: [id, ctx, attentionReason] });
      ctxs.push(ctx);
      const o = store.get(id);
      if (o) {
        store.set(id, {
          ...o,
          paymentStatus: "paid",
          ...(attentionReason !== undefined ? { attentionReason } : {}),
        });
      }
    },
    listAll: async () => [...store.values()],
    listByCustomerId: async () => [],
    updateFulfillmentStatus: async (id, status, ctx) => {
      calls.push({ method: "updateFulfillmentStatus", args: [id, status, ctx] });
      ctxs.push(ctx);
      const o = store.get(id);
      if (o) store.set(id, { ...o, fulfillmentStatus: status });
    },
    updatePaymentStatus: async () => {},
    findQueueForDespachador: async () =>
      [...store.values()].filter((o) => o.paymentStatus === "paid" && ["received", "in_prep"].includes(o.fulfillmentStatus)),
    findAssignedToDelivery: async (userId) =>
      [...store.values()].filter((o) => o.assignedDeliveryUserId === userId && o.fulfillmentStatus === "out_for_delivery"),
    assignDelivery: async (id, deliveryUserId, ctx) => {
      ctxs.push(ctx);
      const o = store.get(id);
      if (o) store.set(id, { ...o, assignedDeliveryUserId: deliveryUserId, fulfillmentStatus: "out_for_delivery" });
    },
    recordDeliveryEvidence: async (id, evidence) => {
      const o = store.get(id);
      if (o) {
        store.set(id, {
          ...o,
          deliveryEvidenceKey: evidence.key,
          deliveryEvidenceCapturedAt: evidence.capturedAt,
          deliveryEvidenceLat: evidence.lat,
          deliveryEvidenceLng: evidence.lng,
        });
      }
    },
  };
}

const baseOrder: Order = {
  id: "order-1",
  customerId: null,
  customerName: "Cliente",
  customerEmail: "cliente@example.com",
  customerPhone: "555-0100",
  fulfillmentType: "self_delivery",
  deliveryAddress: "Calle Falsa 123",
  stopId: null,
  paymentStatus: "paid",
  fulfillmentStatus: "received",
  subtotalCents: 1000,
  discountCents: 0,
  deliveryFeeCents: 0,
  totalCents: 1000,
  channel: "web",
  stripePaymentIntentId: null,
  assignedDeliveryUserId: null,
  items: [],
};

describe("markOrderInPrep / markOrderReady", () => {
  it("mueve received -> in_prep -> ready_for_pickup", async () => {
    const repo = makeFakeOrderRepo([baseOrder]);

    await markOrderInPrep({ orders: repo }, "order-1");
    expect((await repo.findById("order-1"))?.fulfillmentStatus).toBe("in_prep");

    await markOrderReady({ orders: repo }, "order-1");
    expect((await repo.findById("order-1"))?.fulfillmentStatus).toBe("ready_for_pickup");
  });

  it("rechaza marcar ready si no esta in_prep", async () => {
    const repo = makeFakeOrderRepo([baseOrder]);
    await expect(markOrderReady({ orders: repo }, "order-1")).rejects.toThrow();
  });
});

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: "delivery-1",
    name: "Delivery Uno",
    email: "delivery1@example.com",
    role: "delivery",
    pinHash: "hash",
    passwordHash: null,
    isActive: true,
    preferredLocale: "en",
    failedPinAttempts: 0,
    pinLockedUntil: null,
    ...overrides,
  };
}

function fakeUserRepo(users: User[]): UserRepository {
  return {
    async findById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async findByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async listActiveByRole(role) {
      return users.filter((u) => u.role === role && u.isActive);
    },
    async listByRole(role) {
      return users.filter((u) => u.role === role);
    },
    async create(user) {
      return { ...user, id: `user-${users.length + 1}` };
    },
    async update(id, data) {
      const user = users.find((u) => u.id === id);
      if (!user) throw new Error("not found");
      return { ...user, ...data };
    },
    async recordFailedPinAttempt() {},
    async resetPinAttempts() {},
    async deleteStaff() {},
  };
}

describe("assignDeliveryToOrder", () => {
  it("asigna y pasa a out_for_delivery cuando esta ready_for_pickup", async () => {
    const repo = makeFakeOrderRepo([{ ...baseOrder, fulfillmentStatus: "ready_for_pickup" }]);
    const users = fakeUserRepo([fakeUser()]);

    const updated = await assignDeliveryToOrder({ orders: repo, users }, "order-1", "delivery-1");

    expect(updated.assignedDeliveryUserId).toBe("delivery-1");
    expect(updated.fulfillmentStatus).toBe("out_for_delivery");
  });

  it("rechaza si la orden no esta ready_for_pickup", async () => {
    const repo = makeFakeOrderRepo([baseOrder]);
    const users = fakeUserRepo([fakeUser()]);
    await expect(assignDeliveryToOrder({ orders: repo, users }, "order-1", "delivery-1")).rejects.toThrow();
  });

  it("rechaza si el deliveryUserId no existe", async () => {
    const repo = makeFakeOrderRepo([{ ...baseOrder, fulfillmentStatus: "ready_for_pickup" }]);
    const users = fakeUserRepo([]);
    await expect(assignDeliveryToOrder({ orders: repo, users }, "order-1", "missing-user")).rejects.toThrow(
      "Invalid delivery user: missing-user",
    );
  });

  it("rechaza si el usuario existe pero su role no es delivery", async () => {
    const repo = makeFakeOrderRepo([{ ...baseOrder, fulfillmentStatus: "ready_for_pickup" }]);
    const users = fakeUserRepo([fakeUser({ role: "despachador" })]);
    await expect(assignDeliveryToOrder({ orders: repo, users }, "order-1", "delivery-1")).rejects.toThrow(
      "Invalid delivery user: delivery-1",
    );
  });

  it("rechaza si el usuario delivery esta inactivo", async () => {
    const repo = makeFakeOrderRepo([{ ...baseOrder, fulfillmentStatus: "ready_for_pickup" }]);
    const users = fakeUserRepo([fakeUser({ isActive: false })]);
    await expect(assignDeliveryToOrder({ orders: repo, users }, "order-1", "delivery-1")).rejects.toThrow(
      "Invalid delivery user: delivery-1",
    );
  });
});

describe("assignDeliveryToOrder con notificacion", () => {
  it("notifica al delivery asignado y no falla si la notificacion falla", async () => {
    const repo = makeFakeOrderRepo([{ ...baseOrder, fulfillmentStatus: "ready_for_pickup" }]);
    const users = fakeUserRepo([fakeUser()]);
    const notify = vi.fn().mockRejectedValue(new Error("push service down"));

    const updated = await assignDeliveryToOrder(
      { orders: repo, users, notifications: { notifyDeliveryAssigned: notify, notifyNewOrderInQueue: vi.fn() } },
      "order-1",
      "delivery-1",
    );

    expect(updated.assignedDeliveryUserId).toBe("delivery-1");
    expect(notify).toHaveBeenCalledWith("delivery-1", expect.objectContaining({ id: "order-1" }));
  });
});

describe("markOrderDelivered", () => {
  it("marca delivered si el actingUserId es el asignado", async () => {
    const repo = makeFakeOrderRepo([
      { ...baseOrder, fulfillmentStatus: "out_for_delivery", assignedDeliveryUserId: "delivery-1" },
    ]);

    const updated = await markOrderDelivered({ orders: repo }, "order-1", "delivery-1");

    expect(updated.fulfillmentStatus).toBe("delivered");
  });

  it("rechaza si el actingUserId no es el asignado", async () => {
    const repo = makeFakeOrderRepo([
      { ...baseOrder, fulfillmentStatus: "out_for_delivery", assignedDeliveryUserId: "delivery-1" },
    ]);

    await expect(markOrderDelivered({ orders: repo }, "order-1", "delivery-2")).rejects.toThrow();
  });

  it("es idempotente: el mismo delivery reintenta sobre una orden ya delivered", async () => {
    const repo = makeFakeOrderRepo([
      { ...baseOrder, fulfillmentStatus: "delivered", assignedDeliveryUserId: "delivery-1" },
    ]);
    const spy = vi.spyOn(repo, "updateFulfillmentStatus");

    const result = await markOrderDelivered({ orders: repo }, "order-1", "delivery-1");

    expect(result.fulfillmentStatus).toBe("delivered");
    expect(spy).not.toHaveBeenCalled();
  });

  it("rechaza el reintento de otro usuario sobre una orden ya delivered", async () => {
    const repo = makeFakeOrderRepo([
      { ...baseOrder, fulfillmentStatus: "delivered", assignedDeliveryUserId: "delivery-1" },
    ]);

    await expect(markOrderDelivered({ orders: repo }, "order-1", "delivery-2")).rejects.toThrow();
  });
});

describe("changeOrderFulfillmentStatus", () => {
  const withStatus = (fulfillmentStatus: Order["fulfillmentStatus"], extra: Partial<Order> = {}) =>
    makeFakeOrderRepo([{ ...baseOrder, fulfillmentStatus, ...extra }]);
  const change = (
    repo: OrderRepository,
    target: Order["fulfillmentStatus"],
    options?: { deliveryUserId?: string },
    users: User[] = [fakeUser()],
  ) => changeOrderFulfillmentStatus({ orders: repo, users: fakeUserRepo(users) }, "order-1", target, options);
  const statusOf = async (repo: OrderRepository) => (await repo.findById("order-1"))?.fulfillmentStatus;

  it("rechaza pending -> delivered", async () => {
    const repo = withStatus("pending");
    await expect(change(repo, "delivered")).rejects.toThrow("Invalid transition: pending → delivered");
  });

  it("permite pending -> received", async () => {
    const repo = withStatus("pending");
    await change(repo, "received");
    expect(await statusOf(repo)).toBe("received");
  });

  it("permite received -> in_prep", async () => {
    const repo = withStatus("received");
    await change(repo, "in_prep");
    expect(await statusOf(repo)).toBe("in_prep");
  });

  it("permite in_prep -> ready_for_pickup", async () => {
    const repo = withStatus("in_prep");
    await change(repo, "ready_for_pickup");
    expect(await statusOf(repo)).toBe("ready_for_pickup");
  });

  it("ready_for_pickup -> out_for_delivery rechaza sin deliveryUserId", async () => {
    const repo = withStatus("ready_for_pickup");
    await expect(change(repo, "out_for_delivery")).rejects.toThrow();
    expect(await statusOf(repo)).toBe("ready_for_pickup");
  });

  it("ready_for_pickup -> out_for_delivery asigna al delivery activo", async () => {
    const repo = withStatus("ready_for_pickup");
    const updated = await change(repo, "out_for_delivery", { deliveryUserId: "delivery-1" });
    expect(updated.assignedDeliveryUserId).toBe("delivery-1");
    expect(await statusOf(repo)).toBe("out_for_delivery");
  });

  it("permite out_for_delivery -> delivered", async () => {
    const repo = withStatus("out_for_delivery", { assignedDeliveryUserId: "delivery-1" });
    await change(repo, "delivered");
    expect(await statusOf(repo)).toBe("delivered");
  });

  it("rechaza delivered -> in_prep (terminal)", async () => {
    const repo = withStatus("delivered");
    await expect(change(repo, "in_prep")).rejects.toThrow("Invalid transition: delivered → in_prep");
  });

  it.each(["pending", "received", "in_prep", "ready_for_pickup", "out_for_delivery"] as const)(
    "permite %s -> cancelled",
    async (from) => {
      const repo = withStatus(from);
      await change(repo, "cancelled");
      expect(await statusOf(repo)).toBe("cancelled");
    },
  );

  it("mismo estado: sin escritura", async () => {
    const repo = withStatus("in_prep");
    const spy = vi.spyOn(repo, "updateFulfillmentStatus");
    await change(repo, "in_prep");
    expect(spy).not.toHaveBeenCalled();
  });

  it("rechaza si la orden no existe", async () => {
    const repo = makeFakeOrderRepo([]);
    await expect(change(repo, "received")).rejects.toThrow("Order not found: order-1");
  });
});

describe("recordDeliveryEvidence", () => {
  const evidence = { key: "delivery-evidence/order-1/u1.jpg", capturedAt: new Date("2026-10-20T12:00:00Z"), lat: 25.7, lng: -80.2 };
  const assigned = (status: Order["fulfillmentStatus"]) =>
    makeFakeOrderRepo([{ ...baseOrder, fulfillmentStatus: status, assignedDeliveryUserId: "delivery-1" }]);

  it.each(["out_for_delivery", "delivered"] as const)("registra la evidencia con el usuario asignado en %s", async (status) => {
    const repo = assigned(status);

    await recordDeliveryEvidence({ orders: repo }, "order-1", "delivery-1", evidence);

    const stored = await repo.findById("order-1");
    expect(stored?.deliveryEvidenceKey).toBe(evidence.key);
    expect(stored?.deliveryEvidenceLat).toBe(25.7);
  });

  it("rechaza un usuario no asignado", async () => {
    await expect(
      recordDeliveryEvidence({ orders: assigned("out_for_delivery") }, "order-1", "delivery-2", evidence),
    ).rejects.toThrow();
  });

  it("rechaza el estado ready_for_pickup", async () => {
    await expect(
      recordDeliveryEvidence({ orders: assigned("ready_for_pickup") }, "order-1", "delivery-1", evidence),
    ).rejects.toThrow();
  });

  it("rechaza lat fuera de rango", async () => {
    await expect(
      recordDeliveryEvidence({ orders: assigned("delivered") }, "order-1", "delivery-1", { ...evidence, lat: 91 }),
    ).rejects.toThrow();
  });

  it("rechaza lng fuera de rango", async () => {
    await expect(
      recordDeliveryEvidence({ orders: assigned("delivered") }, "order-1", "delivery-1", { ...evidence, lng: -181 }),
    ).rejects.toThrow();
  });

  it("rechaza una key vacia", async () => {
    await expect(
      recordDeliveryEvidence({ orders: assigned("delivered") }, "order-1", "delivery-1", { ...evidence, key: "" }),
    ).rejects.toThrow();
  });

  it("rechaza una orden inexistente", async () => {
    await expect(
      recordDeliveryEvidence({ orders: makeFakeOrderRepo([]) }, "nope", "delivery-1", evidence),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Proyecto 3: retiro entregado, descuento todo o nada, atención, cancelación y ctx
// ---------------------------------------------------------------------------

const ctx: TransitionContext = { actorUserId: "admin-1", source: "web", record: true };

const pickupOrder = (overrides: Partial<Order> = {}): Order => ({
  ...baseOrder,
  id: "order-1",
  fulfillmentType: "pickup",
  deliveryAddress: null,
  stopId: "stop-1",
  paymentStatus: "pending",
  fulfillmentStatus: "pending",
  items: [
    { productId: "p1", quantity: 2, unitPriceCents: 1000, lineDiscountCents: 0 },
    { productId: "p2", quantity: 3, unitPriceCents: 1000, lineDiscountCents: 0 },
  ],
  ...overrides,
});

const stockRows = (p1: number, p2: number): StopProductStock[] => [
  { id: "s1", stopId: "stop-1", productId: "p1", maxStock: 10, currentStock: p1 },
  { id: "s2", stopId: "stop-1", productId: "p2", maxStock: 10, currentStock: p2 },
];

function fakeStop(overrides: Partial<TrailerStop> = {}): TrailerStop {
  return {
    id: "stop-1",
    location: "Rundle Mall",
    lat: -34.92,
    lng: 138.6,
    startTime: new Date(Date.now() - 3_600_000),
    endTime: new Date(Date.now() + 3_600_000),
    status: "active",
    originalLocation: null,
    originalLat: null,
    originalLng: null,
    originalStartTime: null,
    originalEndTime: null,
    ...overrides,
  };
}

function fakeStopRepo(stops: TrailerStop[]): TrailerStopRepository {
  return {
    findById: async (id) => stops.find((s) => s.id === id) ?? null,
    listVisible: async () => stops,
    listAll: async () => stops,
    create: async () => {
      throw new Error("unused");
    },
    updateStatus: async () => {},
    update: async () => {},
    countOrders: async () => 0,
    deleteWithStock: async () => {},
  };
}

describe("markPickupDelivered", () => {
  it("entrega un retiro ready_for_pickup sin repartidor y pasa el ctx", async () => {
    const repo = makeFakeOrderRepo([pickupOrder({ paymentStatus: "paid", fulfillmentStatus: "ready_for_pickup" })]);
    const updated = await markPickupDelivered({ orders: repo }, "order-1", ctx);
    expect(updated.fulfillmentStatus).toBe("delivered");
    expect((await repo.findById("order-1"))?.fulfillmentStatus).toBe("delivered");
    expect(repo.ctxs).toEqual([ctx]);
  });

  it("rechaza un pedido self_delivery", async () => {
    const repo = makeFakeOrderRepo([{ ...baseOrder, fulfillmentStatus: "ready_for_pickup" }]);
    await expect(markPickupDelivered({ orders: repo }, "order-1")).rejects.toThrow("Only pickup orders can be handed over");
  });

  it("rechaza si no está ready_for_pickup", async () => {
    const repo = makeFakeOrderRepo([pickupOrder({ fulfillmentStatus: "in_prep" })]);
    await expect(markPickupDelivered({ orders: repo }, "order-1")).rejects.toThrow(
      "Cannot mark delivered from status: in_prep",
    );
  });
});

describe("changeOrderFulfillmentStatus: delivered por tipo, cancelación y ctx", () => {
  const users = () => fakeUserRepo([fakeUser()]);

  it("retiro: ready_for_pickup -> delivered sin repartidor", async () => {
    const repo = makeFakeOrderRepo([pickupOrder({ paymentStatus: "paid", fulfillmentStatus: "ready_for_pickup" })]);
    await changeOrderFulfillmentStatus({ orders: repo, users: users() }, "order-1", "delivered", { ctx });
    expect((await repo.findById("order-1"))?.fulfillmentStatus).toBe("delivered");
    expect(repo.ctxs).toEqual([ctx]);
  });

  it("delivery: out_for_delivery -> delivered con el repartidor asignado y ctx", async () => {
    const repo = makeFakeOrderRepo([
      { ...baseOrder, fulfillmentStatus: "out_for_delivery", assignedDeliveryUserId: "delivery-1" },
    ]);
    await changeOrderFulfillmentStatus({ orders: repo, users: users() }, "order-1", "delivered", { ctx });
    expect((await repo.findById("order-1"))?.fulfillmentStatus).toBe("delivered");
    expect(repo.ctxs).toEqual([ctx]);
  });

  it("delivery: ready_for_pickup -> delivered se rechaza (exige repartidor)", async () => {
    const repo = makeFakeOrderRepo([{ ...baseOrder, fulfillmentStatus: "ready_for_pickup" }]);
    await expect(
      changeOrderFulfillmentStatus({ orders: repo, users: users() }, "order-1", "delivered"),
    ).rejects.toThrow("Order has no assigned delivery user");
  });

  it("pasa el ctx en in_prep, ready_for_pickup y out_for_delivery", async () => {
    const repo = makeFakeOrderRepo([{ ...baseOrder, fulfillmentStatus: "received" }]);
    const deps = { orders: repo, users: users() };
    await changeOrderFulfillmentStatus(deps, "order-1", "in_prep", { ctx });
    await changeOrderFulfillmentStatus(deps, "order-1", "ready_for_pickup", { ctx });
    await changeOrderFulfillmentStatus(deps, "order-1", "out_for_delivery", { ctx, deliveryUserId: "delivery-1" });
    expect(repo.ctxs).toEqual([ctx, ctx, ctx]);
  });

  it("cancelar un pagado con stock revierte una vez; cancelar de nuevo no revierte", async () => {
    const rows = stockRows(10, 10);
    const stock = fakeStockRepo(rows);
    const repo = makeFakeOrderRepo([pickupOrder()]);
    await confirmOrderPayment({ orders: repo, stock, stops: fakeStopRepo([fakeStop()]) }, "order-1");
    expect(rows.map((r) => r.currentStock)).toEqual([8, 7]);

    await changeOrderFulfillmentStatus({ orders: repo, users: users(), stock }, "order-1", "cancelled", { ctx });
    await changeOrderFulfillmentStatus({ orders: repo, users: users(), stock }, "order-1", "cancelled", { ctx });

    expect(stock.reversals).toEqual(["order-1"]);
    expect(stock.events.filter((e) => e.eventType === "sale_reversal")).toHaveLength(2);
    expect(rows.map((r) => r.currentStock)).toEqual([10, 10]);
    expect((await repo.findById("order-1"))?.fulfillmentStatus).toBe("cancelled");
    expect(repo.ctxs.at(-1)).toEqual(ctx);
  });

  it("cancelar un pedido en atención no revierte (no se descontó nada)", async () => {
    const stock = fakeStockRepo(stockRows(10, 10));
    const repo = makeFakeOrderRepo([pickupOrder({ paymentStatus: "paid", attentionReason: "insufficient_stock:p2" })]);
    await changeOrderFulfillmentStatus({ orders: repo, users: users(), stock }, "order-1", "cancelled");
    expect(stock.reversals).toEqual([]);
    expect((await repo.findById("order-1"))?.fulfillmentStatus).toBe("cancelled");
  });

  it("cancelar un pedido sin pagar no revierte", async () => {
    const stock = fakeStockRepo(stockRows(10, 10));
    const repo = makeFakeOrderRepo([pickupOrder()]);
    await changeOrderFulfillmentStatus({ orders: repo, users: users(), stock }, "order-1", "cancelled");
    expect(stock.reversals).toEqual([]);
  });

  it("un pedido en atención no avanza por el cambio de estado genérico", async () => {
    const repo = makeFakeOrderRepo([pickupOrder({ paymentStatus: "paid", attentionReason: "stop_cancelled" })]);
    await expect(
      changeOrderFulfillmentStatus({ orders: repo, users: users() }, "order-1", "received"),
    ).rejects.toThrow("Order requires attention");
  });
});

describe("confirmOrderPayment: descuento todo o nada", () => {
  it("con stock suficiente descuenta todas las líneas, pasa a received y pasa el ctx", async () => {
    const rows = stockRows(5, 5);
    const stock = fakeStockRepo(rows);
    const repo = makeFakeOrderRepo([pickupOrder()]);
    const webhookCtx: TransitionContext = { actorUserId: null, source: "webhook", record: true };
    await confirmOrderPayment({ orders: repo, stock, stops: fakeStopRepo([fakeStop()]) }, "order-1", webhookCtx);
    expect(rows.map((r) => r.currentStock)).toEqual([3, 2]);
    const order = await repo.findById("order-1");
    expect(order?.paymentStatus).toBe("paid");
    expect(order?.fulfillmentStatus).toBe("received");
    expect(order?.attentionReason ?? null).toBeNull();
    expect(repo.ctxs).toEqual([webhookCtx, webhookCtx]);
  });

  it("con una línea corta no descuenta nada, queda pending con atención y no notifica", async () => {
    const rows = stockRows(5, 2);
    const stock = fakeStockRepo(rows);
    const repo = makeFakeOrderRepo([pickupOrder()]);
    const notify = vi.fn();
    await confirmOrderPayment(
      {
        orders: repo,
        stock,
        stops: fakeStopRepo([fakeStop()]),
        users: fakeUserRepo([fakeUser({ id: "d1", role: "despachador" })]),
        notifications: { notifyNewOrderInQueue: notify, notifyDeliveryAssigned: vi.fn() },
      },
      "order-1",
    );
    expect(rows.map((r) => r.currentStock)).toEqual([5, 2]);
    expect(stock.events).toHaveLength(0);
    const order = await repo.findById("order-1");
    expect(order?.paymentStatus).toBe("paid");
    expect(order?.fulfillmentStatus).toBe("pending");
    expect(order?.attentionReason).toBe("insufficient_stock:p2");
    expect(notify).not.toHaveBeenCalled();
  });

  it("parada cancelada: no descuenta y queda en atención stop_cancelled", async () => {
    const rows = stockRows(5, 5);
    const repo = makeFakeOrderRepo([pickupOrder()]);
    await confirmOrderPayment(
      { orders: repo, stock: fakeStockRepo(rows), stops: fakeStopRepo([fakeStop({ status: "cancelled" })]) },
      "order-1",
    );
    expect(rows.map((r) => r.currentStock)).toEqual([5, 5]);
    const order = await repo.findById("order-1");
    expect(order?.paymentStatus).toBe("paid");
    expect(order?.fulfillmentStatus).toBe("pending");
    expect(order?.attentionReason).toBe("stop_cancelled");
  });

  it("parada cerrada (completed): el pago sigue descontando normalmente", async () => {
    const rows = stockRows(5, 5);
    const repo = makeFakeOrderRepo([pickupOrder()]);
    await confirmOrderPayment(
      { orders: repo, stock: fakeStockRepo(rows), stops: fakeStopRepo([fakeStop({ status: "completed" })]) },
      "order-1",
    );
    expect(rows.map((r) => r.currentStock)).toEqual([3, 2]);
    expect((await repo.findById("order-1"))?.fulfillmentStatus).toBe("received");
  });

  it("pago repetido no descuenta dos veces", async () => {
    const rows = stockRows(5, 5);
    const stock = fakeStockRepo(rows);
    const repo = makeFakeOrderRepo([pickupOrder()]);
    await confirmOrderPayment({ orders: repo, stock, stops: fakeStopRepo([fakeStop()]) }, "order-1");
    await confirmOrderPayment({ orders: repo, stock, stops: fakeStopRepo([fakeStop()]) }, "order-1");
    expect(rows.map((r) => r.currentStock)).toEqual([3, 2]);
    expect(stock.events.filter((e) => e.eventType === "sale")).toHaveLength(2);
  });
});

describe("retryOrderStock / resolveOrderAttention", () => {
  it("tras reponer, el reintento descuenta y deja received sin atención", async () => {
    const rows = stockRows(5, 2);
    const stock = fakeStockRepo(rows);
    const repo = makeFakeOrderRepo([pickupOrder()]);
    await confirmOrderPayment({ orders: repo, stock, stops: fakeStopRepo([fakeStop()]) }, "order-1");
    expect((await repo.findById("order-1"))?.attentionReason).toBe("insufficient_stock:p2");

    rows[1].currentStock = 6; // reposición
    const updated = await retryOrderStock({ orders: repo, stock }, "order-1", ctx);

    expect(updated.fulfillmentStatus).toBe("received");
    const order = await repo.findById("order-1");
    expect(order?.fulfillmentStatus).toBe("received");
    expect(order?.attentionReason).toBeNull();
    expect(rows.map((r) => r.currentStock)).toEqual([3, 3]);
    expect(repo.ctxs.at(-1)).toEqual(ctx);
  });

  it("si sigue sin alcanzar lanza y no toca nada", async () => {
    const rows = stockRows(5, 2);
    const repo = makeFakeOrderRepo([pickupOrder({ paymentStatus: "paid", attentionReason: "insufficient_stock:p2" })]);
    await expect(retryOrderStock({ orders: repo, stock: fakeStockRepo(rows) }, "order-1")).rejects.toThrow(
      "Stock still insufficient",
    );
    expect(rows.map((r) => r.currentStock)).toEqual([5, 2]);
    expect((await repo.findById("order-1"))?.attentionReason).toBe("insufficient_stock:p2");
  });

  it("reintentar sin atención se rechaza", async () => {
    const repo = makeFakeOrderRepo([pickupOrder({ paymentStatus: "paid" })]);
    await expect(retryOrderStock({ orders: repo, stock: fakeStockRepo(stockRows(5, 5)) }, "order-1")).rejects.toThrow(
      "Order does not require attention",
    );
  });

  it("resolveOrderAttention limpia la atención y pasa a received sin tocar stock", async () => {
    const repo = makeFakeOrderRepo([pickupOrder({ paymentStatus: "paid", attentionReason: "stop_cancelled" })]);
    const updated = await resolveOrderAttention({ orders: repo }, "order-1", ctx);
    expect(updated.fulfillmentStatus).toBe("received");
    const order = await repo.findById("order-1");
    expect(order?.attentionReason).toBeNull();
    expect(order?.fulfillmentStatus).toBe("received");
    expect(repo.ctxs).toEqual([ctx]);
  });

  it("resolveOrderAttention sin atención se rechaza", async () => {
    const repo = makeFakeOrderRepo([pickupOrder({ paymentStatus: "paid" })]);
    await expect(resolveOrderAttention({ orders: repo }, "order-1")).rejects.toThrow("Order does not require attention");
  });
});

describe("createOrder con parada", () => {
  type Input = Parameters<typeof createOrder>[1];
  const input = (overrides: Partial<Input> = {}): Input => ({
    customerId: null,
    customerName: "Jane",
    customerEmail: "jane@example.com",
    customerPhone: "+61400000000",
    fulfillmentType: "pickup",
    deliveryAddress: null,
    deliveryNotes: null,
    stopId: "stop-1",
    deliveryFeeCents: 0,
    channel: "web",
    items: [
      { productId: "p1", quantity: 2 },
      { productId: "p2", quantity: 3 },
    ],
    ...overrides,
  });
  const products = () => fakeProductRepo([fakeProduct({ id: "p1" }), fakeProduct({ id: "p2", slug: "pride" })]);
  const deps = (stop: TrailerStop | null, rows: StopProductStock[] = stockRows(5, 5)) => ({
    products: products(),
    orders: fakeOrderRepo(),
    stops: fakeStopRepo(stop ? [stop] : []),
    stock: fakeStockRepo(rows),
  });

  it("acepta un retiro válido en una parada activa o programada", async () => {
    await expect(createOrder(deps(fakeStop()), input())).resolves.toMatchObject({ stopId: "stop-1" });
    await expect(createOrder(deps(fakeStop({ status: "scheduled" })), input())).resolves.toMatchObject({
      stopId: "stop-1",
    });
  });

  it("rechaza delivery con parada", async () => {
    await expect(
      createOrder(deps(fakeStop()), input({ fulfillmentType: "self_delivery", deliveryAddress: "1 Test St" })),
    ).rejects.toThrow("Only pickup orders can target a stop");
  });

  it("rechaza parada inexistente", async () => {
    await expect(createOrder(deps(null), input())).rejects.toThrow("Stop not found");
  });

  it.each(["completed", "cancelled"] as const)("rechaza parada %s", async (status) => {
    await expect(createOrder(deps(fakeStop({ status })), input())).rejects.toThrow("Stop not available");
  });

  it("rechaza parada vencida", async () => {
    await expect(createOrder(deps(fakeStop({ endTime: new Date(Date.now() - 60_000) })), input())).rejects.toThrow(
      "Stop not available",
    );
  });

  it("rechaza producto sin fila de stock en la parada", async () => {
    await expect(createOrder(deps(fakeStop(), stockRows(5, 5).slice(0, 1)), input())).rejects.toThrow(
      "Product not available at this stop",
    );
  });

  it("rechaza cantidad mayor a la disponible", async () => {
    await expect(createOrder(deps(fakeStop(), stockRows(5, 2)), input())).rejects.toThrow(
      "Quantity exceeds availability",
    );
  });

  it("sin parada no valida parada ni stock", async () => {
    await expect(createOrder({ products: products(), orders: fakeOrderRepo() }, input({ stopId: null }))).resolves.toMatchObject({
      stopId: null,
    });
  });
});

describe("isOrderConflictMessage", () => {
  it("reconoce los mensajes de negocio y no otros", () => {
    for (const m of [
      "Only pickup orders can target a stop",
      "Stop not found",
      "Stop not available",
      "Product not available at this stop",
      "Quantity exceeds availability",
      "Only pickup orders can be handed over",
      "Stock still insufficient",
      "Order does not require attention",
      "Order requires attention",
      "Invalid transition: delivered → in_prep",
      "Cannot mark delivered from status: in_prep",
      "Cannot move to in_prep from status: pending",
      "Invalid delivery user: u1",
    ]) expect(isOrderConflictMessage(m)).toBe(true);
    expect(isOrderConflictMessage("Order not found: x")).toBe(false);
    expect(isOrderConflictMessage("boom")).toBe(false);
  });

  it("los errores de cableado no son conflictos (deben salir como 500)", () => {
    expect(isOrderConflictMessage("Stops repository is required to confirm a stop order")).toBe(false);
    expect(isOrderConflictMessage("Stock repository is required to cancel a paid stop order")).toBe(false);
  });
});

describe("escrituras atómicas y dependencias obligatorias", () => {
  const methods = (repo: { calls: RepoCall[] }) => repo.calls.map((c) => c.method);

  it("retener por atención hace un único markAsPaid que lleva el motivo", async () => {
    const repo = makeFakeOrderRepo([pickupOrder()]);
    const webhookCtx: TransitionContext = { actorUserId: null, source: "webhook", record: true };
    await confirmOrderPayment(
      { orders: repo, stock: fakeStockRepo(stockRows(5, 2)), stops: fakeStopRepo([fakeStop()]) },
      "order-1",
      webhookCtx,
    );
    expect(repo.calls).toEqual([{ method: "markAsPaid", args: ["order-1", webhookCtx, "insufficient_stock:p2"] }]);
  });

  it("parada cancelada: un único markAsPaid con stop_cancelled", async () => {
    const repo = makeFakeOrderRepo([pickupOrder()]);
    await confirmOrderPayment(
      { orders: repo, stock: fakeStockRepo(stockRows(5, 5)), stops: fakeStopRepo([fakeStop({ status: "cancelled" })]) },
      "order-1",
    );
    expect(repo.calls).toEqual([{ method: "markAsPaid", args: ["order-1", undefined, "stop_cancelled"] }]);
  });

  it("retryOrderStock llama resolveAttention una vez y nada más", async () => {
    const repo = makeFakeOrderRepo([pickupOrder({ paymentStatus: "paid", attentionReason: "insufficient_stock:p2" })]);
    await retryOrderStock({ orders: repo, stock: fakeStockRepo(stockRows(5, 5)) }, "order-1", ctx);
    expect(repo.calls).toEqual([{ method: "resolveAttention", args: ["order-1", ctx] }]);
  });

  it("resolveOrderAttention llama resolveAttention una vez y nada más", async () => {
    const repo = makeFakeOrderRepo([pickupOrder({ paymentStatus: "paid", attentionReason: "stop_cancelled" })]);
    await resolveOrderAttention({ orders: repo }, "order-1", ctx);
    expect(methods(repo)).toEqual(["resolveAttention"]);
  });

  it("confirmar un pedido con parada sin repositorio de paradas lanza sin escribir ni descontar", async () => {
    const rows = stockRows(5, 5);
    const repo = makeFakeOrderRepo([pickupOrder()]);
    await expect(confirmOrderPayment({ orders: repo, stock: fakeStockRepo(rows) }, "order-1")).rejects.toThrow(
      "Stops repository is required to confirm a stop order",
    );
    expect(repo.calls).toEqual([]);
    expect(rows.map((r) => r.currentStock)).toEqual([5, 5]);
  });

  it("confirmar un pedido sin parada no exige repositorio de paradas", async () => {
    const repo = makeFakeOrderRepo([pickupOrder({ stopId: null })]);
    await confirmOrderPayment({ orders: repo, stock: fakeStockRepo([]) }, "order-1");
    expect((await repo.findById("order-1"))?.fulfillmentStatus).toBe("received");
  });

  it("cancelar un pagado con parada sin repositorio de stock lanza y no cancela", async () => {
    const repo = makeFakeOrderRepo([pickupOrder({ paymentStatus: "paid", fulfillmentStatus: "received" })]);
    await expect(
      changeOrderFulfillmentStatus({ orders: repo, users: fakeUserRepo([]) }, "order-1", "cancelled"),
    ).rejects.toThrow("Stock repository is required to cancel a paid stop order");
    expect((await repo.findById("order-1"))?.fulfillmentStatus).toBe("received");
  });

  it("cancelar sin repositorio de stock sigue funcionando si no hay reversa (sin parada o en atención)", async () => {
    const noStop = makeFakeOrderRepo([pickupOrder({ paymentStatus: "paid", stopId: null })]);
    await changeOrderFulfillmentStatus({ orders: noStop, users: fakeUserRepo([]) }, "order-1", "cancelled");
    expect((await noStop.findById("order-1"))?.fulfillmentStatus).toBe("cancelled");

    const held = makeFakeOrderRepo([pickupOrder({ paymentStatus: "paid", attentionReason: "stop_cancelled" })]);
    await changeOrderFulfillmentStatus({ orders: held, users: fakeUserRepo([]) }, "order-1", "cancelled");
    expect((await held.findById("order-1"))?.fulfillmentStatus).toBe("cancelled");
  });
});
