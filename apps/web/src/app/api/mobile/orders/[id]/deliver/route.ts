import { NextResponse } from "next/server";
import { markOrderDelivered } from "@workspace/domain/orders";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { authorizeMobile } from "../../../_lib/authorize-mobile";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await authorizeMobile(req, "delivery");
  if (session instanceof Response) return session;
  const { id } = await params;

  try {
    const order = await markOrderDelivered({ orders: new DrizzleOrderRepository() }, id, session.userId);
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Conflict" }, { status: 409 });
  }
}
