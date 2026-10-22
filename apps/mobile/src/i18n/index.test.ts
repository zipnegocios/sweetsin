import { describe, it, expect } from "vitest";
import { resolveLocale } from "./resolve-locale";

describe("resolveLocale", () => {
  it("resuelve es y en", () => {
    expect(resolveLocale("es")).toBe("es");
    expect(resolveLocale("en")).toBe("en");
  });

  it("cae al idioma por defecto con otros idiomas o valores vacios", () => {
    expect(resolveLocale("pt")).toBe("en");
    expect(resolveLocale(null)).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
  });
});
