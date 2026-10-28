import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Igual que authorizeAdmin, pero devuelve el id del admin para registrarlo como actor de la transición.
export async function authorizeAdminUser(): Promise<{ userId: string | null } | Response> {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return { userId: session.user.id ?? null };
}

export async function authorizeAdmin(): Promise<Response | null> {
  const result = await authorizeAdminUser();
  return result instanceof Response ? result : null;
}
