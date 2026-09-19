import { NextResponse } from "next/server";
import { z } from "zod";
import { assignDeliveryToOrder } from "@workspace/domain/orders";
import { DrizzleOrderRepository, DrizzlePushTokenRepository, DrizzlePushLogRepository } from "@workspace/db/repositories";
import { ExpoNotificationAdapter } from "@workspace/notifications";
import { requireMobileAuth } from "../../../_lib/require-mobile-auth";

const bodySchema = z.object({ deliveryUserId: z.string().uuid() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await requireMobileAuth(req);
  if (!session || session.role !== "despachador") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    const order = await assignDeliveryToOrder(
      {
        orders: new DrizzleOrderRepository(),
        notifications: new ExpoNotificationAdapter(new DrizzlePushTokenRepository(), new DrizzlePushLogRepository()),
      },
      id,
      parsed.data.deliveryUserId,
    );
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Conflict" }, { status: 409 });
  }
}
