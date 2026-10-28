import type { Locale } from "@workspace/i18n";
import { apiFetch } from "../api/client";
import { setLocale } from "../i18n";
import { saveLocale } from "./session";

/** Aplica el idioma en la app y lo recuerda en el teléfono (sin red también funciona). */
export function adoptLocale(next: Locale): void {
  setLocale(next);
  void saveLocale(next).catch(() => {});
}

/** Cambio hecho por el usuario en la app: se aplica ya y se guarda en su cuenta (el admin ve y edita el mismo valor). */
export async function changeLocale(next: Locale): Promise<boolean> {
  adoptLocale(next);
  try {
    return (await apiFetch("/api/mobile/account/locale", { method: "PUT", body: JSON.stringify({ locale: next }) })).ok;
  } catch {
    return false;
  }
}
