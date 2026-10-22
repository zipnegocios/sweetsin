import { NextResponse } from "next/server";
import { z } from "zod";
import { markOrderInPrep, markOrderReady } from "@workspace/domain/orders";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { authorizeMobile } from "../../../_lib/authorize-mobile";

const bodySchema = z.object({ status: z.enum(["in_prep", "ready_for_pickup"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await authorizeMobile(req, "despachador");
  if (session instanceof Response) return session;
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const repo = new DrizzleOrderRepository();
  try {
    const order =
      parsed.data.status === "in_prep" ? await markOrderInPrep({ orders: repo }, id) : await markOrderReady({ orders: repo }, id);
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Conflict" }, { status: 409 });
  }
}
