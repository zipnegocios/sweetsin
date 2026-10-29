import { NextResponse } from "next/server";
import { DrizzleStockRepository } from "@workspace/db/repositories";
import { findJornada } from "@/lib/jornadas";
import { authorizeAdmin } from "../../_lib/authorize-admin";
import { domainErrorResponse, notFoundResponse } from "../../_lib/domain-error-response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await params;
  try {
    const jornada = await findJornada(id);
    if (!jornada) return notFoundResponse();
    // Vendido, merma y disponible por producto; en una jornada cerrada, el disponible es el sobrante.
    return NextResponse.json({ jornada, stock: await new DrizzleStockRepository().summarizeByStop(id) });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
