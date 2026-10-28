import type { Locale } from "@workspace/i18n";

export type StaffProfile = { name: string; photoUrl: string | null; code: string; locale: Locale | null };

/** Código corto y estable de la credencial, derivado del id del usuario (no es un secreto ni sirve para autenticar). */
export function credentialCode(userId: string): string {
  return `SS-${userId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/** Interpreta la respuesta de `GET /api/mobile/auth/me`. Sin nombre no hay credencial que mostrar. */
export function parseProfile(json: unknown): StaffProfile | null {
  if (typeof json !== "object" || json === null) return null;
  const { userId, name, photoUrl, locale } = json as Record<string, unknown>;
  if (typeof userId !== "string" || typeof name !== "string" || !name.trim()) return null;
  return {
    name: name.trim(),
    photoUrl: typeof photoUrl === "string" && photoUrl.startsWith("https://") ? photoUrl : null,
    code: credentialCode(userId),
    locale: locale === "en" || locale === "es" ? locale : null,
  };
}
