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
