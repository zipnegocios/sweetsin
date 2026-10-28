import { describe, it, expect } from "vitest";
import { parseAdelaideLocal, toAdelaideLocalInput } from "./adelaide-time";

describe("adelaide-time", () => {
  it("verano (ACDT, +10:30)", () => {
    expect(parseAdelaideLocal("2026-10-28T10:00").toISOString()).toBe("2026-10-27T23:30:00.000Z");
    expect(toAdelaideLocalInput(new Date("2026-10-27T23:30:00.000Z"))).toBe("2026-10-28T10:00");
  });

  it("invierno (ACST, +9:30)", () => {
    expect(parseAdelaideLocal("2026-07-01T10:00").toISOString()).toBe("2026-07-01T00:30:00.000Z");
    expect(toAdelaideLocalInput(new Date("2026-07-01T00:30:00.000Z"))).toBe("2026-07-01T10:00");
  });
});
