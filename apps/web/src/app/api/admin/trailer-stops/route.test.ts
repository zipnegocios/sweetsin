import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({ session: null as { user: { role: string } } | null }));

vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleTrailerStopRepository: class {
    async listAll() {
      return [{ id: "s1" }];
    }
    async create(s: Record<string, unknown>) {
      return { id: "new", ...s };
    }
  },
  DrizzleStockRepository: class {},
}));

import { GET, POST } from "./route";

const post = (b: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(b) });
const valid = { location: "Rundle", lat: -34.9, lng: 138.6, startTime: "2026-11-01T01:00:00.000Z", endTime: "2026-11-01T05:00:00.000Z" };

beforeEach(() => {
  state.session = { user: { role: "admin" } };
});

describe("/api/admin/trailer-stops", () => {
  it("401 sin sesion y 403 para otro rol", async () => {
    state.session = null;
    expect((await GET()).status).toBe(401);
    state.session = { user: { role: "delivery" } };
    expect((await GET()).status).toBe(403);
  });

  it("GET lista las paradas", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ stops: [{ id: "s1" }] });
  });

  it("POST crea (201), 400 con cuerpo invalido y 409 con rango invertido", async () => {
    expect((await POST(post(valid))).status).toBe(201);
    expect((await POST(post({ location: "" }))).status).toBe(400);
    expect((await POST(post({ ...valid, startTime: valid.endTime, endTime: valid.startTime }))).status).toBe(409);
  });
});
