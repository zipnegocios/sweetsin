/** Luminancia relativa WCAG 2.x de un color `#RRGGBB`. */
function luminance(hex: string): number {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) throw new Error(`Color no soportado: ${hex} (se espera #RRGGBB)`);
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ratio de contraste WCAG 2.x entre dos colores `#RRGGBB` (de 1 a 21). */
export function contrastRatio(foreground: string, background: string): number {
  const [hi, lo] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}
