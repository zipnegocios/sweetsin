import { NextResponse } from "next/server";
import { DrizzleTrailerStopRepository } from "@workspace/db/repositories";
import { closeJornada } from "@workspace/domain/delivery-jornadas";
import { authorizeAdmin } from "../../../_lib/authorize-admin";
import { domainErrorResponse, isUuid, notFoundResponse } from "../../../_lib/domain-error-response";

// Cerrar con pedidos sin entregar está permitido: el reparto sigue, solo deja de aceptar pedidos.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return notFoundResponse();
  try {
    await closeJornada({ stops: new DrizzleTrailerStopRepository() }, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
