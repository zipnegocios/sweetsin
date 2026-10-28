import { NextResponse } from "next/server";
import { z } from "zod";
import { updateUserPreferredLocale } from "@workspace/domain/users";
import { DrizzleUserRepository } from "@workspace/db/repositories";
import { authorizeMobile } from "../../_lib/authorize-mobile";

const bodySchema = z.object({ locale: z.enum(["en", "es"]) });

// Mismo campo que edita el admin en la ficha del staff: el último que cambia gana.
export async function PUT(req: Request): Promise<Response> {
  const session = await authorizeMobile(req);
  if (session instanceof Response) return session;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await updateUserPreferredLocale(new DrizzleUserRepository(), session.userId, parsed.data.locale);
  return NextResponse.json({ ok: true, locale: parsed.data.locale });
}
