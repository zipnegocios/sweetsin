import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { user: { role: string } } | null,
  stop: null as Record<string, unknown> | null,
  orders: 0,
  findError: null as Error | null,
  deleted: [] as string[],
}));

vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleTrailerStopRepository: class {
    async findById() {
      if (state.findError) throw state.findError;
      return state.stop;
    }
    async update() {}
    async updateStatus() {}
    async countOrders() {
      return state.orders;
    }
    async deleteWithStock(id: string) {
      state.deleted.push(id);
    }
  },
}));

import { GET, PATCH, DELETE } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const ctx = { params: Promise.resolve({ id: ID }) };
const body = (b: unknown) =>
  new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify(b), headers: { "content-type": "application/json" } });
const valid = { location: "Rundle", lat: -34.9, lng: 138.6, startTime: "2026-11-01T01:00:00.000Z", endTime: "2026-11-01T05:00:00.000Z" };
const stop = { id: ID, status: "scheduled", location: "A", lat: 1, lng: 2, startTime: new Date("2026-10-01T01:00:00Z"), endTime: new Date("2026-10-01T05:00:00Z"), originalLocation: null };

beforeEach(() => {
  state.session = { user: { role: "admin" } };
  state.stop = stop;
  state.orders = 0;
  state.findError = null;
  state.deleted = [];
});

describe("/api/admin/trailer-stops/[id]", () => {
  it("401 sin sesion y 403 para otro rol", async () => {
    state.session = null;
    expect((await DELETE(new Request("http://x"), ctx)).status).toBe(401);
    state.session = { user: { role: "delivery" } };
    expect((await DELETE(new Request("http://x"), ctx)).status).toBe(403);
  });

  it("PATCH con fin anterior al inicio responde 409", async () => {
    const res = await PATCH(body({ ...valid, startTime: valid.endTime, endTime: valid.startTime }), ctx);
    expect(res.status).toBe(409);
  });

  it("PATCH inexistente responde 404", async () => {
    state.stop = null;
    expect((await PATCH(body(valid), ctx)).status).toBe(404);
  });

  it("PATCH con cuerpo invalido responde 400", async () => {
    expect((await PATCH(body({ location: "" }), ctx)).status).toBe(400);
  });

  it("DELETE de parada con pedidos responde 409", async () => {
    state.orders = 2;
    const res = await DELETE(new Request("http://x"), ctx);
    expect(res.status).toBe(409);
    expect(state.deleted).toEqual([]);
  });

  it("DELETE sin pedidos responde 200 y llama a deleteWithStock", async () => {
    const res = await DELETE(new Request("http://x"), ctx);
    expect(res.status).toBe(200);
    expect(state.deleted).toEqual([ID]);
  });

  it("error inesperado responde 500 sin filtrar el SQL", async () => {
    state.findError = new Error("Failed query: select secret from users");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await PATCH(body(valid), ctx);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("Failed query");
    expect((await GET(new Request("http://x"), ctx)).status).toBe(500);
    spy.mockRestore();
  });

  it("id que no es UUID responde 404 sin tocar el repo", async () => {
    state.findError = new Error("boom");
    const bad = { params: Promise.resolve({ id: "nope" }) };
    expect((await GET(new Request("http://x"), bad)).status).toBe(404);
    expect((await PATCH(body(valid), bad)).status).toBe(404);
    expect((await DELETE(new Request("http://x"), bad)).status).toBe(404);
  });

  it("mensaje de dominio conocido responde 409", async () => {
    state.stop = { ...stop, status: "completed" };
    const res = await PATCH(body(valid), ctx);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Completed stops cannot be edited" });
  });
});
