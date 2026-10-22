import { brandPalette as p } from "../tokens/palette";
import { touch } from "../tokens/touch";
import { fontFamily as f } from "../tokens/type";
import { createTheme } from "./components";
import { operationalMotion } from "./outdoor";
import { textSpec, type ThemeBase } from "./theme";

const colors: ThemeBase["colors"] = {
  background: p.cream,
  surface: p.vanilla,
  textPrimary: p.midnightNavy,
  textQuiet: "#5A6378",
  border: "rgba(15,27,61,0.16)", // midnight navy 16 %
  actionFill: p.sinRed,
  actionLabel: p.vanilla,
  link: p.midnightNavy,
  info: p.midnightNavy,
  success: p.success,
  warning: p.arequipeGold,
  danger: p.sinRed,
  tintPressed: "rgba(15,27,61,0.08)", // midnight navy 8 %
};

const c = colors;

/**
 * La marca para clientes. Sin consumidores todavía. Fraunces (display) y DM Sans (cuerpo) se
 * declaran pero NO se empaquetan: la APK que use este tema debe cargarlas.
 * Sin Red solo como relleno con etiqueta grande en negrita (≥ 18 sp): vanilla sobre rojo da 4,01.
 */
export const brand = createTheme({
  name: "brand",
  colors,
  textPairs: [
    { fg: c.textPrimary, bg: c.background, size: "normal", use: "texto general" },
    { fg: c.textPrimary, bg: c.surface, size: "normal", use: "texto en tarjetas" },
    { fg: c.textPrimary, bg: c.warning, size: "normal", use: "banner y píldoras doradas" },
    { fg: c.actionLabel, bg: c.textPrimary, size: "normal", use: "cabecera, píldora en camino" },
    { fg: c.actionLabel, bg: c.actionFill, size: "large", use: "botón primario (18 sp bold)" },
    { fg: c.danger, bg: c.background, size: "large", use: "titular rojo grande" },
    { fg: c.danger, bg: c.surface, size: "large", use: "titular rojo grande en tarjeta" },
    { fg: c.actionLabel, bg: c.success, size: "normal", use: "píldora entregado" },
    { fg: c.success, bg: c.surface, size: "normal", use: "píldora evidencia enviada" },
    { fg: c.success, bg: c.background, size: "normal", use: "texto de éxito" },
    { fg: c.textQuiet, bg: c.background, size: "normal", use: "texto secundario" },
    { fg: c.textQuiet, bg: c.surface, size: "normal", use: "texto secundario en tarjeta" },
  ],
  touch: { min: touch.min, primary: touch.min },
  type: {
    brand: textSpec(f.fraunces, "display"),
    title: textSpec(f.fraunces, "xxl"),
    heading: textSpec(f.dmSansBold, "lg"),
    body: textSpec(f.dmSans, "md"),
    bodyStrong: textSpec(f.dmSansBold, "md"),
    label: textSpec(f.dmSansBold, "sm"),
    button: textSpec(f.dmSansBold, "lg"),
    quiet: textSpec(f.dmSans, "md"),
  },
  motion: operationalMotion,
});
