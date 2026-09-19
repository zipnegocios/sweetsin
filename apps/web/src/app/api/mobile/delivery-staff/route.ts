import { NextResponse } from "next/server";
import { listActiveStaff } from "@workspace/domain/users";
import { DrizzleUserRepository } from "@workspace/db/repositories";
import { requireMobileAuth } from "../_lib/require-mobile-auth";

export async function GET(req: Request): Promise<Response> {
  const session = await requireMobileAuth(req);
  if (!session || session.role !== "despachador") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const staff = await listActiveStaff(new DrizzleUserRepository(), "delivery");
  return NextResponse.json({ staff: staff.map((user) => ({ id: user.id, name: user.name })) });
}
