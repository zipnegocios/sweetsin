import { describe, it, expect } from "vitest";
import { syncCart, mergeGuestCart } from "./use-cases";
import type { Cart, CartItem } from "./entities";
import type { CartRepository } from "./ports";

function fakeCartRepo(initial: Cart | null = null): CartRepository & { saved: Cart | null } {
  let stored = initial;
  return {
    get saved() {
      return stored;
    },
    async findByCustomerId() {
      return stored;
    },
    async replaceItems(customerId, items) {
      stored = { id: stored?.id ?? "cart-1", customerId, items };
      return stored;
    },
  };
}

describe("syncCart", () => {
  it("replaces the stored items with the given ones", async () => {
    const repo = fakeCartRepo();
    const items: CartItem[] = [{ productId: "p1", quantity: 2 }];

    const cart = await syncCart(repo, "customer-1", items);

    expect(cart.customerId).toBe("customer-1");
    expect(cart.items).toEqual(items);
  });
});

describe("mergeGuestCart", () => {
  it("uses the guest items as-is when there is no existing server-side cart", async () => {
    const repo = fakeCartRepo(null);
    const guestItems: CartItem[] = [{ productId: "p1", quantity: 3 }];

    const cart = await mergeGuestCart(repo, "customer-1", guestItems);

    expect(cart.items).toEqual(guestItems);
  });

  it("sums quantities for products present in both carts", async () => {
    const existing: Cart = { id: "cart-1", customerId: "customer-1", items: [{ productId: "p1", quantity: 2 }] };
    const repo = fakeCartRepo(existing);
    const guestItems: CartItem[] = [{ productId: "p1", quantity: 1 }, { productId: "p2", quantity: 5 }];

    const cart = await mergeGuestCart(repo, "customer-1", guestItems);

    expect(cart.items).toEqual(
      expect.arrayContaining([
        { productId: "p1", quantity: 3 },
        { productId: "p2", quantity: 5 },
      ]),
    );
    expect(cart.items).toHaveLength(2);
  });
});
