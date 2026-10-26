import { describe, expect, it } from "vitest";
import { formatCents } from "./money";

describe("formatCents", () => {
  it("formatea centavos AUD como $x.xx", () => {
    expect(formatCents(1250)).toBe("$12.50");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(5)).toBe("$0.05");
  });

  it("los negativos llevan el signo antes del simbolo", () => {
    expect(formatCents(-200)).toBe("-$2.00");
  });
});
