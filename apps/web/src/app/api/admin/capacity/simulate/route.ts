import { NextResponse } from "next/server";
import { simulateCapacity } from "@/lib/capacity-simulate";
import { authorizeAdmin } from "../../_lib/authorize-admin";
import { domainErrorResponse } from "../../_lib/domain-error-response";

export async function POST(req: Request): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  try {
    const evaluation = await simulateCapacity(await req.json().catch(() => null));
    if (!evaluation) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    return NextResponse.json({ evaluation });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
