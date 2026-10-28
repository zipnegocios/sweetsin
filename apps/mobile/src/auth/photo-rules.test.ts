import { describe, it, expect } from "vitest";
import { base64ToBytes, centerSquare, classifyPhotoResponse } from "./photo-rules";

describe("base64ToBytes", () => {
  it("decodifica los bytes de un JPEG", () => {
    expect(Array.from(base64ToBytes("/9j/4A=="))).toEqual([0xff, 0xd8, 0xff, 0xe0]);
  });
});

describe("classifyPhotoResponse", () => {
  it("separa éxito, foto pesada y error", () => {
    expect(classifyPhotoResponse(200)).toBe("ok");
    expect(classifyPhotoResponse(413)).toBe("tooLarge");
    expect(classifyPhotoResponse(503)).toBe("error");
    expect(classifyPhotoResponse(400)).toBe("error");
  });
});

describe("centerSquare", () => {
  it("toma el cuadrado central en horizontal y en vertical", () => {
    expect(centerSquare(4000, 3000)).toEqual({ originX: 500, originY: 0, width: 3000, height: 3000 });
    expect(centerSquare(3000, 4000)).toEqual({ originX: 0, originY: 500, width: 3000, height: 3000 });
    expect(centerSquare(100, 100)).toEqual({ originX: 0, originY: 0, width: 100, height: 100 });
  });
});
