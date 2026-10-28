import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { DrizzleOrderRepository, DrizzleTrailerStopRepository } from "@workspace/db/repositories";
import { closeTrailerStop } from "@workspace/domain/trailer-stops";
import { authorizeAdmin } from "../../../_lib/authorize-admin";
import { domainErrorResponse, isUuid, notFoundResponse } from "../../../_lib/domain-error-response";

const closeBodySchema = z.object({ confirmUndelivered: z.boolean().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return notFoundResponse();
  // El cuerpo es opcional: vacío equivale a no confirmar pedidos sin entregar.
  const text = await req.text();
  let raw: unknown = {};
  try {
    if (text.trim()) raw = JSON.parse(text);
  } catch {
    raw = null;
  }
  const parsed = closeBodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  try {
    await closeTrailerStop({ stops: new DrizzleTrailerStopRepository(), orders: new DrizzleOrderRepository() }, id, {
      confirmUndelivered: parsed.data.confirmUndelivered === true,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
