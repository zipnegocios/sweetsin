import { NextResponse } from "next/server";
import { recordDeliveryEvidence } from "@workspace/domain/orders";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { isEvidenceKeyForOrder } from "@/lib/delivery-evidence-key";
import { EvidenceStorageNotConfiguredError, getR2Config } from "@/infra/r2-delivery-evidence-storage";
import { requireMobileAuth } from "../../../_lib/require-mobile-auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await requireMobileAuth(req);
  if (!session || session.role !== "delivery") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  let prefix: string;
  try {
    ({ prefix } = getR2Config());
  } catch (error) {
    if (error instanceof EvidenceStorageNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const capturedAt = new Date(String(body?.capturedAt));
  if (
    typeof body?.key !== "string" ||
    typeof body.lat !== "number" ||
    typeof body.lng !== "number" ||
    Number.isNaN(capturedAt.getTime())
  ) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!isEvidenceKeyForOrder(body.key, prefix, id)) {
    return NextResponse.json({ error: "Evidence key does not belong to this order" }, { status: 409 });
  }

  try {
    await recordDeliveryEvidence({ orders: new DrizzleOrderRepository() }, id, session.userId, {
      key: body.key,
      capturedAt,
      lat: body.lat,
      lng: body.lng,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Conflict" }, { status: 409 });
  }
}
