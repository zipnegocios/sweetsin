import { getLocales } from "expo-localization";
import { dictionaries, type Locale } from "@workspace/i18n";
import { createLiveStrings } from "./live-strings";
import { resolveLocale } from "./resolve-locale";

export { resolveLocale };

/** Idioma vigente: el del teléfono hasta que se aplique el guardado o el elegido en el admin (`setLocale`). */
export let locale: Locale = resolveLocale(getLocales()[0]?.languageCode);
export const strings = createLiveStrings(() => dictionaries[locale]);

const listeners = new Set<() => void>();

export function setLocale(next: Locale): void {
  if (next === locale) return;
  locale = next;
  listeners.forEach((l) => l());
}

/** Para `useSyncExternalStore`: avisa cuando cambia el idioma. */
export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
