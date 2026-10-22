"use server";

import { listOrders, confirmOrderPayment, changeOrderFulfillmentStatus } from "@workspace/domain/orders";
import type { Order, OrderFilters, FulfillmentStatus, PaymentStatus } from "@workspace/domain/orders";
import { DrizzleOrderRepository, DrizzleStockRepository, DrizzleUserRepository } from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";
import { createStaffNotifications } from "@/lib/staff-notifications";

export async function listOrdersAction(filters: OrderFilters): Promise<Order[]> {
  await requireAdmin();
  return listOrders(new DrizzleOrderRepository(), filters);
}

export async function updateOrderStatusAction(input: {
  orderId: string;
  fulfillmentStatus?: FulfillmentStatus;
  paymentStatus?: PaymentStatus;
  deliveryUserId?: string;
}): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  const orders = new DrizzleOrderRepository();
  const users = new DrizzleUserRepository();
  const notifications = createStaffNotifications();
  try {
    // El pago va primero: pagar mueve pending -> received, y un form que manda ambos campos no debe producir una transicion invalida.
    if (input.paymentStatus === "paid") {
      await confirmOrderPayment({ orders, stock: new DrizzleStockRepository(), users, notifications }, input.orderId);
    } else if (input.paymentStatus) {
      await orders.updatePaymentStatus(input.orderId, input.paymentStatus);
    }
    if (input.fulfillmentStatus) {
      await changeOrderFulfillmentStatus(
        { orders, users, notifications },
        input.orderId,
        input.fulfillmentStatus,
        { deliveryUserId: input.deliveryUserId },
      );
    }
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
