import { NextResponse } from "next/server";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { requireMobileAuth } from "../../_lib/require-mobile-auth";

export async function GET(req: Request): Promise<Response> {
  const session = await requireMobileAuth(req);
  if (!session || session.role !== "despachador") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orders = await new DrizzleOrderRepository().findQueueForDespachador();
  return NextResponse.json({ orders });
}
