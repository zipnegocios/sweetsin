import { NextResponse } from "next/server";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { authorizeMobile } from "../../_lib/authorize-mobile";

export async function GET(req: Request): Promise<Response> {
  const session = await authorizeMobile(req, "despachador");
  if (session instanceof Response) return session;
  const orders = await new DrizzleOrderRepository().findQueueForDespachador();
  return NextResponse.json({ orders });
}
