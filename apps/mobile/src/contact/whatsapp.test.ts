import { describe, expect, it } from "vitest";
import { toWhatsAppNumber, whatsappUrl } from "./whatsapp";

describe("toWhatsAppNumber", () => {
  it.each([
    ["0412 345 678", "61412345678"],
    ["0412345678", "61412345678"],
    ["+61 412 345 678", "61412345678"],
    ["+44 7700 900123", "447700900123"],
    ["0044 7700 900123", "447700900123"],
    ["(08) 8123 4567", "61881234567"],
    ["61412345678", "61412345678"],
    ["+61 (0)412 345 678", "61412345678"],
    ["0061 (0)412 345 678", "61412345678"],
    ["+61 0412 345 678", "61412345678"],
    ["+61 (0)8 8123 4567", "61881234567"],
    ["0412.345.678", "61412345678"],
    ["+12345", null],
    ["+123456", "123456"],
    ["+123456789012345", "123456789012345"],
    ["+1234567890123456", null],
    ["041234567", null],
    ["04123456789", null],
    ["61+412345678", null],
    ["+61+412", null],
    ["0412 345 678 llamar", null],
    ["0412 345 678 x5", null],
    ["6141234567", null],
    ["6141234567890", null],
    ["+0412345678", null],
    ["000412345678", null],
  ])("normaliza %s", (raw, esperado) => {
    expect(toWhatsAppNumber(raw)).toBe(esperado);
  });

  it.each(["", "abc", "123", "+", "0412"])("devuelve null para %j", (raw) => {
    expect(toWhatsAppNumber(raw)).toBeNull();
  });
});

describe("whatsappUrl", () => {
  it("arma el enlace wa.me", () => {
    expect(whatsappUrl("0412 345 678")).toBe("https://wa.me/61412345678");
  });
  it("devuelve null si el número no es válido", () => {
    expect(whatsappUrl("x")).toBeNull();
  });
});
