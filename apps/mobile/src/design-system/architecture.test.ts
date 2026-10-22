import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname);

/** Capas en orden: un archivo solo importa de su capa o de capas anteriores. */
const LAYERS = ["tokens", "themes", "core", "atoms", "molecules", "organisms", "templates", "api"] as const;
type Layer = (typeof LAYERS)[number];
const COMPONENT_LAYERS: Layer[] = ["core", "atoms", "molecules", "organisms", "templates"];

/**
 * Paquetes externos permitidos dentro de design-system/: lista cerrada de lo que realmente usa.
 * Cualquier otro (p. ej. `@expo/vector-icons`, prohibido por el owner, o módulos de almacenamiento
 * y efectos como `expo-secure-store`, `expo-sqlite`, `expo-notifications`) rompe el test.
 */
const ALLOWED_PACKAGES = ["react", "react-native", "react-native-safe-area-context", "expo-image", "expo-status-bar"];
/** Única salida de la carpeta permitida: los activos de marca (imágenes, no código). */
const ALLOWED_OUTSIDE = /[\\/]assets[\\/]brand[\\/][^\\/]+\.(png|gif)$/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

function layerOf(file: string): Layer {
  const parts = relative(root, file).split(sep);
  if (parts.length === 1) return parts[0] === "index.ts" ? "api" : "core";
  if (parts[0] === "themes") return "themes"; // incluye themes/components.ts (capa 3)
  return parts[0] as Layer;
}

/** Archivo real al que apunta un import relativo (con o sin extensión, o carpeta con index). */
function resolveFile(base: string): string {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
  return candidates.find((p) => existsSync(p) && statSync(p).isFile()) ?? base;
}

function importsOf(source: string): string[] {
  const patterns = [
    /(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/g,
    /import\s*["']([^"']+)["']/g,
    /(?:require|import)\(\s*["']([^"']+)["']\s*\)/g,
  ];
  return patterns.flatMap((re) => [...source.matchAll(re)].map((m) => m[1]));
}

function violations(): string[] {
  const found: string[] = [];
  for (const file of walk(root)) {
    const name = relative(root, file);
    const from = layerOf(file);
    const source = readFileSync(file, "utf8");
    for (const spec of importsOf(source)) {
      if (!spec.startsWith(".")) {
        if (!ALLOWED_PACKAGES.includes(spec)) found.push(`${name}: paquete externo "${spec}"`);
        continue;
      }
      const target = resolveFile(resolve(file, "..", spec));
      if (!target.startsWith(root + sep)) {
        if (!ALLOWED_OUTSIDE.test(target)) found.push(`${name}: importa fuera de design-system "${spec}"`);
        continue;
      }
      const to = layerOf(target);
      if (from === "tokens") found.push(`${name}: tokens/ no importa nada ("${spec}")`);
      else if (to === "api") found.push(`${name}: nadie importa index.ts desde adentro`);
      else if (LAYERS.indexOf(to) > LAYERS.indexOf(from)) found.push(`${name}: ${from} importa ${to} ("${spec}")`);
      if (/tokens[\\/]palette\.ts$/.test(target) && from !== "themes" && from !== "tokens")
        found.push(`${name}: solo los temas leen palette`);
    }
    if (COMPONENT_LAYERS.includes(from)) {
      if (/#[0-9A-Fa-f]{3,8}\b/.test(source)) found.push(`${name}: color hex literal`);
      if (/rgba?\(/.test(source)) found.push(`${name}: color rgb() literal`);
      if (/fontFamily\s*:\s*["'`]/.test(source)) found.push(`${name}: fontFamily literal`);
    }
  }
  return found;
}

describe("arquitectura del design system", () => {
  it("existen todas las capas", () => {
    const layers = new Set(walk(root).map(layerOf));
    for (const layer of LAYERS) expect(layers.has(layer), layer).toBe(true);
  });

  it("respeta dirección de capas, frontera de la carpeta y ausencia de literales", () => {
    expect(violations()).toEqual([]);
  });
});
