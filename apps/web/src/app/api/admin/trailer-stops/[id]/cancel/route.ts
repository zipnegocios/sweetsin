import { NextResponse } from "next/server";
import { DrizzleOrderRepository, DrizzleTrailerStopRepository } from "@workspace/db/repositories";
import { cancelTrailerStop } from "@workspace/domain/trailer-stops";
import { buildTransitionContext } from "@/lib/transition-context";
import { authorizeAdminUser } from "../../../_lib/authorize-admin";
import { domainErrorResponse, isUuid, notFoundResponse } from "../../../_lib/domain-error-response";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const admin = await authorizeAdminUser();
  if (admin instanceof Response) return admin;
  const { id } = await params;
  if (!isUuid(id)) return notFoundResponse();
  try {
    const ctx = await buildTransitionContext({ actorUserId: admin.userId, source: "web" });
    await cancelTrailerStop({ stops: new DrizzleTrailerStopRepository(), orders: new DrizzleOrderRepository() }, id, ctx);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
