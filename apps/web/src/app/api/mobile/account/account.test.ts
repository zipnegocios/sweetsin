import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { userId: string; role: string } | null,
  changeStaffPin: vi.fn(),
  changeStaffPassword: vi.fn(),
  verifyStaffPin: vi.fn(),
}));

vi.mock("../_lib/require-mobile-auth", () => ({ requireMobileAuth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({ DrizzleUserRepository: class {} }));
vi.mock("@workspace/domain/users", () => ({
  changeStaffPin: state.changeStaffPin,
  changeStaffPassword: state.changeStaffPassword,
  verifyStaffPin: state.verifyStaffPin,
}));

import { PUT as putPin } from "./pin/route";
import { PUT as putPassword } from "./password/route";
import { POST as verifyPin } from "./verify-pin/route";

const req = (method: string, body: unknown) =>
  new Request("http://localhost/x", { method, body: JSON.stringify(body), headers: { authorization: "Bearer t" } });

beforeEach(() => {
  vi.clearAllMocks();
  state.session = { userId: "d1", role: "delivery" };
});

describe("PUT /api/mobile/account/pin", () => {
  it("401 sin sesión", async () => {
    state.session = null;
    expect((await putPin(req("PUT", { currentPin: "111111", newPin: "222222" }))).status).toBe(401);
  });

  it("cambia el PIN del usuario de la sesión", async () => {
    const res = await putPin(req("PUT", { currentPin: "111111", newPin: "222222" }));
    expect(res.status).toBe(200);
    expect(state.changeStaffPin).toHaveBeenCalledWith(expect.anything(), "d1", "111111", "222222");
  });

  it("PIN actual incorrecto → 400 invalid_current (nunca 401, que cerraría la sesión)", async () => {
    state.changeStaffPin.mockRejectedValue(new Error("Current PIN is incorrect"));
    const res = await putPin(req("PUT", { currentPin: "000000", newPin: "222222" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_current" });
  });

  it("PIN nuevo inválido → 400 invalid_new; cuerpo malformado → 400", async () => {
    state.changeStaffPin.mockRejectedValue(new Error("PIN must be exactly 6 digits"));
    expect(await (await putPin(req("PUT", { currentPin: "111111", newPin: "2" }))).json()).toEqual({ error: "invalid_new" });
    expect((await putPin(req("PUT", { nope: 1 }))).status).toBe(400);
  });

  it("un error inesperado no se disfraza de error de validación", async () => {
    state.changeStaffPin.mockRejectedValue(new Error("db down"));
    await expect(putPin(req("PUT", { currentPin: "111111", newPin: "222222" }))).rejects.toThrow("db down");
  });
});

describe("PUT /api/mobile/account/password", () => {
  it("cambia la contraseña", async () => {
    const res = await putPassword(req("PUT", { currentPassword: "claveactual1", newPassword: "clavenueva99" }));
    expect(res.status).toBe(200);
    expect(state.changeStaffPassword).toHaveBeenCalledWith(expect.anything(), "d1", "claveactual1", "clavenueva99");
  });

  it("mapea contraseña actual incorrecta y nueva corta", async () => {
    state.changeStaffPassword.mockRejectedValueOnce(new Error("Current password is incorrect"));
    expect(await (await putPassword(req("PUT", { currentPassword: "x", newPassword: "clavenueva99" }))).json()).toEqual({ error: "invalid_current" });
    state.changeStaffPassword.mockRejectedValueOnce(new Error("Password must be at least 8 characters"));
    expect(await (await putPassword(req("PUT", { currentPassword: "x", newPassword: "corta" }))).json()).toEqual({ error: "invalid_new" });
  });
});

describe("POST /api/mobile/account/verify-pin", () => {
  it("devuelve el email propio con el PIN correcto", async () => {
    state.verifyStaffPin.mockResolvedValue({ id: "d1", email: "ana@sweetsin.com" });
    const res = await verifyPin(req("POST", { pin: "123456" }));
    expect(await res.json()).toEqual({ email: "ana@sweetsin.com" });
  });

  it("400 invalid_current con el PIN incorrecto", async () => {
    state.verifyStaffPin.mockResolvedValue(null);
    const res = await verifyPin(req("POST", { pin: "000000" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_current" });
  });
});
