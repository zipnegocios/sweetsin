import { describe, it, expect } from "vitest";
import {
  createOrder,
  confirmOrderPayment,
  listOrders,
  assignDeliveryToOrder,
  markOrderInPrep,
  markOrderReady,
  markOrderDelivered,
} from "./use-cases";
import type { Order } from "./entities";
import type { OrderRepository, OrderFilters } from "./ports";
import type { Product } from "../products/entities";
import type { ProductRepository } from "../products/ports";
import type { StockRepository } from "../stock/ports";
import type { StopProductStock, StockEvent } from "../stock/entities";

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
    async updateFulfillmentStatus() {},
    async updatePaymentStatus() {},
    async findQueueForDespachador() {
      return [];
    },
    async findAssignedToDelivery() {
      return [];
    },
    async assignDelivery() {},
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

describe("assignDeliveryToOrder", () => {
  it("asigna y pasa a out_for_delivery cuando esta ready_for_pickup", async () => {
    const repo = makeFakeOrderRepo([{ ...baseOrder, fulfillmentStatus: "ready_for_pickup" }]);

    const updated = await assignDeliveryToOrder({ orders: repo }, "order-1", "delivery-1");

    expect(updated.assignedDeliveryUserId).toBe("delivery-1");
    expect(updated.fulfillmentStatus).toBe("out_for_delivery");
  });

  it("rechaza si la orden no esta ready_for_pickup", async () => {
    const repo = makeFakeOrderRepo([baseOrder]);
    await expect(assignDeliveryToOrder({ orders: repo }, "order-1", "delivery-1")).rejects.toThrow();
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
});
