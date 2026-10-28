import { requireAdmin } from "@/lib/require-admin";

// Devuelven un resultado en vez de lanzar: en producción Next oculta el mensaje
// de los errores lanzados desde Server Actions.
export type AdminActionResult = { ok: true } | { ok: false; error: string };

export async function runAdminAction(
  fn: (admin: { userId: string | null }) => Promise<unknown>,
  isKnownMessage: (message: string) => boolean,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  try {
    await fn(admin);
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return { ok: false, error: isKnownMessage(message) ? message : "generic" };
  }
}
