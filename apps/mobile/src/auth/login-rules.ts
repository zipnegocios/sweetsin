import { isNetworkError } from "../api/network";

export type LoginError = "invalid" | "offline" | "server";

/** El email se envía y se evalúa sin espacios al borde; el campo conserva lo tipeado. */
export function normalizeLoginEmail(email: string): string {
  return email.trim();
}

/** Habilita el envío solo con un email con "@" y un PIN de exactamente 6 dígitos. */
export function canSubmitLogin(email: string, pin: string): boolean {
  return email.includes("@") && /^\d{6}$/.test(pin);
}

/** Clasifica la falla del login: red caída, credenciales rechazadas (400/401) o error del servidor. */
export function classifyLoginFailure(failure: { status: number } | { thrown: unknown }): LoginError {
  if ("thrown" in failure) return isNetworkError(failure.thrown) ? "offline" : "server";
  return failure.status === 400 || failure.status === 401 ? "invalid" : "server";
}
