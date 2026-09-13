import type { CartRepository } from "./ports";
import type { Cart, CartItem } from "./entities";

export function syncCart(repo: CartRepository, customerId: string, items: CartItem[]): Promise<Cart> {
  return repo.replaceItems(customerId, items);
}

export async function mergeGuestCart(
  repo: CartRepository,
  customerId: string,
  guestItems: CartItem[],
): Promise<Cart> {
  const existing = await repo.findByCustomerId(customerId);
  const merged = new Map<string, number>();

  for (const item of existing?.items ?? []) {
    merged.set(item.productId, item.quantity);
  }
  for (const item of guestItems) {
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }

  const mergedItems: CartItem[] = Array.from(merged.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));

  return repo.replaceItems(customerId, mergedItems);
}
