import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const screensDir = resolve(__dirname, "screens");

/** Pantallas heredadas que todavía no cumplen la regla. Cada entrada tiene fecha de salida. */
const EXCEPTIONS = [
  "DespachadorQueueScreen.tsx", // diferida por el alcance actual
];

/** Primitivas visuales de react-native que una pantalla toma del design system, no directo. */
const UI_PRIMITIVES = new Set([
  "View", "Text", "Button", "Pressable", "TouchableOpacity", "TouchableHighlight",
  "TouchableWithoutFeedback", "StyleSheet", "Image", "ImageBackground", "SafeAreaView", "ScrollView",
]);
const UI_PACKAGES = ["react-native-safe-area-context", "expo-image", "@expo/vector-icons"];

export function screenViolations(source: string): string[] {
  const found: string[] = [];
  if (/#[0-9A-Fa-f]{3,8}\b/.test(source)) found.push("color hex literal");
  if (/rgba?\(/.test(source)) found.push("color rgb() literal");
  if (/fontFamily\s*:/.test(source)) found.push("fontFamily literal");
  for (const [, names, spec] of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    if (spec !== "react-native") continue;
    for (const name of names.split(",").map((n) => n.trim().split(/\s+as\s+/)[0]))
      if (UI_PRIMITIVES.has(name)) found.push(`importa ${name} de react-native`);
  }
  for (const [, spec] of source.matchAll(/from\s*["']([^"']+)["']/g)) {
    if (UI_PACKAGES.includes(spec)) found.push(`importa UI de ${spec}`);
    if (/design-system\/./.test(spec) && !/design-system\/index$/.test(spec))
      found.push(`importa ${spec} en vez de design-system/index`);
  }
  return found;
}

describe("reglas de diseño de las pantallas", () => {
  const screens = readdirSync(screensDir).filter((f) => f.endsWith(".tsx"));

  it("cada excepción es un archivo real (la lista no se pudre)", () => {
    for (const name of EXCEPTIONS) expect(existsSync(join(screensDir, name)), name).toBe(true);
  });

  it.each(screens.filter((s) => !EXCEPTIONS.includes(s)))("%s no usa literales ni UI fuera del design system", (name) => {
    expect(screenViolations(readFileSync(join(screensDir, name), "utf8"))).toEqual([]);
  });

  it("el detector marca una pantalla que viola la regla", () => {
    const bad = [
      'import { View, FlatList } from "react-native";',
      'import { Button } from "../design-system/molecules/Button";',
      'const s = { color: "#14233A", fontFamily: "Arial" };',
    ].join("\n");
    expect(screenViolations(bad)).toEqual([
      "color hex literal",
      "fontFamily literal",
      "importa View de react-native",
      "importa ../design-system/molecules/Button en vez de design-system/index",
    ]);
    expect(screenViolations('import { FlatList } from "react-native";\nimport { Button } from "../design-system";')).toEqual([]);
  });
});
