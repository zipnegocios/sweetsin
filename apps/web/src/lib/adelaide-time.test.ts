import { describe, it, expect } from "vitest";
import { adelaideDayKey, adelaideDayRange, parseAdelaideLocal, toAdelaideLocalInput } from "./adelaide-time";

describe("adelaide-time", () => {
  it("verano (ACDT, +10:30)", () => {
    expect(parseAdelaideLocal("2026-10-28T10:00").toISOString()).toBe("2026-10-27T23:30:00.000Z");
    expect(toAdelaideLocalInput(new Date("2026-10-27T23:30:00.000Z"))).toBe("2026-10-28T10:00");
  });

  it("invierno (ACST, +9:30)", () => {
    expect(parseAdelaideLocal("2026-07-01T10:00").toISOString()).toBe("2026-07-01T00:30:00.000Z");
    expect(toAdelaideLocalInput(new Date("2026-07-01T00:30:00.000Z"))).toBe("2026-07-01T10:00");
  });

  it("adelaideDayKey usa el día de Adelaida, no el UTC", () => {
    expect(adelaideDayKey(new Date("2026-10-27T14:00:00.000Z"))).toBe("2026-10-28");
    expect(adelaideDayKey(new Date("2026-10-27T13:00:00.000Z"))).toBe("2026-10-27");
  });

  it("adelaideDayRange cubre el día completo en hora de Adelaida", () => {
    const { start, end } = adelaideDayRange("2026-10-28");
    expect(start.toISOString()).toBe("2026-10-27T13:30:00.000Z");
    expect(end.toISOString()).toBe("2026-10-28T13:29:59.999Z");
  });
});
