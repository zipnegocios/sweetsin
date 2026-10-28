import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { user: { id?: string; role: string } } | null,
  stops: [] as { id: string; status: string; location: string }[],
  allowMultiple: false,
  updates: [] as [string, string][],
}));

vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleTrailerStopRepository: class {
    async findById(id: string) {
      return state.stops.find((s) => s.id === id) ?? null;
    }
    async listAll() {
      return state.stops;
    }
    async updateStatus(id: string, status: string) {
      state.updates.push([id, status]);
    }
  },
  DrizzleSettingsRepository: class {
    async get() {
      return { allowMultipleActiveStops: state.allowMultiple };
    }
  },
}));

import { POST } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) });
const post = () => new Request("http://x", { method: "POST" });

beforeEach(() => {
  state.session = { user: { id: "admin-1", role: "admin" } };
  state.stops = [{ id: ID, status: "scheduled", location: "Glenelg" }];
  state.allowMultiple = false;
  state.updates = [];
});

describe("POST /api/admin/trailer-stops/[id]/open", () => {
  it("401 sin sesión y 403 para otro rol", async () => {
    state.session = null;
    expect((await POST(post(), ctx())).status).toBe(401);
    state.session = { user: { role: "despachador" } };
    expect((await POST(post(), ctx())).status).toBe(403);
  });

  it("404 con id no UUID o parada inexistente", async () => {
    expect((await POST(post(), ctx("nope"))).status).toBe(404);
    expect((await POST(post(), ctx(OTHER))).status).toBe(404);
  });

  it("409 si otra parada está activa y Settings no permite varias", async () => {
    state.stops.push({ id: OTHER, status: "active", location: "Henley" });
    const res = await POST(post(), ctx());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Another stop is active: Henley");
    expect(state.updates).toEqual([]);
  });

  it("409 si la parada no está programada", async () => {
    state.stops[0]!.status = "completed";
    const res = await POST(post(), ctx());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Only scheduled stops can be opened");
  });

  it("200: abre la parada; con allowMultipleActiveStops admite otra activa", async () => {
    state.stops.push({ id: OTHER, status: "active", location: "Henley" });
    state.allowMultiple = true;
    expect((await POST(post(), ctx())).status).toBe(200);
    expect(state.updates).toEqual([[ID, "active"]]);
  });
});
