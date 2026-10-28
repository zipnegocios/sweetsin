import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { user: { role: string } } | null,
  stop: true,
  existing: false,
  completed: false,
  fk: false,
}));
const row = { id: "r1", stopId: "s", productId: "p", maxStock: 10, currentStock: 7 };

vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleTrailerStopRepository: class {
    async findById() {
      return state.stop ? { id: "s", status: state.completed ? "completed" : "scheduled" } : null;
    }
  },
  DrizzleStockRepository: class {
    async listByStop() {
      return [row];
    }
    async sumSold() {
      return 3;
    }
    async findByStopAndProduct() {
      return state.existing ? row : null;
    }
    async create(r: Record<string, unknown>) {
      if (state.fk) throw Object.assign(new Error("fk"), { cause: { code: "23503" } });
      return { id: "r2", ...r };
    }
  },
}));

import { GET, POST } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const ctx = { params: Promise.resolve({ id: ID }) };
const bad = { params: Promise.resolve({ id: "nope" }) };
const post = (b: unknown) =>
  new Request("http://x", { method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json" } });

beforeEach(() => {
  state.session = { user: { role: "admin" } };
  state.stop = true;
  state.existing = false;
  state.completed = false;
  state.fk = false;
});

describe("/api/admin/trailer-stops/[id]/stock", () => {
  it("401 y 403", async () => {
    state.session = null;
    expect((await GET(new Request("http://x"), ctx)).status).toBe(401);
    state.session = { user: { role: "delivery" } };
    expect((await POST(post({}), ctx)).status).toBe(403);
  });

  it("id no UUID o parada inexistente responde 404", async () => {
    expect((await GET(new Request("http://x"), bad)).status).toBe(404);
    state.stop = false;
    const res = await GET(new Request("http://x"), ctx);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Stop not found");
    expect((await POST(post({ productId: ID, quantity: 1 }), ctx)).status).toBe(404);
  });

  it("GET lista filas con sold", async () => {
    const res = await GET(new Request("http://x"), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).stock).toEqual([{ ...row, sold: 3 }]);
  });

  it("POST 400, 201 y 409", async () => {
    expect((await POST(post({ productId: "x", quantity: 1 }), ctx)).status).toBe(400);
    expect((await POST(post({ productId: ID, quantity: 5 }), ctx)).status).toBe(201);
    state.existing = true;
    expect((await POST(post({ productId: ID, quantity: 5 }), ctx)).status).toBe(409);
  });

  it("POST a una parada completada responde 409; GET sigue funcionando", async () => {
    state.completed = true;
    const res = await POST(post({ productId: ID, quantity: 3 }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Completed stops cannot be edited");
    expect((await GET(new Request("http://x"), ctx)).status).toBe(200);
  });

  it("productId inexistente (violación de FK 23503) responde 404 Product not found", async () => {
    state.fk = true;
    const res = await POST(post({ productId: ID, quantity: 3 }), ctx);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Product not found");
  });
});
