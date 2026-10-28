import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { markOrderInPrep, markOrderReady, markPickupDelivered } from "@workspace/domain/orders";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { buildTransitionContext } from "@/lib/transition-context";
import { domainErrorResponse, isUuid, notFoundResponse } from "@/app/api/admin/_lib/domain-error-response";
import { authorizeMobile } from "../../../_lib/authorize-mobile";

// "delivered" es la entrega en mostrador: el dominio la rechaza (409) si el pedido no es de retiro.
const bodySchema = z.object({ status: z.enum(["in_prep", "ready_for_pickup", "delivered"]) });

const TRANSITIONS = {
  in_prep: markOrderInPrep,
  ready_for_pickup: markOrderReady,
  delivered: markPickupDelivered,
} as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await authorizeMobile(req, "despachador");
  if (session instanceof Response) return session;
  const { id } = await params;
  if (!isUuid(id)) return notFoundResponse("Order not found");
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    const ctx = await buildTransitionContext({ actorUserId: session.userId, source: "mobile" });
    const order = await TRANSITIONS[parsed.data.status]({ orders: new DrizzleOrderRepository() }, id, ctx);
    return NextResponse.json({ order });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
