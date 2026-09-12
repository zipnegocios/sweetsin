import type { Locale, Dictionary } from "./types";
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";

export type { Locale, Dictionary };
export const dictionaries: Record<Locale, Dictionary> = { en, es };
export const DEFAULT_LOCALE: Locale = "en";
