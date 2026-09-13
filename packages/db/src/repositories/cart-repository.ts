import { eq } from "drizzle-orm";
import type { Cart, CartItem, CartRepository } from "@workspace/domain/cart";
import { db } from "../index";
import { cartsTable, cartItemsTable } from "../schema";

export class DrizzleCartRepository implements CartRepository {
  async findByCustomerId(customerId: string): Promise<Cart | null> {
    const [cart] = await db.select().from(cartsTable).where(eq(cartsTable.customerId, customerId));
    if (!cart) return null;

    const itemRows = await db.select().from(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
    return {
      id: cart.id,
      customerId: cart.customerId,
      items: itemRows.map((row) => ({ productId: row.productId, quantity: row.quantity })),
    };
  }

  async replaceItems(customerId: string, items: CartItem[]): Promise<Cart> {
    return db.transaction(async (tx) => {
      let [cart] = await tx.select().from(cartsTable).where(eq(cartsTable.customerId, customerId));
      if (!cart) {
        [cart] = await tx.insert(cartsTable).values({ customerId }).returning();
      }

      await tx.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));

      if (items.length > 0) {
        await tx.insert(cartItemsTable).values(
          items.map((item) => ({ cartId: cart.id, productId: item.productId, quantity: item.quantity })),
        );
      }

      return { id: cart.id, customerId: cart.customerId, items };
    });
  }
}
