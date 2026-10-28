import { NextResponse } from "next/server";
import { DrizzleOrderRepository, DrizzleTrailerStopRepository } from "@workspace/db/repositories";
import { cancelTrailerStop } from "@workspace/domain/trailer-stops";
import { authorizeAdmin } from "../../../_lib/authorize-admin";
import { domainErrorResponse, isUuid, notFoundResponse } from "../../../_lib/domain-error-response";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return notFoundResponse();
  try {
    await cancelTrailerStop({ stops: new DrizzleTrailerStopRepository(), orders: new DrizzleOrderRepository() }, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
