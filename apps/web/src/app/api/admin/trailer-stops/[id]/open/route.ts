import { NextResponse } from "next/server";
import { DrizzleSettingsRepository, DrizzleTrailerStopRepository } from "@workspace/db/repositories";
import { openTrailerStop } from "@workspace/domain/trailer-stops";
import { authorizeAdmin } from "../../../_lib/authorize-admin";
import { domainErrorResponse, isUuid, notFoundResponse } from "../../../_lib/domain-error-response";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return notFoundResponse();
  try {
    const { allowMultipleActiveStops } = await new DrizzleSettingsRepository().get();
    await openTrailerStop({ stops: new DrizzleTrailerStopRepository() }, id, {
      allowMultipleActive: allowMultipleActiveStops,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
