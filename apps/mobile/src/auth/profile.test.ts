import { describe, expect, it } from "vitest";
import { credentialCode, parseProfile } from "./profile";

describe("credentialCode", () => {
  it("usa los 8 primeros caracteres del id en mayúsculas, sin guiones", () => {
    expect(credentialCode("1a2b3c4d-5e6f-7a8b-9c0d-112233445566")).toBe("SS-1A2B3C4D");
  });
});

describe("parseProfile", () => {
  it("extrae nombre, foto y código", () => {
    expect(
      parseProfile({ userId: "1a2b3c4d-0000", role: "delivery", name: "  Ana Pérez ", photoUrl: "https://x.r2/p.jpg?sig=1" }),
    ).toEqual({ name: "Ana Pérez", photoUrl: "https://x.r2/p.jpg?sig=1", code: "SS-1A2B3C4D" });
  });

  it("sin foto (o con una URL que no es https) deja photoUrl en null", () => {
    expect(parseProfile({ userId: "u1", name: "Ana", photoUrl: null })?.photoUrl).toBeNull();
    expect(parseProfile({ userId: "u1", name: "Ana", photoUrl: "http://x/p.jpg" })?.photoUrl).toBeNull();
    expect(parseProfile({ userId: "u1", name: "Ana" })?.photoUrl).toBeNull();
  });

  it("devuelve null si falta el nombre o el id, o si no es un objeto", () => {
    expect(parseProfile({ userId: "u1", name: null })).toBeNull();
    expect(parseProfile({ userId: "u1", name: "  " })).toBeNull();
    expect(parseProfile({ name: "Ana" })).toBeNull();
    expect(parseProfile(null)).toBeNull();
    expect(parseProfile("x")).toBeNull();
  });
});
