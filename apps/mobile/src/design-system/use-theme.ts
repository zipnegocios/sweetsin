import { useContext } from "react";
import type { Theme } from "./themes";
import { ThemeContext } from "./ThemeProvider";

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme() necesita un <ThemeProvider theme={...}> arriba en el árbol");
  return theme;
}
