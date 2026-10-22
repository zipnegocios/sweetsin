import { DEFAULT_LOCALE, type Locale } from "@workspace/i18n";

export function resolveLocale(languageCode: string | null | undefined): Locale {
  return languageCode === "es" || languageCode === "en" ? languageCode : DEFAULT_LOCALE;
}
