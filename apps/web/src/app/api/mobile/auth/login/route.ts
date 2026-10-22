import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateStaffByPin } from "@workspace/domain/users";
import { DrizzleUserRepository } from "@workspace/db/repositories";
import { signMobileJwt } from "@/lib/mobile-auth";

const bodySchema = z.object({ email: z.string().email(), pin: z.string().regex(/^\d{6}$/) });

export async function POST(req: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const user = await authenticateStaffByPin(new DrizzleUserRepository(), parsed.data.email, parsed.data.pin);
  if (!user || (user.role !== "despachador" && user.role !== "delivery")) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signMobileJwt({ sub: user.id, role: user.role });
  return NextResponse.json({ token, role: user.role, name: user.name });
}
