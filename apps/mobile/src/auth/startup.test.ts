import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveStartupSession, type StaffRole, type StartupDeps } from "./startup";

function deps(overrides: Partial<StartupDeps> = {}, cached: StaffRole | null = "delivery") {
  const saved: StaffRole[] = [];
  const d: StartupDeps = {
    getToken: async () => "jwt",
    getCachedRole: async () => cached,
    saveRole: async (role) => {
      saved.push(role);
    },
    fetchMe: async () => new Response(JSON.stringify({ userId: "u1", role: "delivery" }), { status: 200 }),
    ...overrides,
  };
  return { d, saved };
}

afterEach(() => vi.useRealTimers());

describe("resolveStartupSession", () => {
  it("sin token -> login, sin llamar a la red", async () => {
    const fetchMe = vi.fn();
    const { d } = deps({ getToken: async () => null, fetchMe });
    expect(await resolveStartupSession(d)).toEqual({ role: null, invalid: false });
    expect(fetchMe).not.toHaveBeenCalled();
  });

  it("200 -> entra con el rol del servidor y lo cachea", async () => {
    const { d, saved } = deps({}, null);
    expect(await resolveStartupSession(d)).toEqual({ role: "delivery", invalid: false });
    expect(saved).toEqual(["delivery"]);
  });

  it("401 -> sesion invalida (unico caso que desloguea)", async () => {
    const { d } = deps({ fetchMe: async () => new Response("{}", { status: 401 }) });
    expect(await resolveStartupSession(d)).toEqual({ role: null, invalid: true });
  });

  it("sin red (TypeError) -> entra con el rol cacheado", async () => {
    const { d } = deps({
      fetchMe: async () => {
        throw new TypeError("Network request failed");
      },
    });
    expect(await resolveStartupSession(d)).toEqual({ role: "delivery", invalid: false });
  });

  it.each([500, 502, 503])("%i -> entra con el rol cacheado, sin desloguear", async (status) => {
    const { d } = deps({ fetchMe: async () => new Response("", { status }) });
    expect(await resolveStartupSession(d)).toEqual({ role: "delivery", invalid: false });
  });

  it("timeout -> entra con el rol cacheado (nunca queda en blanco)", async () => {
    vi.useFakeTimers();
    const { d } = deps({ fetchMe: () => new Promise<Response>(() => {}) });
    const result = resolveStartupSession(d, 8000);
    await vi.advanceTimersByTimeAsync(8000);
    await expect(result).resolves.toEqual({ role: "delivery", invalid: false });
  });

  it("sin red y sin rol cacheado -> login pero conserva el token", async () => {
    const { d } = deps(
      {
        fetchMe: async () => {
          throw new TypeError("Network request failed");
        },
      },
      null,
    );
    expect(await resolveStartupSession(d)).toEqual({ role: null, invalid: false });
  });

  it("200 con un rol desconocido -> usa el cacheado", async () => {
    const { d, saved } = deps({ fetchMe: async () => new Response(JSON.stringify({ role: "admin" }), { status: 200 }) });
    expect(await resolveStartupSession(d)).toEqual({ role: "delivery", invalid: false });
    expect(saved).toEqual([]);
  });

  it("otras excepciones se propagan", async () => {
    const { d } = deps({
      fetchMe: async () => {
        throw new Error("boom");
      },
    });
    await expect(resolveStartupSession(d)).rejects.toThrow("boom");
  });
});
