import { NextResponse } from "next/server";
import { requireMobileAuth } from "../../_lib/require-mobile-auth";

export async function GET(req: Request): Promise<Response> {
  const session = await requireMobileAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(session);
}
