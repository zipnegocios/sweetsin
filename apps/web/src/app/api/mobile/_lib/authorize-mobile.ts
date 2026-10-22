import { NextResponse } from "next/server";
import { requireMobileAuth, type MobileSession } from "./require-mobile-auth";

/**
 * Contrato de /api/mobile/**: 401 = sesión inválida (la app vuelve a pedir el PIN y conserva su cola),
 * 403 = sesión válida con un rol que no corresponde a la ruta. Devuelve la sesión o la respuesta de error.
 */
export async function authorizeMobile(req: Request, role?: MobileSession["role"]): Promise<MobileSession | Response> {
  const session = await requireMobileAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role && session.role !== role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return session;
}
