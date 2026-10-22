import { NextResponse } from "next/server";
import { listActiveStaff } from "@workspace/domain/users";
import { DrizzleUserRepository } from "@workspace/db/repositories";
import { authorizeMobile } from "../_lib/authorize-mobile";

export async function GET(req: Request): Promise<Response> {
  const session = await authorizeMobile(req, "despachador");
  if (session instanceof Response) return session;
  const staff = await listActiveStaff(new DrizzleUserRepository(), "delivery");
  return NextResponse.json({ staff: staff.map((user) => ({ id: user.id, name: user.name })) });
}
