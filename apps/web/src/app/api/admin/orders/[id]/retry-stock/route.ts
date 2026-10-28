import { NextResponse } from "next/server";
import { DrizzleOrderRepository, DrizzleStockRepository } from "@workspace/db/repositories";
import { retryOrderStock } from "@workspace/domain/orders";
import { buildTransitionContext } from "@/lib/transition-context";
import { authorizeAdminUser } from "../../../_lib/authorize-admin";
import { domainErrorResponse, isUuid, notFoundResponse } from "../../../_lib/domain-error-response";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const admin = await authorizeAdminUser();
  if (admin instanceof Response) return admin;
  const { id } = await params;
  if (!isUuid(id)) return notFoundResponse("Order not found");
  try {
    const ctx = await buildTransitionContext({ actorUserId: admin.userId, source: "web" });
    const order = await retryOrderStock(
      { orders: new DrizzleOrderRepository(), stock: new DrizzleStockRepository() },
      id,
      ctx,
    );
    return NextResponse.json({ order });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
