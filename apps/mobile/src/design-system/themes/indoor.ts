import { touch } from "../tokens/touch";
import { fontFamily as f } from "../tokens/type";
import { createTheme } from "./components";
import { operationalColors, operationalMotion, operationalTextPairs, outdoor } from "./outdoor";
import { textSpec } from "./theme";

/**
 * Interiores (despachador, admin): misma paleta y pares que outdoor, densidad más relajada
 * (primaria de 48 dp, título y botón un escalón más chicos). Sin consumidores todavía.
 */
export const indoor = createTheme({
  name: "indoor",
  colors: operationalColors,
  textPairs: operationalTextPairs,
  touch: { min: touch.min, primary: touch.min },
  type: {
    ...outdoor.type,
    title: textSpec(f.atkinsonBold, "xl"),
    button: textSpec(f.atkinsonBold, "md"),
  },
  motion: operationalMotion,
});
