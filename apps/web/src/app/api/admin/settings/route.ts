import { NextResponse } from "next/server";
import { DrizzleSettingsRepository } from "@workspace/db/repositories";
import { applySettingsUpdate } from "@/lib/settings";
import { authorizeAdmin } from "../_lib/authorize-admin";
import { domainErrorResponse } from "../_lib/domain-error-response";

export async function GET(): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json({ settings: await new DrizzleSettingsRepository().get() });
  } catch (error) {
    return domainErrorResponse(error);
  }
}

export async function PUT(req: Request): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  try {
    const settings = await applySettingsUpdate(await req.json().catch(() => null));
    if (!settings) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    return NextResponse.json({ settings });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
