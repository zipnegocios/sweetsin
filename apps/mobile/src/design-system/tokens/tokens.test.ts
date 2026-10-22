import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { palette } from "./palette";

const doc = readFileSync(
  resolve(__dirname, "../../../../../docs/design/mobile-design-system.md"),
  "utf8",
);

describe("palette base", () => {
  it("coincide con la tabla `| nombre | #RRGGBB |` del documento (exactamente 6 filas)", () => {
    const rows = [...doc.matchAll(/^\|\s*([a-zA-Z]+)\s*\|\s*(#[0-9A-Fa-f]{6})\s*\|/gm)];
    expect(rows).toHaveLength(6);
    const fromDoc = Object.fromEntries(rows.map(([, name, hex]) => [name, hex.toUpperCase()]));
    const fromCode = Object.fromEntries(
      Object.entries(palette).map(([name, hex]) => [name, hex.toUpperCase()]),
    );
    expect(fromCode).toEqual(fromDoc);
  });
});
