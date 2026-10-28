import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  session: null as { user: { id?: string; role: string } } | null,
  stop: true,
}));
const products = [{ productId: "p1", maxStock: 10, currentStock: 0, sold: 9, wasted: 1, soldOut: true }];

vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleTrailerStopRepository: class {
    async findById() {
      return state.stop ? { id: "s", status: "active" } : null;
    }
  },
  DrizzleStockRepository: class {
    async summarizeByStop() {
      return products;
    }
  },
  DrizzleOrderRepository: class {
    async countUndeliveredForStop() {
      return 3;
    }
  },
}));

import { GET } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) });
const get = () => new Request("http://x");

beforeEach(() => {
  state.session = { user: { id: "admin-1", role: "admin" } };
  state.stop = true;
});

describe("GET /api/admin/trailer-stops/[id]/close-summary", () => {
  it("401 sin sesión y 403 para otro rol", async () => {
    state.session = null;
    expect((await GET(get(), ctx())).status).toBe(401);
    state.session = { user: { role: "despachador" } };
    expect((await GET(get(), ctx())).status).toBe(403);
  });

  it("404 con id no UUID o parada inexistente", async () => {
    expect((await GET(get(), ctx("nope"))).status).toBe(404);
    state.stop = false;
    expect((await GET(get(), ctx())).status).toBe(404);
  });

  it("200 con el resumen de stock y pedidos sin entregar", async () => {
    const res = await GET(get(), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ products, undeliveredOrders: 3 });
  });
});
