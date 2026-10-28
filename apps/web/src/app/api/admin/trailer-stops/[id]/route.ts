import { NextResponse } from "next/server";
import { DrizzleTrailerStopRepository } from "@workspace/db/repositories";
import { deleteTrailerStop, updateTrailerStop } from "@workspace/domain/trailer-stops";
import { authorizeAdmin } from "../../_lib/authorize-admin";
import { domainErrorResponse, isUuid, notFoundResponse } from "../../_lib/domain-error-response";
import { stopBodySchema, toStopInput } from "../../_lib/trailer-stop-body";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return notFoundResponse();
  try {
    const stop = await new DrizzleTrailerStopRepository().findById(id);
    return stop ? NextResponse.json({ stop }) : notFoundResponse();
  } catch (error) {
    return domainErrorResponse(error);
  }
}

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!isUuid(id)) return notFoundResponse();

  const parsed = stopBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    const stop = await updateTrailerStop(new DrizzleTrailerStopRepository(), id, toStopInput(parsed.data));
    return NextResponse.json({ stop });
  } catch (error) {
    return domainErrorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!isUuid(id)) return notFoundResponse();
  try {
    await deleteTrailerStop(new DrizzleTrailerStopRepository(), id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
