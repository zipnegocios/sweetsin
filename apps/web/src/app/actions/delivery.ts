"use server";

import { markOrderDelivered } from "@workspace/domain/orders";
import type { Order } from "@workspace/domain/orders";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { requireStaff } from "@/lib/require-staff";
import { buildTransitionContext } from "@/lib/transition-context";

export async function listAssignedAction(): Promise<Order[]> {
  const { userId } = await requireStaff(["delivery"]);
  return new DrizzleOrderRepository().findAssignedToDelivery(userId);
}

export async function markDeliveredAction(orderId: string): Promise<void> {
  const { userId } = await requireStaff(["delivery"]);
  const ctx = await buildTransitionContext({ actorUserId: userId, source: "web" });
  await markOrderDelivered({ orders: new DrizzleOrderRepository() }, orderId, userId, ctx);
}
