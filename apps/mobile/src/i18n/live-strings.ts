import type { Dictionary } from "@workspace/i18n";

type Node = Record<string, unknown>;

/**
 * Vista "viva" del diccionario: cada lectura (`s.logout`) consulta el idioma vigente en ese momento.
 * Así los `const s = strings.staffApp` de nivel de módulo siguen funcionando al cambiar de idioma sin tocar cada pantalla.
 */
export function createLiveStrings(getDictionary: () => Dictionary): Dictionary {
  const resolve = (path: string[]): unknown => path.reduce<unknown>((node, key) => (node as Node)?.[key], getDictionary());

  const wrap = (path: string[]): unknown => {
    const value = resolve(path);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
    return new Proxy({} as Node, {
      get: (_t, key) => (typeof key === "symbol" ? undefined : wrap([...path, key])),
      has: (_t, key) => key in (resolve(path) as Node),
      ownKeys: () => Reflect.ownKeys(resolve(path) as Node),
      getOwnPropertyDescriptor: (_t, key) =>
        key in (resolve(path) as Node) ? { value: wrap([...path, String(key)]), enumerable: true, configurable: true, writable: false } : undefined,
    });
  };

  return wrap([]) as Dictionary;
}
