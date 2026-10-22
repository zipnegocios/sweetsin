import { fontSize, lineHeight, type FontSizeKey } from "../tokens/type";
import type { ComponentTokens } from "./components";

/** Claves semánticas de color (sección 2.2 del documento). */
export type SemanticColor =
  | "background"
  | "surface"
  | "textPrimary"
  | "textQuiet"
  | "border"
  | "actionFill"
  | "actionLabel"
  | "link"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "tintPressed";

/** Variantes de texto (escala `text` de la sección 2.1). */
export type TypeVariant = "brand" | "title" | "heading" | "body" | "bodyStrong" | "label" | "button" | "quiet";

export type TextSpec = { fontFamily: string; fontSize: number; lineHeight: number };

export type TextPair = { fg: string; bg: string; size: "normal" | "large"; use: string };

/** Todo un tema salvo los tokens de componente, que se derivan de esto. */
export type ThemeBase = {
  name: "outdoor" | "indoor" | "brand";
  colors: Record<SemanticColor, string>;
  textPairs: TextPair[];
  touch: { min: number; primary: number };
  type: Record<TypeVariant, TextSpec>;
  motion: { staggerMs: number; enterMs: number; pressMs: number; bannerMs: number };
};

export type Theme = ThemeBase & { components: ComponentTokens };

export function textSpec(family: string, size: FontSizeKey): TextSpec {
  return { fontFamily: family, fontSize: fontSize[size], lineHeight: lineHeight[size] };
}
