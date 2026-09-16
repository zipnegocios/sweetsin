"use server";

import { listOrders } from "@workspace/domain/orders";
import type { Order, OrderFilters, FulfillmentStatus, PaymentStatus } from "@workspace/domain/orders";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";

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
