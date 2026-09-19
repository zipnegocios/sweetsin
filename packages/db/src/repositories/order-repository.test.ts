import { describe, it, expect, beforeAll } from "vitest";
import type { Order } from "@workspace/domain/orders";
import { createOrder } from "@workspace/domain/orders";
import { DrizzleProductRepository } from "./product-repository";
import { DrizzleOrderRepository } from "./order-repository";
import { DrizzleUserRepository } from "./user-repository";
import { db } from "../index";
import { productsTable } from "../schema";

const minimalOrderInput: Omit<Order, "id"> = {
  customerId: null,
  customerName: "Test",
  customerEmail: `test-${Date.now()}@example.com`,
  customerPhone: "+61400000000",
  fulfillmentType: "pickup",
  deliveryAddress: null,
  stopId: null,
  paymentStatus: "pending",
  fulfillmentStatus: "pending",
  subtotalCents: 0,
  discountCents: 0,
  deliveryFeeCents: 0,
  totalCents: 0,
  channel: "web",
  stripePaymentIntentId: null,
  assignedDeliveryUserId: null,
  items: [],
};

describe("DrizzleOrderRepository", () => {
  let productId: string;

  beforeAll(async () => {
    const [product] = await db
      .insert(productsTable)
      .values({
        slug: `test-product-${Date.now()}`,
        category: "sin",
        nameEn: "Test Product",
        nameEs: "Producto de Prueba",
        descriptionEn: "Test",
        descriptionEs: "Prueba",
        priceCents: 1300,
      })
      .returning();
    productId = product.id;
  });

  it("creates an order end-to-end against the real database", async () => {
    const products = new DrizzleProductRepository();
    const orders = new DrizzleOrderRepository();

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
        items: [{ productId, quantity: 2 }],
      },
    );

    expect(order.id).toBeTruthy();
    expect(order.totalCents).toBe(2600);
    expect(order.items).toHaveLength(1);

    const found = await orders.findById(order.id);
    expect(found?.totalCents).toBe(2600);
    expect(found?.items).toHaveLength(1);
  });

  it("attaches a payment intent and marks the order as paid", async () => {
    const products = new DrizzleProductRepository();
    const orders = new DrizzleOrderRepository();

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
        items: [{ productId, quantity: 1 }],
      },
    );

    await orders.attachPaymentIntent(order.id, "pi_test_123");
    await orders.markAsPaid(order.id);

    const found = await orders.findById(order.id);
    expect(found?.stripePaymentIntentId).toBe("pi_test_123");
    expect(found?.paymentStatus).toBe("paid");
  });

  it("lists orders filtered by fulfillment status and sorted by total", async () => {
    // Dos createOrder + dos listAll contra el Postgres remoto — más
    // round-trips que el resto de los tests, supera el timeout default.
    const products = new DrizzleProductRepository();
    const orders = new DrizzleOrderRepository();

    const orderA = await createOrder(
      { products, orders },
      {
        customerId: null,
        customerName: "List Test A",
        customerEmail: `list-test-a-${Date.now()}@example.com`,
        customerPhone: "+61400000001",
        fulfillmentType: "pickup",
        deliveryAddress: null,
        stopId: null,
        deliveryFeeCents: 0,
        channel: "web",
        items: [{ productId, quantity: 1 }],
      },
    );
    const orderB = await createOrder(
      { products, orders },
      {
        customerId: null,
        customerName: "List Test B",
        customerEmail: `list-test-b-${Date.now()}@example.com`,
        customerPhone: "+61400000002",
        fulfillmentType: "pickup",
        deliveryAddress: null,
        stopId: null,
        deliveryFeeCents: 0,
        channel: "whatsapp",
        items: [{ productId, quantity: 3 }],
      },
    );

    const webOnly = await orders.listAll({ channel: "web" });
    expect(webOnly.some((o) => o.id === orderA.id)).toBe(true);
    expect(webOnly.some((o) => o.id === orderB.id)).toBe(false);

    const bySearch = await orders.listAll({ search: "List Test B" });
    expect(bySearch.map((o) => o.id)).toContain(orderB.id);
    expect(bySearch.map((o) => o.id)).not.toContain(orderA.id);
  }, 15000);

  it("updates fulfillment and payment status independently", async () => {
    const products = new DrizzleProductRepository();
    const orders = new DrizzleOrderRepository();

    const order = await createOrder(
      { products, orders },
      {
        customerId: null,
        customerName: "Status Test",
        customerEmail: `status-test-${Date.now()}@example.com`,
        customerPhone: "+61400000003",
        fulfillmentType: "pickup",
        deliveryAddress: null,
        stopId: null,
        deliveryFeeCents: 0,
        channel: "web",
        items: [{ productId, quantity: 1 }],
      },
    );

    await orders.updateFulfillmentStatus(order.id, "in_prep");
    await orders.updatePaymentStatus(order.id, "paid");

    const found = await orders.findById(order.id);
    expect(found?.fulfillmentStatus).toBe("in_prep");
    expect(found?.paymentStatus).toBe("paid");
  });

  it("lists orders for a given customerId", async () => {
    const products = new DrizzleProductRepository();
    const orders = new DrizzleOrderRepository();

    // orders.customer_id es una foreign key real hacia users.id (nullable,
    // pero FK igual) — hace falta una fila real de users, un UUID
    // inventado rompe con una violación de FK.
    const users = new DrizzleUserRepository();
    const customer = await users.create({
      name: "Customer History Test",
      email: `history-test-${Date.now()}@example.com`,
      role: "customer",
      pinHash: null,
      passwordHash: null,
      isActive: true,
      preferredLocale: "en",
      failedPinAttempts: 0,
      pinLockedUntil: null,
    });

    await createOrder(
      { products, orders },
      {
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email!,
        customerPhone: "+61400000004",
        fulfillmentType: "pickup",
        deliveryAddress: null,
        stopId: null,
        deliveryFeeCents: 0,
        channel: "web",
        items: [{ productId, quantity: 1 }],
      },
    );

    const history = await orders.listByCustomerId(customer.id);
    expect(history).toHaveLength(1);
    expect(history[0].customerId).toBe(customer.id);
  });

  describe("findQueueForDespachador", () => {
    it("devuelve ordenes paid + received/in_prep/ready_for_pickup", async () => {
      const repo = new DrizzleOrderRepository();
      const paidReceived = await repo.create({
        ...minimalOrderInput,
        paymentStatus: "paid",
        fulfillmentStatus: "received",
      });
      const paidReadyForPickup = await repo.create({
        ...minimalOrderInput,
        paymentStatus: "paid",
        fulfillmentStatus: "ready_for_pickup",
      });
      await repo.create({ ...minimalOrderInput, paymentStatus: "pending", fulfillmentStatus: "received" });
      await repo.create({ ...minimalOrderInput, paymentStatus: "paid", fulfillmentStatus: "delivered" });

      const queue = await repo.findQueueForDespachador();

      expect(queue.map((o) => o.id)).toContain(paidReceived.id);
      expect(queue.map((o) => o.id)).toContain(paidReadyForPickup.id);
      expect(queue.every((o) => o.paymentStatus === "paid")).toBe(true);
      expect(queue.every((o) => ["received", "in_prep", "ready_for_pickup"].includes(o.fulfillmentStatus))).toBe(true);
    });
  });

  describe("assignDelivery / findAssignedToDelivery", () => {
    it("asigna un delivery y lo devuelve en su listado", async () => {
      const repo = new DrizzleOrderRepository();
      const users = new DrizzleUserRepository();
      const deliveryUser = await users.create({
        name: "Delivery Test",
        email: `delivery-test-${Date.now()}@example.com`,
        role: "delivery",
        pinHash: null,
        passwordHash: null,
        isActive: true,
        preferredLocale: "en",
        failedPinAttempts: 0,
        pinLockedUntil: null,
      });

      const order = await repo.create({
        ...minimalOrderInput,
        paymentStatus: "paid",
        fulfillmentStatus: "ready_for_pickup",
      });

      await repo.assignDelivery(order.id, deliveryUser.id);
      await repo.updateFulfillmentStatus(order.id, "out_for_delivery");

      const assigned = await repo.findAssignedToDelivery(deliveryUser.id);
      expect(assigned.map((o) => o.id)).toContain(order.id);
    });
  });
});
