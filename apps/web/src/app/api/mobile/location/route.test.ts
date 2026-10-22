import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { userId: string; role: string } | null,
  user: null as Record<string, unknown> | null,
  saved: [] as unknown[],
  removed: [] as string[],
}));

vi.mock("../_lib/require-mobile-auth", () => ({ requireMobileAuth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleUserRepository: class {
    async findById() {
      return state.user;
    }
  },
  DrizzleDeliveryLocationRepository: class {
    async upsert(l: unknown) {
      state.saved.push(l);
    }
    async remove(id: string) {
      state.removed.push(id);
    }
  },
}));

import { PUT, DELETE } from "./route";

const recentIso = () => new Date(Date.now() - 5_000).toISOString();
const valid = () => ({ lat: 25.7, lng: -80.2, accuracyMeters: 10, recordedAt: recentIso() });
const req = (method: string, body?: unknown) =>
  new Request("http://localhost/x", {
    method,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    headers: { authorization: "Bearer t" },
  });

beforeEach(() => {
  state.session = { userId: "d1", role: "delivery" };
  state.user = { id: "d1", role: "delivery", isActive: true };
  state.saved = [];
  state.removed = [];
});

describe("PUT /api/mobile/location", () => {
  it("responde 403 para roles distintos de delivery", async () => {
    state.session = { userId: "x", role: "despachador" };
    expect((await PUT(req("PUT", valid()))).status).toBe(403);
    expect(state.saved).toHaveLength(0);
  });

  it("responde 400 con body invalido", async () => {
    expect((await PUT(req("PUT", "no-json"))).status).toBe(400);
    expect((await PUT(req("PUT", { ...valid(), lat: "x" }))).status).toBe(400);
    expect((await PUT(req("PUT", { ...valid(), recordedAt: "nope" }))).status).toBe(400);
    expect((await PUT(req("PUT", { ...valid(), lng: null }))).status).toBe(400);
    expect((await PUT(req("PUT", { lat: 1, lng: 1 }))).status).toBe(400);
    expect(state.saved).toHaveLength(0);
  });

  it("responde 200 y guarda la ubicacion", async () => {
    const res = await PUT(req("PUT", valid()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(state.saved).toHaveLength(1);
    expect(state.saved[0]).toMatchObject({ userId: "d1", lat: 25.7, lng: -80.2, accuracyMeters: 10 });
  });

  it("acepta accuracyMeters ausente", async () => {
    const { accuracyMeters: _a, ...body } = valid();
    expect((await PUT(req("PUT", body))).status).toBe(200);
    expect(state.saved[0]).toMatchObject({ accuracyMeters: null });
  });

  it("responde 409 por error de dominio (rango, usuario inactivo, fecha vieja)", async () => {
    expect((await PUT(req("PUT", { ...valid(), lat: 95 }))).status).toBe(409);
    expect((await PUT(req("PUT", { ...valid(), recordedAt: "2020-01-01T00:00:00Z" }))).status).toBe(409);
    state.user = { id: "d1", role: "delivery", isActive: false };
    expect((await PUT(req("PUT", valid()))).status).toBe(409);
    expect(state.saved).toHaveLength(0);
  });
});

describe("DELETE /api/mobile/location", () => {
  it("responde 403 para roles distintos de delivery", async () => {
    state.session = { userId: "x", role: "customer" };
    expect((await DELETE(req("DELETE"))).status).toBe(403);
    expect(state.removed).toHaveLength(0);
  });

  it("responde 200 y borra la ubicacion", async () => {
    const res = await DELETE(req("DELETE"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(state.removed).toEqual(["d1"]);
  });
});
