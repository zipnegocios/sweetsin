import { describe, expect, it } from "vitest";
import { palette } from "../tokens/palette";
import { brand, indoor, outdoor } from "./index";

/** Lista ordenada de todas las rutas de claves (estructura, no valores). */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return [prefix];
  if (value === null || typeof value !== "object") return [prefix];
  return Object.keys(value)
    .sort()
    .flatMap((k) => keyPaths((value as Record<string, unknown>)[k], `${prefix}.${k}`));
}

describe("temas", () => {
  it("los tres temas tienen exactamente las mismas claves", () => {
    expect(keyPaths(indoor)).toEqual(keyPaths(outdoor));
    expect(keyPaths(brand)).toEqual(keyPaths(outdoor));
  });

  it("los nombres coinciden con su tema", () => {
    expect([outdoor.name, indoor.name, brand.name]).toEqual(["outdoor", "indoor", "brand"]);
  });

  it("outdoor exige acciones primarias de 56 dp o más", () => {
    expect(outdoor.touch.primary).toBeGreaterThanOrEqual(56);
  });

  it("ningún tema baja de 48 dp en un tocable", () => {
    for (const theme of [outdoor, indoor, brand]) {
      expect(theme.touch.min).toBeGreaterThanOrEqual(48);
      expect(theme.touch.primary).toBeGreaterThanOrEqual(theme.touch.min);
    }
  });

  it("outdoor usa etiqueta de píldora de 13 sp", () => {
    expect(outdoor.type.label.fontSize).toBe(13);
  });

  it("outdoor e indoor usan la misma paleta base", () => {
    expect(indoor.colors).toEqual(outdoor.colors);
    const base = new Set<string>(Object.values(palette));
    const opaque = Object.entries(outdoor.colors).filter(
      ([key, value]) => value.startsWith("#") && key !== "textQuiet",
    );
    for (const [, value] of opaque) expect(base.has(value)).toBe(true);
  });
});
