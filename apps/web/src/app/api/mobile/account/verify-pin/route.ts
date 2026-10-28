import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyStaffPin } from "@workspace/domain/users";
import { DrizzleUserRepository } from "@workspace/db/repositories";
import { authorizeMobile } from "../../_lib/authorize-mobile";

const bodySchema = z.object({ pin: z.string() });

/** Confirma el PIN de la sesión actual y devuelve el email propio: la app lo necesita para activar la huella. */
export async function POST(req: Request): Promise<Response> {
  const session = await authorizeMobile(req);
  if (session instanceof Response) return session;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const user = await verifyStaffPin(new DrizzleUserRepository(), session.userId, parsed.data.pin);
  if (!user?.email) return NextResponse.json({ error: "invalid_current" }, { status: 400 });
  return NextResponse.json({ email: user.email });
}
