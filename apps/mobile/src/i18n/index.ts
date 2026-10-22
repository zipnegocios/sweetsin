import { getLocales } from "expo-localization";
import { dictionaries, type Dictionary } from "@workspace/i18n";
import { resolveLocale } from "./resolve-locale";

export { resolveLocale };
export const locale = resolveLocale(getLocales()[0]?.languageCode);
export const strings: Dictionary = dictionaries[locale];
