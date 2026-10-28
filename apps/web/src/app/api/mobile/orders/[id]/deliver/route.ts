import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { markOrderDelivered } from "@workspace/domain/orders";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { buildTransitionContext } from "@/lib/transition-context";
import { domainErrorResponse, isUuid, notFoundResponse } from "@/app/api/admin/_lib/domain-error-response";
import { authorizeMobile } from "../../../_lib/authorize-mobile";

// `occurredAt` es la hora real de la entrega cuando la app la reenvía desde la cola offline.
// El repositorio descarta una fecha futura o de hace más de 24 h y usa la del servidor.
const bodySchema = z.object({ occurredAt: z.iso.datetime({ offset: true }).optional() });

// El cuerpo es opcional: la cola offline histórica manda el PATCH sin cuerpo.
async function readBody(req: Request): Promise<z.infer<typeof bodySchema> | null> {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    const parsed = bodySchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await authorizeMobile(req, "delivery");
  if (session instanceof Response) return session;
  const { id } = await params;
  if (!isUuid(id)) return notFoundResponse("Order not found");
  const body = await readBody(req);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    const ctx = await buildTransitionContext({
      actorUserId: session.userId,
      source: "mobile",
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
    });
    const order = await markOrderDelivered({ orders: new DrizzleOrderRepository() }, id, session.userId, ctx);
    return NextResponse.json({ order });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
