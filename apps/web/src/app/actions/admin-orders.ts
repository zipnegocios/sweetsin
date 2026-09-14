"use server";

import { listOrders } from "@workspace/domain/orders";
import type { Order, OrderFilters, FulfillmentStatus, PaymentStatus } from "@workspace/domain/orders";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { auth } from "@/auth";

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    throw new Error("Forbidden");
  }
}

export async function listOrdersAction(filters: OrderFilters): Promise<Order[]> {
  await requireAdmin();
  return listOrders(new DrizzleOrderRepository(), filters);
}

export async function updateOrderStatusAction(input: {
  orderId: string;
  fulfillmentStatus?: FulfillmentStatus;
  paymentStatus?: PaymentStatus;
}): Promise<void> {
  await requireAdmin();
  const repo = new DrizzleOrderRepository();
  if (input.fulfillmentStatus) await repo.updateFulfillmentStatus(input.orderId, input.fulfillmentStatus);
  if (input.paymentStatus) await repo.updatePaymentStatus(input.orderId, input.paymentStatus);
}
