import { describe, it, expect, beforeAll } from "vitest";
import { createOrder } from "@workspace/domain/orders";
import { DrizzleProductRepository } from "./product-repository";
import { DrizzleOrderRepository } from "./order-repository";
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
});
