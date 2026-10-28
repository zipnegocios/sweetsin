import { NextResponse } from "next/server";
import { DrizzleOrderRepository, DrizzleStockRepository } from "@workspace/db/repositories";
import { getStopCloseSummary } from "@workspace/domain/trailer-stops";
import { authorizeAdmin } from "../../../_lib/authorize-admin";
import { domainErrorResponse } from "../../../_lib/domain-error-response";
import { stopNotFound } from "../../../_lib/require-stop";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const { id } = await params;
  try {
    const missing = await stopNotFound(id);
    if (missing) return missing;
    const summary = await getStopCloseSummary(
      { stock: new DrizzleStockRepository(), orders: new DrizzleOrderRepository() },
      id,
    );
    return NextResponse.json(summary);
  } catch (error) {
    return domainErrorResponse(error);
  }
}
