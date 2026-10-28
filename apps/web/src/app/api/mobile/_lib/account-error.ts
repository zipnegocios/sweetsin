import { NextResponse } from "next/server";

/**
 * Errores de dominio del autoservicio de cuenta. Nunca 401: en /api/mobile/** un 401 significa
 * "sesión inválida" y la app cierra sesión, y acá el usuario solo tecleó mal su PIN o contraseña actual.
 */
export function accountError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("incorrect")) return NextResponse.json({ error: "invalid_current" }, { status: 400 });
  if (message.includes("6 digits") || message.includes("8 characters")) {
    return NextResponse.json({ error: "invalid_new" }, { status: 400 });
  }
  throw error;
}
