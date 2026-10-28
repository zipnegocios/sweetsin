import { describe, it, expect } from "vitest";
import { classifyPhotoResponse } from "./photo-rules";

describe("classifyPhotoResponse", () => {
  it("separa éxito, foto pesada y error", () => {
    expect(classifyPhotoResponse(200)).toBe("ok");
    expect(classifyPhotoResponse(413)).toBe("tooLarge");
    expect(classifyPhotoResponse(503)).toBe("error");
    expect(classifyPhotoResponse(400)).toBe("error");
  });
});
