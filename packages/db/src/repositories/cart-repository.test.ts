import { describe, it, expect, beforeAll } from "vitest";
import { DrizzleCartRepository } from "./cart-repository";
import { db } from "../index";
import { usersTable, productsTable } from "../schema";

describe("DrizzleCartRepository", () => {
  let customerId: string;
  let productId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(usersTable)
      .values({ name: "Test Customer", email: `cart-test-${Date.now()}@example.com`, role: "customer" })
      .returning();
    customerId = user.id;

    const [product] = await db
      .insert(productsTable)
      .values({
        slug: `cart-test-product-${Date.now()}`,
        category: "sin",
        nameEn: "Test Product",
        nameEs: "Producto de Prueba",
        descriptionEn: "Test",
        descriptionEs: "Prueba",
        priceCents: 1000,
      })
      .returning();
    productId = product.id;
  });

  it("creates a cart on first sync and persists items", async () => {
    const repo = new DrizzleCartRepository();

    const cart = await repo.replaceItems(customerId, [{ productId, quantity: 2 }]);
    expect(cart.customerId).toBe(customerId);
    expect(cart.items).toEqual([{ productId, quantity: 2 }]);

    const found = await repo.findByCustomerId(customerId);
    expect(found?.items).toEqual([{ productId, quantity: 2 }]);
  });

  it("replaces items entirely on subsequent syncs instead of merging", async () => {
    const repo = new DrizzleCartRepository();

    await repo.replaceItems(customerId, [{ productId, quantity: 5 }]);
    const updated = await repo.replaceItems(customerId, [{ productId, quantity: 1 }]);

    expect(updated.items).toEqual([{ productId, quantity: 1 }]);
  });

  it("returns null for a customer with no cart yet", async () => {
    const repo = new DrizzleCartRepository();
    const found = await repo.findByCustomerId("00000000-0000-0000-0000-000000000000");
    expect(found).toBeNull();
  });
});
