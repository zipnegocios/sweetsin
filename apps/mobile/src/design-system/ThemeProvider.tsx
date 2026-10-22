import { createContext, type ReactNode } from "react";
import type { Theme } from "./themes";

export const ThemeContext = createContext<Theme | null>(null);

/** Elige el tema de la APK: los componentes leen todo de acá, nunca de la paleta. */
export function ThemeProvider({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
