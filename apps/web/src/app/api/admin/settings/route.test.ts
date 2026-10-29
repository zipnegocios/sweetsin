import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { user: { id?: string; role: string } } | null,
  settings: {} as Record<string, unknown>,
  updates: [] as Record<string, unknown>[],
}));

vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleSettingsRepository: class {
    async get() {
      return state.settings;
    }
    async update(partial: Record<string, unknown>) {
      state.updates.push(partial);
      state.settings = { ...state.settings, ...partial };
      return state.settings;
    }
  },
}));

import { GET, PUT } from "./route";

const put = (b: unknown) => new Request("http://x", { method: "PUT", body: JSON.stringify(b) });

beforeEach(() => {
  state.session = { user: { id: "admin-1", role: "admin" } };
  state.settings = { deliveryFeeCents: 500, liveStockEnabled: true, timingEnabled: true };
  state.updates = [];
});

describe("/api/admin/settings", () => {
  it("401 sin sesión y 403 para otro rol", async () => {
    state.session = null;
    expect((await GET()).status).toBe(401);
    state.session = { user: { role: "delivery" } };
    expect((await PUT(put({ liveStockEnabled: false }))).status).toBe(403);
    expect(state.updates).toEqual([]);
  });

  it("GET 200 devuelve los Settings", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).settings).toEqual(state.settings);
  });

  it("PUT 200 con actualización parcial", async () => {
    const res = await PUT(put({ liveStockEnabled: false, deliveryFeeCents: 0, deliveryEvidenceRequired: true }));
    expect(res.status).toBe(200);
    expect(state.updates).toEqual([{ liveStockEnabled: false, deliveryFeeCents: 0, deliveryEvidenceRequired: true }]);
    expect((await res.json()).settings).toMatchObject({ liveStockEnabled: false, deliveryFeeCents: 0 });
  });

  it("PUT 200 con el control de stock a domicilio y su modo", async () => {
    const res = await PUT(put({ deliveryStockControlEnabled: true, deliveryStockMode: "shared" }));
    expect(res.status).toBe(200);
    expect(state.updates).toEqual([{ deliveryStockControlEnabled: true, deliveryStockMode: "shared" }]);
    expect((await res.json()).settings).toMatchObject({ deliveryStockControlEnabled: true, deliveryStockMode: "shared" });
  });

  it("PUT con cuerpo vacío no escribe", async () => {
    expect((await PUT(put({}))).status).toBe(200);
    expect(state.updates).toEqual([]);
  });

  it("PUT 400 con valores o campos inválidos", async () => {
    expect((await PUT(put({ deliveryFeeCents: -1 }))).status).toBe(400);
    expect((await PUT(put({ deliveryFeeCents: 1.5 }))).status).toBe(400);
    expect((await PUT(put({ timingEnabled: "yes" }))).status).toBe(400);
    expect((await PUT(put({ unknown: true }))).status).toBe(400);
    expect((await PUT(put({ deliveryStockMode: "mixed" }))).status).toBe(400);
    expect((await PUT(put({ deliveryStockControlEnabled: "on" }))).status).toBe(400);
    expect((await PUT(new Request("http://x", { method: "PUT", body: "{" }))).status).toBe(400);
    expect(state.updates).toEqual([]);
  });
});
