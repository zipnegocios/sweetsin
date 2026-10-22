import { motion } from "../tokens/motion";
import { palette as p } from "../tokens/palette";
import { touch } from "../tokens/touch";
import { fontFamily as f } from "../tokens/type";
import { createTheme } from "./components";
import { textSpec, type ThemeBase } from "./theme";

/** Colores compartidos por outdoor e indoor (misma familia de color). */
export const operationalColors: ThemeBase["colors"] = {
  background: p.cream,
  surface: p.vanilla,
  textPrimary: p.navy,
  textQuiet: "#5A6378", // semántico, no base (decisión 2)
  border: "rgba(20,35,58,0.16)", // navy 16 %, decorativo
  actionFill: p.navy,
  actionLabel: p.vanilla,
  link: p.navy,
  info: p.navy,
  success: p.success,
  warning: p.gold,
  danger: p.alert,
  tintPressed: "rgba(20,35,58,0.08)", // navy 8 %
};

const c = operationalColors;

/** Pares permitidos de la sección 3 del documento. */
export const operationalTextPairs: ThemeBase["textPairs"] = [
  { fg: c.textPrimary, bg: c.background, size: "normal", use: "texto general" },
  { fg: c.textPrimary, bg: c.surface, size: "normal", use: "texto en tarjetas" },
  { fg: c.textPrimary, bg: c.warning, size: "normal", use: "OfflineBanner, píldoras en preparación y listo" },
  { fg: c.actionLabel, bg: c.actionFill, size: "normal", use: "botón primario, cabecera, píldora en camino" },
  { fg: c.actionLabel, bg: c.success, size: "normal", use: "píldora entregado" },
  { fg: c.actionLabel, bg: c.danger, size: "normal", use: "píldora cancelado, relleno de peligro" },
  { fg: c.danger, bg: c.background, size: "normal", use: "errores, texto de peligro" },
  { fg: c.danger, bg: c.surface, size: "normal", use: "errores en tarjeta" },
  { fg: c.success, bg: c.surface, size: "normal", use: "píldora evidencia enviada" },
  { fg: c.textQuiet, bg: c.background, size: "normal", use: "texto secundario" },
  { fg: c.textQuiet, bg: c.surface, size: "normal", use: "texto secundario en tarjeta, borde de campos" },
];

export const operationalMotion: ThemeBase["motion"] = {
  staggerMs: motion.staggerMs,
  enterMs: motion.enterMs,
  pressMs: motion.pressInMs,
  bannerMs: motion.bannerExitMs,
};

/** Exteriores (delivery a pleno sol): el caso más exigente y el único tema con consumidores hoy. */
export const outdoor = createTheme({
  name: "outdoor",
  colors: operationalColors,
  textPairs: operationalTextPairs,
  touch: { min: touch.min, primary: touch.primary },
  type: {
    brand: textSpec(f.fraunces, "display"), // reservado para el wordmark del login (no empaquetado aún)
    title: textSpec(f.atkinsonBold, "xxl"),
    heading: textSpec(f.atkinsonBold, "lg"),
    body: textSpec(f.atkinson, "md"),
    bodyStrong: textSpec(f.atkinsonBold, "md"),
    label: textSpec(f.atkinsonBold, "sm"),
    button: textSpec(f.atkinsonBold, "lg"),
    quiet: textSpec(f.atkinson, "md"),
  },
  motion: operationalMotion,
});
