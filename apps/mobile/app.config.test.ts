import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConfigContext } from "expo/config";
import appConfig from "./app.config";

const appJson = readFileSync(new URL("./app.json", import.meta.url), "utf8");
const baseConfig = JSON.parse(appJson).expo;
const build = () => appConfig({ config: structuredClone(baseConfig) } as ConfigContext);

afterEach(() => vi.unstubAllEnvs());

describe("app.config", () => {
  it("sin APP_VARIANT devuelve la config de produccion sin cambios", () => {
    vi.stubEnv("APP_VARIANT", "");
    const config = build();
    expect(config.name).toBe("Sweet Sin Staff");
    expect(config.android?.package).toBe("au.com.sweetsin.staff");
    expect(config).toEqual(baseConfig);
  });

  it("con APP_VARIANT=development usa nombre, package y color de icono propios", () => {
    vi.stubEnv("APP_VARIANT", "development");
    const config = build();
    expect(config.name).toBe("Sweet Sin Staff (Dev)");
    expect(config.android?.package).toBe("au.com.sweetsin.staff.dev");
    expect(config.android?.adaptiveIcon?.backgroundColor).toBe("#B8872B");
    expect(config.android?.adaptiveIcon?.backgroundColor).not.toBe(
      baseConfig.android.adaptiveIcon.backgroundColor,
    );
    expect(config.android?.adaptiveIcon?.foregroundImage).toBe(
      baseConfig.android.adaptiveIcon.foregroundImage,
    );
  });

  it("no modifica app.json", () => {
    vi.stubEnv("APP_VARIANT", "development");
    build();
    expect(readFileSync(new URL("./app.json", import.meta.url), "utf8")).toBe(appJson);
  });
});

describe("app.config clave del SDK de mapas", () => {
  it("con GOOGLE_MAPS_ANDROID_API_KEY la inyecta en android.config.googleMaps.apiKey", () => {
    vi.stubEnv("APP_VARIANT", "");
    vi.stubEnv("GOOGLE_MAPS_ANDROID_API_KEY", "key-123");
    const config = build();
    expect(config.android?.config?.googleMaps?.apiKey).toBe("key-123");
    expect({ ...config, android: { ...config.android, config: undefined } }).toEqual({
      ...baseConfig,
      android: { ...baseConfig.android, config: undefined },
    });
  });

  it("sin la variable (o vacia) no agrega config.googleMaps y la salida es igual a app.json", () => {
    vi.stubEnv("APP_VARIANT", "");
    vi.stubEnv("GOOGLE_MAPS_ANDROID_API_KEY", "  ");
    const config = build();
    expect(config.android?.config?.googleMaps).toBeUndefined();
    expect(config).toEqual(baseConfig);
  });

  it("en la variante de desarrollo conserva los overrides y agrega la clave", () => {
    vi.stubEnv("APP_VARIANT", "development");
    vi.stubEnv("GOOGLE_MAPS_ANDROID_API_KEY", "key-123");
    const config = build();
    expect(config.name).toBe("Sweet Sin Staff (Dev)");
    expect(config.android?.package).toBe("au.com.sweetsin.staff.dev");
    expect(config.android?.adaptiveIcon?.backgroundColor).toBe("#B8872B");
    expect(config.android?.config?.googleMaps?.apiKey).toBe("key-123");
  });
});
