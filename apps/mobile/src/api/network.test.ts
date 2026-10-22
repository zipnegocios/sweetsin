import { describe, expect, it } from "vitest";
import { isNetworkError } from "./network";

describe("isNetworkError", () => {
  it("reconoce el TypeError de fetch", () => {
    expect(isNetworkError(new TypeError("Network request failed"))).toBe(true);
  });
  it("rechaza otros errores y valores", () => {
    expect(isNetworkError(new Error("x"))).toBe(false);
    expect(isNetworkError("x")).toBe(false);
  });
});
