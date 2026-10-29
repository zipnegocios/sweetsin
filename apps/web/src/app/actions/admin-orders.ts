"use server";

import {
  listOrders,
  confirmOrderPayment,
  changeOrderFulfillmentStatus,
  retryOrderStock,
  resolveOrderAttention,
  isOrderConflictMessage,
} from "@workspace/domain/orders";
import type { Order, OrderFilters, FulfillmentStatus, PaymentStatus } from "@workspace/domain/orders";
import { isStockConflictMessage } from "@workspace/domain/stock";
import {
  DrizzleOrderRepository,
  DrizzleStockRepository,
  DrizzleTrailerStopRepository,
  DrizzleUserRepository,
} from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";
import { runAdminAction, type AdminActionResult } from "@/lib/run-admin-action";
import { createStaffNotifications } from "@/lib/staff-notifications";
import { buildTransitionContext } from "@/lib/transition-context";

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
  const { userId } = await requireAdmin();
  const orders = new DrizzleOrderRepository();
  const users = new DrizzleUserRepository();
  const stock = new DrizzleStockRepository();
  const notifications = createStaffNotifications();
  try {
    const ctx = await buildTransitionContext({ actorUserId: userId, source: "web" });
    // El pago va primero: pagar mueve pending -> received, y un form que manda ambos campos no debe producir una transicion invalida.
    if (input.paymentStatus === "paid") {
      await confirmOrderPayment(
        { orders, stock, stops: new DrizzleTrailerStopRepository(), users, notifications },
        input.orderId,
        ctx,
      );
    } else if (input.paymentStatus) {
      await orders.updatePaymentStatus(input.orderId, input.paymentStatus);
    }
    if (input.fulfillmentStatus) {
      await changeOrderFulfillmentStatus(
        { orders, users, notifications, stock },
        input.orderId,
        input.fulfillmentStatus,
        { deliveryUserId: input.deliveryUserId, ctx },
      );
    }
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

const isOrderActionMessage = (m: string) => isOrderConflictMessage(m) || isStockConflictMessage(m);

/** Reintenta el descuento de stock de un pedido en atención (p. ej. tras reponer). */
export async function retryOrderStockAction(orderId: string): Promise<AdminActionResult> {
  return runAdminAction(async ({ userId }) => {
    const ctx = await buildTransitionContext({ actorUserId: userId, source: "web" });
    await retryOrderStock(
      { orders: new DrizzleOrderRepository(), stock: new DrizzleStockRepository(), stops: new DrizzleTrailerStopRepository() },
      orderId,
      ctx,
    );
  }, isOrderActionMessage);
}

/** Marca resuelto un pedido en atención: entra a la cola sin tocar stock. */
export async function resolveOrderAttentionAction(orderId: string): Promise<AdminActionResult> {
  return runAdminAction(async ({ userId }) => {
    const ctx = await buildTransitionContext({ actorUserId: userId, source: "web" });
    await resolveOrderAttention({ orders: new DrizzleOrderRepository() }, orderId, ctx);
  }, isOrderActionMessage);
}
