import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { user: { role: string } } | null,
  stop: true,
  dup: false,
}));
const tpl = { id: "t", name: "N", archivedAt: null, createdAt: new Date(), items: [] };

vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleTrailerStopRepository: class {
    async findById() {
      return state.stop ? { id: "s" } : null;
    }
  },
  DrizzleStockRepository: class {
    async listByStop() {
      return [{ id: "r", stopId: "s", productId: "p", maxStock: 4, currentStock: 4 }];
    }
  },
  DrizzleStockTemplateRepository: class {
    async nameExists() {
      return state.dup;
    }
    async create() {
      return tpl;
    }
  },
}));

import { POST } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const ctx = { params: Promise.resolve({ id: ID }) };
const post = (b: unknown) =>
  new Request("http://x", { method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json" } });

beforeEach(() => {
  state.session = { user: { role: "admin" } };
  state.stop = true;
  state.dup = false;
});

describe("/api/admin/trailer-stops/[id]/save-as-template", () => {
  it("401 y 403", async () => {
    state.session = null;
    expect((await POST(post({ name: "N" }), ctx)).status).toBe(401);
    state.session = { user: { role: "delivery" } };
    expect((await POST(post({ name: "N" }), ctx)).status).toBe(403);
  });

  it("404 con id no UUID o parada inexistente", async () => {
    expect((await POST(post({ name: "N" }), { params: Promise.resolve({ id: "x" }) })).status).toBe(404);
    state.stop = false;
    expect((await POST(post({ name: "N" }), ctx)).status).toBe(404);
  });

  it("400, 201 y 409", async () => {
    expect((await POST(post({}), ctx)).status).toBe(400);
    expect((await POST(post({ name: "N" }), ctx)).status).toBe(201);
    state.dup = true;
    expect((await POST(post({ name: "N" }), ctx)).status).toBe(409);
  });
});
