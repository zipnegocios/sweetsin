import { describe, it, expect, beforeAll } from "vitest";
import { signMobileJwt, verifyMobileJwt } from "./mobile-auth";

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
