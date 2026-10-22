import { describe, expect, it } from "vitest";
import { formatEta } from "./format-eta";

describe("formatEta", () => {
  it("minutos y kilometros segun el idioma", () => {
    expect(formatEta(720, 3400, "en")).toBe("12 min · 3.4 km");
    expect(formatEta(720, 3400, "es")).toBe("12 min · 3,4 km");
  });
  it("menos de 60 s es '< 1 min'", () => {
    expect(formatEta(59, 3400, "en")).toBe("< 1 min · 3.4 km");
  });
  it("una hora o mas usa horas y minutos", () => {
    expect(formatEta(3900, 3400, "en")).toBe("1 h 5 min · 3.4 km");
    expect(formatEta(3600, 3400, "en")).toBe("1 h 0 min · 3.4 km");
  });
  it("menos de 1000 m usa metros", () => {
    expect(formatEta(720, 850, "en")).toBe("12 min · 850 m");
    expect(formatEta(720, 850, "es")).toBe("12 min · 850 m");
  });
});
