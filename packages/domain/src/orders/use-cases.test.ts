import { describe, it, expect } from "vitest";
import { createOrder, confirmOrderPayment } from "./use-cases";
import type { Order } from "./entities";
import type { OrderRepository } from "./ports";
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
      items: [{ productId: "p1", quantity: 1, unitPriceCents: 1000, lineDiscountCents: 0 }],
    };
    const orders = fakeOrderRepoWithOrder(order);
    const stock = fakeStockRepo([{ id: "stock-1", stopId: "stop-1", productId: "p1", maxStock: 10, currentStock: 10 }]);

    await confirmOrderPayment({ orders, stock }, "order-3");

    expect(orders.paidCalls).toEqual([]);
    expect(stock.events).toHaveLength(0);
  });
});
