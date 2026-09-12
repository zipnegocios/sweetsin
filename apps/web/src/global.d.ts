/// <reference types="google.maps" />
// El auto-discovery de TypeScript no alcanza @types/google.maps en este
// monorepo: pnpm hoistea a la raíz los @types compartidos entre paquetes
// (react, node), pero @types/google.maps es exclusivo de apps/web y queda
// aislado en apps/web/node_modules/@types/, fuera del típico "sube por los
// directorios" de auto-include. La referencia explícita evita tener que
// declarar compilerOptions.types (lo que apagaría el auto-include para
// todo lo demás, react/react-dom incluidos).

import type { Dictionary } from "@workspace/i18n";
import { routing } from "@/i18n/routing";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: Dictionary;
  }
}
