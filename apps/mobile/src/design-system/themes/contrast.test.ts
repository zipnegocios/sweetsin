import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { palette } from "../tokens/palette";
import { contrastRatio } from "./contrast";
import { brand, indoor, outdoor } from "./index";

const THRESHOLD = { normal: 4.5, large: 3 } as const;

const doc = readFileSync(
  resolve(__dirname, "../../../../../docs/design/mobile-design-system.md"),
  "utf8",
);

/** Filas de la tabla "Pares prohibidos (evidencia)" de la sección 3: [texto, fondo, ratio]. */
function forbiddenOutdoorPairs(): [string, string, string][] {
  const section = doc.split("### Pares prohibidos (evidencia)")[1].split("###")[0];
  return [...section.matchAll(/^\|\s*([a-z]+)\s*\|\s*([a-z]+)\s*\|\s*([\d,]+)\s*\|/gm)].map(
    ([, fg, bg, ratio]) => [fg, bg, ratio],
  );
}

const outdoorColor = (name: string) =>
  name === "quiet" ? outdoor.colors.textQuiet : palette[name as keyof typeof palette];

describe("contrastRatio", () => {
  it("negro sobre blanco da 21", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("es simétrico y rechaza lo que no sea #RRGGBB", () => {
    expect(contrastRatio("#14233A", "#F6EFE1")).toBeCloseTo(contrastRatio("#F6EFE1", "#14233A"));
    expect(() => contrastRatio("rgba(0,0,0,1)", "#FFFFFF")).toThrow();
  });
});

describe.each([outdoor, indoor, brand])("tema $name", (theme) => {
  it.each(theme.textPairs)("$fg sobre $bg ($size, $use) cumple su umbral", (pair) => {
    expect(contrastRatio(pair.fg, pair.bg)).toBeGreaterThanOrEqual(THRESHOLD[pair.size]);
  });
});

describe("pares prohibidos de outdoor (evidencia del documento)", () => {
  const pairs = forbiddenOutdoorPairs();

  it("el documento lista los 8 pares prohibidos", () => {
    expect(pairs).toHaveLength(8);
  });

  it.each(pairs)("%s sobre %s queda debajo de 4,5 y coincide con el ratio documentado", (fg, bg, ratio) => {
    const computed = contrastRatio(outdoorColor(fg), outdoorColor(bg));
    expect(computed).toBeLessThan(THRESHOLD.normal);
    expect(computed.toFixed(2)).toBe(ratio.replace(",", "."));
  });

  it("ningún par prohibido aparece en textPairs", () => {
    for (const [fg, bg] of pairs) {
      expect(
        outdoor.textPairs.some((p) => p.fg === outdoorColor(fg) && p.bg === outdoorColor(bg)),
      ).toBe(false);
    }
  });
});

describe("pares prohibidos de brand", () => {
  const c = brand.colors;
  const forbidden: [string, string, number][] = [
    [c.actionLabel, c.danger, THRESHOLD.normal], // etiqueta pequeña sobre Sin Red (píldora cancelado)
    [c.danger, c.background, THRESHOLD.normal], // texto rojo pequeño sobre cream
    [c.danger, c.surface, THRESHOLD.normal], // texto rojo pequeño sobre vanilla
    [c.warning, c.background, THRESHOLD.large], // dorado como texto
    [c.warning, c.surface, THRESHOLD.large], // dorado como texto y borde pending_sync (no-texto 3:1)
    [c.textQuiet, c.textPrimary, THRESHOLD.large], // quiet sobre navy
    [c.textPrimary, c.success, THRESHOLD.normal], // navy sobre success
  ];

  it.each(forbidden)("%s sobre %s queda debajo de su umbral", (fg, bg, threshold) => {
    expect(contrastRatio(fg, bg)).toBeLessThan(threshold);
  });

  it("el relleno rojo solo aparece en textPairs con etiqueta grande", () => {
    const red = brand.textPairs.filter((p) => p.fg === c.danger || p.bg === c.danger);
    expect(red.length).toBeGreaterThan(0);
    expect(red.every((p) => p.size === "large")).toBe(true);
  });
});
