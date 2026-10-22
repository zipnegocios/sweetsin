import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({ session: null as { userId: string; role: "despachador" | "delivery" } | null }));
vi.mock("./require-mobile-auth", () => ({ requireMobileAuth: async () => state.session }));

import { authorizeMobile } from "./authorize-mobile";

const req = () => new Request("http://localhost/x", { headers: { authorization: "Bearer t" } });

beforeEach(() => {
  state.session = { userId: "u1", role: "delivery" };
});

describe("authorizeMobile", () => {
  it("401 si la sesion no es valida (JWT vencido/invalido o usuario inactivo)", async () => {
    state.session = null;
    const result = await authorizeMobile(req(), "delivery");
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    expect(await (result as Response).json()).toEqual({ error: "Unauthorized" });
  });

  it("401 tambien sin rol exigido", async () => {
    state.session = null;
    expect(((await authorizeMobile(req())) as Response).status).toBe(401);
  });

  it("403 solo si la sesion es valida pero el rol no corresponde", async () => {
    state.session = { userId: "u1", role: "despachador" };
    const result = await authorizeMobile(req(), "delivery");
    expect((result as Response).status).toBe(403);
    expect(await (result as Response).json()).toEqual({ error: "Forbidden" });
  });

  it("devuelve la sesion si el rol coincide o no se exige rol", async () => {
    expect(await authorizeMobile(req(), "delivery")).toEqual({ userId: "u1", role: "delivery" });
    state.session = { userId: "u2", role: "despachador" };
    expect(await authorizeMobile(req())).toEqual({ userId: "u2", role: "despachador" });
  });
});
