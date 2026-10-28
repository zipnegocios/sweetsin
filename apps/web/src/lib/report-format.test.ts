import { describe, expect, it } from "vitest";
import { defaultReportRange, durationParts } from "./report-format";

describe("durationParts", () => {
  it("separa minutos y segundos", () => {
    expect(durationParts(252_000)).toEqual({ m: 4, s: 12 });
    expect(durationParts(45_000)).toEqual({ m: 0, s: 45 });
    expect(durationParts(59_600)).toEqual({ m: 1, s: 0 });
  });
});

describe("defaultReportRange", () => {
  it("cubre 7 días terminando hoy en hora de Adelaida", () => {
    // 2026-10-28 15:00 UTC ya es 29 en Adelaida (UTC+10:30).
    expect(defaultReportRange(new Date("2026-10-28T15:00:00Z"))).toEqual({ from: "2026-10-23", to: "2026-10-29" });
  });
});
