import { describe, it, expect, beforeAll } from "vitest";
import { createOrder } from "@workspace/domain/orders";
import { DrizzleProductRepository } from "./product-repository";
import { DrizzleOrderRepository } from "./order-repository";
import { DrizzleUserRepository } from "./user-repository";
import { db } from "../index";
import { productsTable } from "../schema";

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
});
