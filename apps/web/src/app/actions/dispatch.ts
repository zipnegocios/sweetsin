"use server";

import { markOrderInPrep, markOrderReady, assignDeliveryToOrder } from "@workspace/domain/orders";
import type { Order } from "@workspace/domain/orders";
import { listActiveStaff } from "@workspace/domain/users";
import type { User } from "@workspace/domain/users";
import {
  DrizzleOrderRepository,
  DrizzleUserRepository,
  DrizzlePushTokenRepository,
  DrizzlePushLogRepository,
} from "@workspace/db/repositories";
import { ExpoNotificationAdapter } from "@workspace/notifications";
import { requireStaff } from "@/lib/require-staff";
import { buildTransitionContext } from "@/lib/transition-context";

export async function listQueueAction(): Promise<Order[]> {
  await requireStaff(["despachador"]);
  return new DrizzleOrderRepository().findQueueForDespachador();
}

export async function listDeliveryStaffAction(): Promise<User[]> {
  await requireStaff(["despachador"]);
  return listActiveStaff(new DrizzleUserRepository(), "delivery");
}

export async function markInPrepAction(orderId: string): Promise<void> {
  const { userId } = await requireStaff(["despachador"]);
  const ctx = await buildTransitionContext({ actorUserId: userId, source: "web" });
  await markOrderInPrep({ orders: new DrizzleOrderRepository() }, orderId, ctx);
}

export async function markReadyAction(orderId: string): Promise<void> {
  const { userId } = await requireStaff(["despachador"]);
  const ctx = await buildTransitionContext({ actorUserId: userId, source: "web" });
  await markOrderReady({ orders: new DrizzleOrderRepository() }, orderId, ctx);
}

export async function assignDeliveryAction(orderId: string, deliveryUserId: string): Promise<void> {
  const { userId } = await requireStaff(["despachador"]);
  const ctx = await buildTransitionContext({ actorUserId: userId, source: "web" });
  await assignDeliveryToOrder(
    {
      orders: new DrizzleOrderRepository(),
      users: new DrizzleUserRepository(),
      notifications: new ExpoNotificationAdapter(new DrizzlePushTokenRepository(), new DrizzlePushLogRepository()),
    },
    orderId,
    deliveryUserId,
    ctx,
  );
}
