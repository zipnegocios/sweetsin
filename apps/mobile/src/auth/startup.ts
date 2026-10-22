import { isNetworkError } from "../api/network";
import { withTimeout } from "../hooks/with-timeout";

export type StaffRole = "despachador" | "delivery";

export const ME_TIMEOUT_MS = 8000;

export function isStaffRole(value: unknown): value is StaffRole {
  return value === "despachador" || value === "delivery";
}

export interface StartupDeps {
  getToken(): Promise<string | null>;
  getCachedRole(): Promise<StaffRole | null>;
  saveRole(role: StaffRole): Promise<void>;
  fetchMe(): Promise<Response>;
}

/**
 * Decide la sesión al abrir la app. Solo un 401 la invalida (`invalid: true` => logout);
 * sin red, timeout, 5xx o respuesta rara se entra con el rol cacheado para operar offline.
 */
export async function resolveStartupSession(
  deps: StartupDeps,
  timeoutMs: number = ME_TIMEOUT_MS,
): Promise<{ role: StaffRole | null; invalid: boolean }> {
  if (!(await deps.getToken())) return { role: null, invalid: false };
  let res: Response | undefined;
  try {
    res = await withTimeout(deps.fetchMe(), timeoutMs);
  } catch (error) {
    if (!isNetworkError(error)) throw error;
  }
  if (res?.status === 401) return { role: null, invalid: true };
  if (res?.ok) {
    const data = (await res.json().catch(() => null)) as { role?: unknown } | null;
    if (isStaffRole(data?.role)) {
      await deps.saveRole(data.role).catch(() => {}); // sin caché solo se pierde el arranque offline
      return { role: data.role, invalid: false };
    }
  }
  return { role: await deps.getCachedRole(), invalid: false };
}
