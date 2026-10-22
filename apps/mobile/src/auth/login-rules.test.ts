import { describe, expect, it } from "vitest";
import { canSubmitLogin, classifyLoginFailure, normalizeLoginEmail } from "./login-rules";

describe("canSubmitLogin", () => {
  it("exige @ y exactamente 6 dígitos", () => {
    expect(canSubmitLogin("a@b.co", "123456")).toBe(true);
    expect(canSubmitLogin("ab.co", "123456")).toBe(false);
    expect(canSubmitLogin("a@b.co", "12345")).toBe(false);
    expect(canSubmitLogin("a@b.co", "12345a")).toBe(false);
  });

  it("un email con espacio final se normaliza antes de evaluarse y enviarse", () => {
    expect(normalizeLoginEmail("a@b.co ")).toBe("a@b.co");
    expect(canSubmitLogin(normalizeLoginEmail("a@b.co "), "123456")).toBe(true);
    expect(canSubmitLogin(normalizeLoginEmail("  "), "123456")).toBe(false);
  });
});

describe("classifyLoginFailure", () => {
  it("clasifica por estado y por error lanzado", () => {
    expect(classifyLoginFailure({ status: 401 })).toBe("invalid");
    expect(classifyLoginFailure({ status: 400 })).toBe("invalid");
    expect(classifyLoginFailure({ status: 500 })).toBe("server");
    expect(classifyLoginFailure({ thrown: new TypeError("Network request failed") })).toBe("offline");
    expect(classifyLoginFailure({ thrown: new Error("x") })).toBe("server");
  });
});
