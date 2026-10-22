import { NextResponse } from "next/server";
import { z } from "zod";
import { assignDeliveryToOrder } from "@workspace/domain/orders";
import { DrizzleOrderRepository, DrizzleUserRepository } from "@workspace/db/repositories";
import { createStaffNotifications } from "@/lib/staff-notifications";
import { authorizeMobile } from "../../../_lib/authorize-mobile";

const bodySchema = z.object({ deliveryUserId: z.string().uuid() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await authorizeMobile(req, "despachador");
  if (session instanceof Response) return session;
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    const order = await assignDeliveryToOrder(
      {
        orders: new DrizzleOrderRepository(),
        users: new DrizzleUserRepository(),
        notifications: createStaffNotifications(),
      },
      id,
      parsed.data.deliveryUserId,
    );
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Conflict" }, { status: 409 });
  }
}
