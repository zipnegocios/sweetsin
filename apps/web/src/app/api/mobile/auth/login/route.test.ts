import { describe, it, expect, beforeAll } from "vitest";
import { POST } from "./route";

beforeAll(() => {
  process.env.MOBILE_JWT_SECRET = "test-jwt-secret";
});

function loginRequest(body: string): Request {
  return new Request("http://localhost/api/mobile/auth/login", { method: "POST", body });
}

describe("POST /api/mobile/auth/login", () => {
  it("responde 400 si el body no es JSON", async () => {
    const res = await POST(loginRequest("no-es-json"));

    expect(res.status).toBe(400);
  });

  it("responde 400 si el pin no tiene 6 dígitos", async () => {
    const res = await POST(loginRequest(JSON.stringify({ email: "a@a.com", pin: "123" })));

    expect(res.status).toBe(400);
  });

  it("responde 401 con credenciales inválidas", async () => {
    const res = await POST(loginRequest(JSON.stringify({ email: "no-existe@sweetsin.test", pin: "123456" })));

    expect(res.status).toBe(401);
  });
});
