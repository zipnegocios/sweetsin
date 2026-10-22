/** Nombres de familia: son las claves con que la APK registra cada fuente al cargarla. */
export const fontFamily = {
  atkinson: "AtkinsonHyperlegible_400Regular",
  atkinsonBold: "AtkinsonHyperlegible_700Bold",
  // Familias de marca: declaradas, NO empaquetadas en la APK de delivery.
  fraunces: "Fraunces_900Black_Italic",
  dmSans: "DMSans_400Regular",
  dmSansBold: "DMSans_700Bold",
} as const;

/** Escala de tamaños (sp) y su altura de línea. */
export const fontSize = { sm: 13, md: 16, lg: 18, xl: 22, xxl: 24, display: 32 } as const;
export const lineHeight = { sm: 18, md: 24, lg: 24, xl: 28, xxl: 30, display: 36 } as const;
export type FontSizeKey = keyof typeof fontSize;
