import { NextResponse } from "next/server";
import { DrizzleOrderRepository, DrizzleSettingsRepository } from "@workspace/db/repositories";
import { requireMobileAuth } from "../../_lib/require-mobile-auth";

export async function GET(req: Request): Promise<Response> {
  const session = await requireMobileAuth(req);
  if (!session || session.role !== "delivery") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orders = await new DrizzleOrderRepository().findAssignedToDelivery(session.userId);
  const { deliveryEvidenceRequired } = await new DrizzleSettingsRepository().get();
  return NextResponse.json({ orders, deliveryEvidenceRequired });
}
