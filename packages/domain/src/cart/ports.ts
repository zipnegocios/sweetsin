import type { Cart, CartItem } from "./entities";

export interface CartRepository {
  findByCustomerId(customerId: string): Promise<Cart | null>;
  replaceItems(customerId: string, items: CartItem[]): Promise<Cart>;
}
