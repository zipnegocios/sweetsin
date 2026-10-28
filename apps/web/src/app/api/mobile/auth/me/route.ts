import { NextResponse } from "next/server";
import { DrizzleUserRepository } from "@workspace/db/repositories";
import { viewUrlOrNull } from "@/infra/r2-staff-photo-storage";
import { authorizeMobile } from "../../_lib/authorize-mobile";

// Solo datos de la credencial: nunca teléfono, contacto de emergencia ni notas internas del admin.
export async function GET(req: Request): Promise<Response> {
  const session = await authorizeMobile(req);
  if (session instanceof Response) return session;

  const user = await new DrizzleUserRepository().findById(session.userId);
  return NextResponse.json({
    ...session,
    name: user?.name ?? null,
    locale: user?.preferredLocale ?? null,
    photoUrl: await viewUrlOrNull(user?.photoKey),
  });
}
