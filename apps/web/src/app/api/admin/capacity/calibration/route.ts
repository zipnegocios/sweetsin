import { NextResponse } from "next/server";
import { loadCalibration } from "@/lib/capacity-calibration";
import { authorizeAdmin } from "../../_lib/authorize-admin";
import { domainErrorResponse } from "../../_lib/domain-error-response";

export async function GET(): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json({ calibration: await loadCalibration() });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
