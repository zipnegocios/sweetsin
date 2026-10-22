import { NextResponse } from "next/server";
import { authorizeMobile } from "../../_lib/authorize-mobile";

export async function GET(req: Request): Promise<Response> {
  const session = await authorizeMobile(req);
  if (session instanceof Response) return session;
  return NextResponse.json(session);
}
