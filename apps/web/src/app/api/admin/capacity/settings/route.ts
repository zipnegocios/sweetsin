import { NextResponse } from "next/server";
import { DrizzleCapacityRepository } from "@workspace/db/repositories";
import { authorizeAdmin } from "../../_lib/authorize-admin";
import { capacitySettingsSchema } from "../../_lib/capacity-body";
import { domainErrorResponse } from "../../_lib/domain-error-response";

export async function GET(): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  try {
    const repo = new DrizzleCapacityRepository();
    const [settings, modifiedAt] = await Promise.all([repo.getSettings(), repo.lastModifiedAt()]);
    return NextResponse.json({ settings, lastModifiedAt: modifiedAt?.toISOString() ?? null });
  } catch (error) {
    return domainErrorResponse(error);
  }
}

export async function PUT(req: Request): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const parsed = capacitySettingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  try {
    return NextResponse.json({ settings: await new DrizzleCapacityRepository().saveSettings(parsed.data) });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
