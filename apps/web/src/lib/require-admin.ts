import { auth } from "@/auth";

// Devuelve el id del admin para quien necesite registrarlo (p. ej. como actor de una transición).
export async function requireAdmin(): Promise<{ userId: string | null }> {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    throw new Error("Forbidden");
  }
  return { userId: session.user.id ?? null };
}
