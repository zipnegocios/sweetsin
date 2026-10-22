import { NextResponse } from "next/server";
import { z } from "zod";
import { DrizzlePushTokenRepository } from "@workspace/db/repositories";
import { authorizeMobile } from "../_lib/authorize-mobile";

const bodySchema = z.object({ token: z.string().min(1) });

export async function POST(req: Request): Promise<Response> {
  const session = await authorizeMobile(req);
  if (session instanceof Response) return session;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await new DrizzlePushTokenRepository().upsert(session.userId, parsed.data.token);
  return NextResponse.json({ ok: true });
}
