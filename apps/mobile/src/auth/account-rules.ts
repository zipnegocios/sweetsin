export const MIN_PASSWORD_LENGTH = 8;

export type PinFormError = "missing" | "format" | "mismatch";
export type PasswordFormError = "missing" | "tooShort" | "mismatch";

/** Valida el formulario de cambio de PIN antes de llamar al servidor. */
export function validatePinChange(current: string, next: string, confirm: string): PinFormError | null {
  if (!/^\d{6}$/.test(current)) return "missing";
  if (!/^\d{6}$/.test(next)) return "format";
  return next === confirm ? null : "mismatch";
}

/** Valida el formulario de cambio de contraseña antes de llamar al servidor. */
export function validatePasswordChange(current: string, next: string, confirm: string): PasswordFormError | null {
  if (!current) return "missing";
  if (next.length < MIN_PASSWORD_LENGTH) return "tooShort";
  return next === confirm ? null : "mismatch";
}

export type AccountOutcome = "ok" | "invalidCurrent" | "invalidNew" | "offline" | "server";

/** Interpreta la respuesta de /api/mobile/account/**. Un 401 se resuelve aparte (el contrato cierra la sesión). */
export function classifyAccountResponse(status: number, body: unknown): AccountOutcome {
  if (status >= 200 && status < 300) return "ok";
  const code = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;
  if (status === 400 && code === "invalid_current") return "invalidCurrent";
  if (status === 400 && code === "invalid_new") return "invalidNew";
  return "server";
}
