import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { endDeliveryShift, recordDeliveryLocation } from "@workspace/domain/delivery-tracking";
import { DrizzleDeliveryLocationRepository, DrizzleUserRepository } from "@workspace/db/repositories";
import { requireMobileAuth } from "../_lib/require-mobile-auth";

const bodySchema = z.object({
  lat: z.number().finite(),
  lng: z.number().finite(),
  accuracyMeters: z.number().finite().nonnegative().nullish(),
  recordedAt: z.iso.datetime(),
});

export async function PUT(req: Request): Promise<Response> {
  const session = await requireMobileAuth(req);
  if (!session || session.role !== "delivery") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  try {
    await recordDeliveryLocation(
      { locations: new DrizzleDeliveryLocationRepository(), users: new DrizzleUserRepository() },
      {
        userId: session.userId,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        accuracyMeters: parsed.data.accuracyMeters ?? null,
        recordedAt: new Date(parsed.data.recordedAt),
      },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Conflict" }, { status: 409 });
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const session = await requireMobileAuth(req);
  if (!session || session.role !== "delivery") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await endDeliveryShift({ locations: new DrizzleDeliveryLocationRepository() }, session.userId);
  return NextResponse.json({ ok: true });
}
