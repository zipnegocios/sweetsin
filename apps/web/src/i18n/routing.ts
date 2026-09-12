import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  // "as-needed": el default (en) se sirve en la raíz limpia "/" sin
  // prefijo ni redirect — preserva el link equity del dominio raíz.
  // Solo "es" queda explícito como "/es". Decisión del owner (2026-09-12).
  localePrefix: "as-needed",
});
