import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { user: { role: string } } | null,
  stop: true,
  row: true,
  sold: 0,
  movements: false,
  removed: [] as string[],
  completed: false,
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
    async findByStopAndProduct() {
      return state.row ? row : null;
    }
    async sumSold() {
      return state.sold;
    }
    async setQuantity(_id: string, max: number) {
      return { ...row, maxStock: max, currentStock: row.currentStock + (max - row.maxStock) };
    }
    async hasMovements() {
      return state.movements;
    }
    async remove(id: string) {
      state.removed.push(id);
    }
  },
}));

import { PATCH, DELETE } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const ctx = { params: Promise.resolve({ id: ID, productId: ID }) };
const patch = (b: unknown) =>
  new Request("http://x", { method: "PATCH", body: JSON.stringify(b), headers: { "content-type": "application/json" } });
const del = () => new Request("http://x", { method: "DELETE" });

beforeEach(() => {
  state.session = { user: { role: "admin" } };
  state.stop = true;
  state.row = true;
  state.sold = 0;
  state.movements = false;
  state.removed = [];
  state.completed = false;
});

describe("/api/admin/trailer-stops/[id]/stock/[productId]", () => {
  it("401 y 403", async () => {
    state.session = null;
    expect((await DELETE(del(), ctx)).status).toBe(401);
    state.session = { user: { role: "delivery" } };
    expect((await PATCH(patch({ quantity: 1 }), ctx)).status).toBe(403);
  });

  it("ids no UUID responden 404", async () => {
    const a = { params: Promise.resolve({ id: "x", productId: ID }) };
    const b = { params: Promise.resolve({ id: ID, productId: "x" }) };
    expect((await DELETE(del(), a)).status).toBe(404);
    expect((await PATCH(patch({ quantity: 1 }), b)).status).toBe(404);
  });

  it("parada o fila inexistente responde 404", async () => {
    state.stop = false;
    expect((await DELETE(del(), ctx)).status).toBe(404);
    state.stop = true;
    state.row = false;
    const res = await DELETE(del(), ctx);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Stock row not found");
  });

  it("PATCH 400, 200 y 409 below sold", async () => {
    expect((await PATCH(patch({ quantity: "a" }), ctx)).status).toBe(400);
    expect((await PATCH(patch({ quantity: 12 }), ctx)).status).toBe(200);
    state.sold = 20;
    expect((await PATCH(patch({ quantity: 12 }), ctx)).status).toBe(409);
  });

  it("DELETE 200 y 409 con movimientos", async () => {
    expect((await DELETE(del(), ctx)).status).toBe(200);
    expect(state.removed).toEqual(["r1"]);
    state.movements = true;
    expect((await DELETE(del(), ctx)).status).toBe(409);
  });

  it("PATCH y DELETE sobre una parada completada responden 409", async () => {
    state.completed = true;
    expect((await PATCH(patch({ quantity: 12 }), ctx)).status).toBe(409);
    expect((await DELETE(del(), ctx)).status).toBe(409);
    expect(state.removed).toEqual([]);
  });
});
