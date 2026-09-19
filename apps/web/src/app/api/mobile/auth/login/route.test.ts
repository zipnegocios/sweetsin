import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "node:crypto";
import { POST } from "./route";

beforeAll(() => {
  process.env.EXPO_PUBLIC_APP_SECRET = "test-secret";
  process.env.MOBILE_JWT_SECRET = "test-jwt-secret";
});

function sign(body: string): string {
  return createHmac("sha256", "test-secret").update(body).digest("hex");
}

describe("POST /api/mobile/auth/login", () => {
  it("rechaza sin firma HMAC", async () => {
    const body = JSON.stringify({ email: "a@a.com", pin: "123456" });
    const req = new Request("http://localhost/api/mobile/auth/login", { method: "POST", body });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("rechaza credenciales invalidas incluso con firma valida", async () => {
    const body = JSON.stringify({ email: "no-existe@sweetsin.test", pin: "123456" });
    const req = new Request("http://localhost/api/mobile/auth/login", {
      method: "POST",
      body,
      headers: { "x-app-signature": sign(body) },
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });
});
