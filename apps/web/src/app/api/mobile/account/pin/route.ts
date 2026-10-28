import { NextResponse } from "next/server";
import { z } from "zod";
import { changeStaffPin } from "@workspace/domain/users";
import { DrizzleUserRepository } from "@workspace/db/repositories";
import { authorizeMobile } from "../../_lib/authorize-mobile";
import { accountError } from "../../_lib/account-error";

const bodySchema = z.object({ currentPin: z.string(), newPin: z.string() });

export async function PUT(req: Request): Promise<Response> {
  const session = await authorizeMobile(req);
  if (session instanceof Response) return session;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    await changeStaffPin(new DrizzleUserRepository(), session.userId, parsed.data.currentPin, parsed.data.newPin);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return accountError(error);
  }
}
