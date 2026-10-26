import { describe, expect, it } from "vitest";
import { clampSegments } from "./clamp-segments";

describe("clampSegments", () => {
  it("acota el fin a N-1 y conserva los tramos validos", () => {
    expect(
      clampSegments(
        [
          { startIndex: 0, endIndex: 2, speed: "normal" },
          { startIndex: 2, endIndex: 9, speed: "jam" },
        ],
        5,
      ),
    ).toEqual([
      { startIndex: 0, endIndex: 2, speed: "normal" },
      { startIndex: 2, endIndex: 4, speed: "jam" },
    ]);
  });
  it("ignora tramos con inicio fuera de la polilinea o que quedan vacios", () => {
    expect(clampSegments([{ startIndex: 5, endIndex: 7, speed: "slow" }], 5)).toEqual([]);
    expect(clampSegments([{ startIndex: 4, endIndex: 7, speed: "slow" }], 5)).toEqual([]);
    expect(clampSegments([{ startIndex: 0, endIndex: 1, speed: "slow" }], 0)).toEqual([]);
  });
});
