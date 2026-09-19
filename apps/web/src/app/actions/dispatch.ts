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

export async function listQueueAction(): Promise<Order[]> {
  await requireStaff(["despachador"]);
  return new DrizzleOrderRepository().findQueueForDespachador();
}

export async function listDeliveryStaffAction(): Promise<User[]> {
  await requireStaff(["despachador"]);
  return listActiveStaff(new DrizzleUserRepository(), "delivery");
}

export async function markInPrepAction(orderId: string): Promise<void> {
  await requireStaff(["despachador"]);
  await markOrderInPrep({ orders: new DrizzleOrderRepository() }, orderId);
}

export async function markReadyAction(orderId: string): Promise<void> {
  await requireStaff(["despachador"]);
  await markOrderReady({ orders: new DrizzleOrderRepository() }, orderId);
}

export async function assignDeliveryAction(orderId: string, deliveryUserId: string): Promise<void> {
  await requireStaff(["despachador"]);
  await assignDeliveryToOrder(
    {
      orders: new DrizzleOrderRepository(),
      notifications: new ExpoNotificationAdapter(new DrizzlePushTokenRepository(), new DrizzlePushLogRepository()),
    },
    orderId,
    deliveryUserId,
  );
}
