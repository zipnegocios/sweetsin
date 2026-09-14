"use server";

import { mergeGuestCart } from "@workspace/domain/cart";
import { DrizzleCartRepository } from "@workspace/db/repositories";
import { auth } from "@/auth";

export async function mergeCartOnLoginAction(
  guestItems: { productId: string; quantity: number }[],
): Promise<{ productId: string; quantity: number }[]> {
  const session = await auth();
  if (!session) return guestItems;

  const cart = await mergeGuestCart(new DrizzleCartRepository(), session.user.id, guestItems);
  return cart.items;
}
