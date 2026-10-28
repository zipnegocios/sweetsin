import { describe, expect, it } from "vitest";
import { classifyAccountResponse, validatePasswordChange, validatePinChange } from "./account-rules";

describe("validatePinChange", () => {
  it("acepta un PIN nuevo de 6 dígitos repetido igual", () => {
    expect(validatePinChange("123456", "654321", "654321")).toBeNull();
  });

  it("pide el PIN actual completo", () => {
    expect(validatePinChange("123", "654321", "654321")).toBe("missing");
  });

  it("rechaza un PIN nuevo que no tiene 6 dígitos", () => {
    expect(validatePinChange("123456", "65432", "65432")).toBe("format");
    expect(validatePinChange("123456", "65432a", "65432a")).toBe("format");
  });

  it("rechaza si la repetición no coincide", () => {
    expect(validatePinChange("123456", "654321", "654322")).toBe("mismatch");
  });
});

describe("validatePasswordChange", () => {
  it("acepta una contraseña de 8 o más caracteres repetida igual", () => {
    expect(validatePasswordChange("actual", "nuevaclave1", "nuevaclave1")).toBeNull();
  });

  it("pide la actual, exige mínimo 8 y que coincida", () => {
    expect(validatePasswordChange("", "nuevaclave1", "nuevaclave1")).toBe("missing");
    expect(validatePasswordChange("actual", "corta", "corta")).toBe("tooShort");
    expect(validatePasswordChange("actual", "nuevaclave1", "otraclave12")).toBe("mismatch");
  });
});

describe("classifyAccountResponse", () => {
  it("distingue éxito, dato actual incorrecto, dato nuevo inválido y fallo de servidor", () => {
    expect(classifyAccountResponse(200, { ok: true })).toBe("ok");
    expect(classifyAccountResponse(400, { error: "invalid_current" })).toBe("invalidCurrent");
    expect(classifyAccountResponse(400, { error: "invalid_new" })).toBe("invalidNew");
    expect(classifyAccountResponse(400, { error: "Invalid body" })).toBe("server");
    expect(classifyAccountResponse(500, null)).toBe("server");
  });
});
