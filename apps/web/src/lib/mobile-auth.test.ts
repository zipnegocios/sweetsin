import { describe, it, expect, beforeAll } from "vitest";
import { signMobileJwt, verifyMobileJwt, verifyAppSignature } from "./mobile-auth";
import { createHmac } from "node:crypto";

describe("signMobileJwt / verifyMobileJwt", () => {
  beforeAll(() => {
    process.env.MOBILE_JWT_SECRET = "test-secret-key-for-jwt";
  });
  it("firma y verifica un JWT valido", async () => {
    const token = await signMobileJwt({ sub: "user-1", role: "despachador" });
    const payload = await verifyMobileJwt(token);
    expect(payload?.sub).toBe("user-1");
    expect(payload?.role).toBe("despachador");
  });

  it("rechaza un token invalido", async () => {
    const payload = await verifyMobileJwt("token-basura");
    expect(payload).toBeNull();
  });
});

describe("verifyAppSignature", () => {
  it("acepta una firma HMAC correcta", () => {
    const secret = process.env.EXPO_PUBLIC_APP_SECRET ?? "test-secret";
    process.env.EXPO_PUBLIC_APP_SECRET = secret;
    const body = JSON.stringify({ email: "a@a.com", pin: "123456" });
    const signature = createHmac("sha256", secret).update(body).digest("hex");

    expect(verifyAppSignature(signature, body)).toBe(true);
  });

  it("rechaza una firma incorrecta", () => {
    process.env.EXPO_PUBLIC_APP_SECRET = "test-secret";
    expect(verifyAppSignature("firma-incorrecta", "{}")).toBe(false);
  });
});
