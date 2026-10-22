import { NextResponse } from "next/server";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { buildEvidenceKey } from "@/lib/delivery-evidence-key";
import {
  EvidenceStorageNotConfiguredError,
  getR2Config,
  R2DeliveryEvidenceStorage,
} from "@/infra/r2-delivery-evidence-storage";
import { authorizeMobile } from "../../../../_lib/authorize-mobile";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await authorizeMobile(req, "delivery");
  if (session instanceof Response) return session;
  const { id } = await params;

  try {
    const { prefix } = getR2Config();

    const body = (await req.json().catch(() => null)) as { contentType?: unknown } | null;
    if (body?.contentType !== "image/jpeg") {
      return NextResponse.json({ error: "contentType must be image/jpeg" }, { status: 400 });
    }

    const order = await new DrizzleOrderRepository().findById(id);
    const validState = order?.fulfillmentStatus === "out_for_delivery" || order?.fulfillmentStatus === "delivered";
    if (!order || order.assignedDeliveryUserId !== session.userId || !validState) {
      return NextResponse.json({ error: "Order is not available for delivery evidence" }, { status: 409 });
    }

    const key = buildEvidenceKey(prefix, id, crypto.randomUUID());
    const uploadUrl = await new R2DeliveryEvidenceStorage().createUploadUrl(key, "image/jpeg");
    return NextResponse.json({ uploadUrl, key });
  } catch (error) {
    if (error instanceof EvidenceStorageNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
