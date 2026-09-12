import { describe, it, expect } from "vitest";
import { en } from "./en";
import { es } from "./es";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, nested]) =>
    keyPaths(nested, prefix ? `${prefix}.${key}` : key),
  );
}

describe("i18n dictionary parity", () => {
  it("en and es expose exactly the same keys", () => {
    expect(keyPaths(es).sort()).toEqual(keyPaths(en).sort());
  });
});
