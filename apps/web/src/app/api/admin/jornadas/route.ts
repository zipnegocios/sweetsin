import { NextResponse } from "next/server";
import { DrizzleTrailerStopRepository } from "@workspace/db/repositories";
import { openJornadaBodySchema, openJornadaWithStock } from "@/lib/jornadas";
import { authorizeAdmin } from "../_lib/authorize-admin";
import { domainErrorResponse } from "../_lib/domain-error-response";

export async function GET(): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json({ jornadas: await new DrizzleTrailerStopRepository().listAll("delivery") });
  } catch (error) {
    return domainErrorResponse(error);
  }
}

export async function POST(req: Request): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  // El cuerpo es opcional: vacío abre una jornada sin nombre ni stock.
  const text = await req.text();
  let raw: unknown = {};
  try {
    if (text.trim()) raw = JSON.parse(text);
  } catch {
    raw = null;
  }
  const parsed = openJornadaBodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  try {
    return NextResponse.json({ jornada: await openJornadaWithStock(parsed.data) }, { status: 201 });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
