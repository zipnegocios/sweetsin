import { NextResponse } from "next/server";
import { markOrderDelivered } from "@workspace/domain/orders";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { requireMobileAuth } from "../../../_lib/require-mobile-auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await requireMobileAuth(req);
  if (!session || session.role !== "delivery") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  try {
    const order = await markOrderDelivered({ orders: new DrizzleOrderRepository() }, id, session.userId);
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Conflict" }, { status: 409 });
  }
}
