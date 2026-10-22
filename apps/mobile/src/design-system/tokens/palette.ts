/** Paleta base operativa: 6 colores (tabla de la sección 2.1 del documento). Solo la leen los temas. */
export const palette = {
  navy: "#14233A",
  cream: "#F6EFE1",
  vanilla: "#FBF7EC",
  gold: "#B8872B",
  success: "#2F7D5B",
  alert: "#A6351F",
} as const;

/** Paleta de la marca Sweet Sin (tema `brand`), copiada una vez de la identidad: no se importa de la web. */
export const brandPalette = {
  sinRed: "#E63946",
  midnightNavy: "#0F1B3D",
  cream: "#F7F3EE",
  vanilla: "#FDFAF7",
  arequipeGold: "#C9943A",
  success: "#2F7D5B",
} as const;
