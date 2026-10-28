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
} from "./use-cases";
import type { Order } from "./entities";
import type { OrderRepository, OrderFilters } from "./ports";
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
    async markAsPaid(id) {
      paidCalls.push(id);
      order.paymentStatus = "paid";
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

function fakeStockRepo(stock: StopProductStock[]): StockRepository & { events: Omit<StockEvent, "id">[] } {
  const events: Omit<StockEvent, "id">[] = [];
  return {
    events,
    async findByStopAndProduct(stopId, productId) {
      return stock.find((s) => s.stopId === stopId && s.productId === productId) ?? null;
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

  it("decrements stock for every item when the order has a stopId", async () => {
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

    await confirmOrderPayment({ orders, stock }, "order-2");

    expect(stock.events).toEqual([
      { stopProductStockId: "stock-1", eventType: "sale", quantity: 2, reason: null, reportedByUserId: null },
    ]);
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
    await confirmOrderPayment({ orders: fakeOrderRepoWithOrder(order), stock: stockFor() }, "order-q");
    expect(order.fulfillmentStatus).toBe("received");
  });

  it("notifica una vez a los despachadores activos", async () => {
    const notify = vi.fn().mockResolvedValue(undefined);
    await confirmOrderPayment(
      {
        orders: fakeOrderRepoWithOrder(pendingOrder()),
        stock: stockFor(),
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

function makeFakeOrderRepo(orders: Order[]): OrderRepository {
  const store = new Map(orders.map((o) => [o.id, o]));
  return {
    create: async (data) => {
      const order = { ...data, id: `order-${store.size + 1}` };
      store.set(order.id, order);
      return order;
    },
    findById: async (id) => store.get(id) ?? null,
    attachPaymentIntent: async () => {},
    markAsPaid: async (id) => {
      const o = store.get(id);
      if (o) store.set(id, { ...o, paymentStatus: "paid" });
    },
    listAll: async () => [...store.values()],
    listByCustomerId: async () => [],
    updateFulfillmentStatus: async (id, status) => {
      const o = store.get(id);
      if (o) store.set(id, { ...o, fulfillmentStatus: status });
    },
    updatePaymentStatus: async () => {},
    findQueueForDespachador: async () =>
      [...store.values()].filter((o) => o.paymentStatus === "paid" && ["received", "in_prep"].includes(o.fulfillmentStatus)),
    findAssignedToDelivery: async (userId) =>
      [...store.values()].filter((o) => o.assignedDeliveryUserId === userId && o.fulfillmentStatus === "out_for_delivery"),
    assignDelivery: async (id, deliveryUserId) => {
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
