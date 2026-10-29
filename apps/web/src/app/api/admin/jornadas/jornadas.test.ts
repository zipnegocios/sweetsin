import { describe, it, expect, vi, beforeEach } from "vitest";

const J = "11111111-1111-4111-8111-111111111111"; // jornada
const T = "22222222-2222-4222-8222-222222222222"; // parada del trailer
const P = "33333333-3333-4333-8333-333333333333"; // producto
const TPL = "44444444-4444-4444-8444-444444444444"; // plantilla
const MISSING = "99999999-9999-4999-8999-999999999999";

type Stop = { id: string; kind: string; status: string; location: string };
const state = vi.hoisted(() => ({
  session: null as { user: { id?: string; role: string } } | null,
  stops: [] as Stop[],
  stock: [] as { stopId: string; productId: string; maxStock: number }[],
  liveStock: true,
  increments: [] as [string, number][],
  waste: [] as unknown[][],
  failStockCreate: false,
}));

vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleTrailerStopRepository: class {
    async listAll(kind = "trailer") {
      return state.stops.filter((s) => s.kind === kind);
    }
    async findById(id: string) {
      return state.stops.find((s) => s.id === id) ?? null;
    }
    async create(stop: Omit<Stop, "id">) {
      const created = { ...stop, id: `new-${state.stops.length}` };
      state.stops.push(created);
      return created;
    }
    async updateStatus(id: string, status: string) {
      state.stops.find((s) => s.id === id)!.status = status;
    }
    async countOrders() {
      return 0;
    }
    async deleteWithStock(id: string) {
      state.stops = state.stops.filter((s) => s.id !== id);
      state.stock = state.stock.filter((r) => r.stopId !== id);
    }
  },
  DrizzleStockRepository: class {
    async create(row: { stopId: string; productId: string; maxStock: number }) {
      if (state.failStockCreate) throw new Error("boom");
      state.stock.push(row);
      return { ...row, id: `r-${state.stock.length}` };
    }
    async summarizeByStop(stopId: string) {
      return state.stock
        .filter((r) => r.stopId === stopId)
        .map((r) => ({ productId: r.productId, maxStock: r.maxStock, currentStock: r.maxStock, sold: 0, wasted: 0, soldOut: false }));
    }
    async findByStopAndProduct(stopId: string, productId: string) {
      const r = state.stock.find((s) => s.stopId === stopId && s.productId === productId);
      return r ? { id: "r1", ...r, currentStock: r.maxStock } : null;
    }
    async incrementStock(id: string, q: number) {
      state.increments.push([id, q]);
    }
    async recordEvent() {}
    async recordWaste(id: string, q: number, reason: string | null, by: string | null) {
      state.waste.push([id, q, reason, by]);
      return {};
    }
  },
  DrizzleProductRepository: class {
    async findById(id: string) {
      return id === P ? { id } : null;
    }
  },
  DrizzleStockTemplateRepository: class {
    async findById(id: string) {
      return id === TPL ? { id, name: "Base", archived: false, items: [{ productId: P, quantity: 7 }] } : null;
    }
  },
  DrizzleSettingsRepository: class {
    async get() {
      return { liveStockEnabled: state.liveStock };
    }
  },
}));

import { GET as list, POST as open } from "./route";
import { GET as detail } from "./[id]/route";
import { POST as close } from "./[id]/close/route";
import { POST as restock } from "./[id]/stock/[productId]/restock/route";
import { POST as waste } from "./[id]/stock/[productId]/waste/route";

const post = (b?: unknown) => new Request("http://x", { method: "POST", body: b === undefined ? "" : JSON.stringify(b) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const sctx = (id: string, productId = P) => ({ params: Promise.resolve({ id, productId }) });

beforeEach(() => {
  state.session = { user: { id: "admin-1", role: "admin" } };
  state.stops = [
    { id: J, kind: "delivery", status: "active", location: "Viernes" },
    { id: T, kind: "trailer", status: "active", location: "Rundle Mall" },
  ];
  state.stock = [{ stopId: J, productId: P, maxStock: 5 }];
  state.liveStock = true;
  state.increments = [];
  state.waste = [];
  state.failStockCreate = false;
});

describe("/api/admin/jornadas", () => {
  it("401 sin sesión y 403 para otro rol en todos los endpoints", async () => {
    state.session = null;
    expect((await list()).status).toBe(401);
    expect((await open(post({}))).status).toBe(401);
    expect((await detail(post(), ctx(J))).status).toBe(401);
    state.session = { user: { role: "delivery" } };
    expect((await close(post(), ctx(J))).status).toBe(403);
    expect((await restock(post({ quantity: 1 }), sctx(J))).status).toBe(403);
    expect((await waste(post({ quantity: 1 }), sctx(J))).status).toBe(403);
    expect(state.stops.find((s) => s.id === J)!.status).toBe("active");
  });

  it("GET lista solo jornadas", async () => {
    const body = await (await list()).json();
    expect(body.jornadas.map((j: Stop) => j.id)).toEqual([J]);
  });

  it("404 con id no UUID, inexistente o de una parada del trailer", async () => {
    for (const id of ["nope", MISSING, T]) {
      expect((await detail(post(), ctx(id))).status).toBe(404);
      expect((await close(post(), ctx(id))).status).toBe(404);
      expect((await restock(post({ quantity: 1 }), sctx(id))).status).toBe(404);
      expect((await waste(post({ quantity: 1 }), sctx(id))).status).toBe(404);
    }
    expect(state.stops.find((s) => s.id === T)!.status).toBe("active");
    expect(state.increments).toEqual([]);
  });

  it("GET detalle devuelve la jornada y su stock vendido/disponible", async () => {
    const res = await detail(post(), ctx(J));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jornada.id).toBe(J);
    expect(body.stock).toEqual([{ productId: P, maxStock: 5, currentStock: 5, sold: 0, wasted: 0, soldOut: false }]);
  });

  it("POST 409 al abrir con otra jornada abierta", async () => {
    const res = await open(post({ name: "Otra" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "A jornada is already open" });
    expect(state.stops).toHaveLength(2);
  });

  it("POST abre con nombre y stock inicial", async () => {
    state.stops[0].status = "completed";
    const res = await open(post({ name: " Sábado ", products: [{ productId: P, maxStock: 4 }] }));
    expect(res.status).toBe(201);
    const { jornada } = await res.json();
    expect(jornada).toMatchObject({ kind: "delivery", status: "active", location: "Sábado" });
    expect(state.stock.filter((r) => r.stopId === jornada.id)).toEqual([{ stopId: jornada.id, productId: P, maxStock: 4, currentStock: 4 }]);
  });

  it("POST abre copiando una plantilla; plantilla o producto inexistente -> 404 sin abrir", async () => {
    state.stops[0].status = "completed";
    expect((await open(post({ templateId: MISSING }))).status).toBe(404);
    expect((await open(post({ products: [{ productId: MISSING, maxStock: 1 }] }))).status).toBe(404);
    expect(state.stops).toHaveLength(2);
    const res = await open(post({ templateId: TPL }));
    expect(res.status).toBe(201);
    const { jornada } = await res.json();
    expect(jornada.location).toBe("Delivery");
    expect(state.stock.find((r) => r.stopId === jornada.id)).toMatchObject({ productId: P, maxStock: 7 });
  });

  it("POST: si falla la carga de stock tras abrir, descarta la jornada y responde error", async () => {
    state.stops[0].status = "completed";
    state.failStockCreate = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await open(post({ products: [{ productId: P, maxStock: 2 }] }))).status).toBe(500);
    expect(state.stops.map((s) => s.id)).toEqual([J, T]);
    state.failStockCreate = false;
    expect((await open(post({ products: [{ productId: P, maxStock: 2 }] }))).status).toBe(201);
  });

  it("POST 400 con cuerpo inválido", async () => {
    state.stops[0].status = "completed";
    expect((await open(post({ products: [{ productId: P, maxStock: 0 }] }))).status).toBe(400);
    expect((await open(post({ templateId: TPL, products: [{ productId: P, maxStock: 1 }] }))).status).toBe(400);
    expect((await open(post({ products: [{ productId: P, maxStock: 1 }, { productId: P, maxStock: 2 }] }))).status).toBe(400);
    expect((await open(post({ extra: true }))).status).toBe(400);
    expect((await open(new Request("http://x", { method: "POST", body: "{" }))).status).toBe(400);
    expect(state.stops).toHaveLength(2);
  });

  it("POST sin cuerpo abre una jornada sin stock", async () => {
    state.stops[0].status = "completed";
    expect((await open(post())).status).toBe(201);
  });

  it("close cierra la jornada abierta; una cerrada -> 409", async () => {
    expect((await close(post(), ctx(J))).status).toBe(200);
    expect(state.stops.find((s) => s.id === J)!.status).toBe("completed");
    const again = await close(post(), ctx(J));
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "Only open jornadas can be closed" });
  });

  it("restock y waste registran el movimiento con el admin", async () => {
    expect((await restock(post({ quantity: 3 }), sctx(J))).status).toBe(200);
    expect(state.increments).toEqual([["r1", 3]]);
    expect((await waste(post({ quantity: 2, reason: " caída " }), sctx(J))).status).toBe(200);
    expect(state.waste).toEqual([["r1", 2, "caída", "admin-1"]]);
  });

  it("restock y waste: 409 con stock en vivo apagado o jornada cerrada; 404 sin fila", async () => {
    state.liveStock = false;
    const res = await restock(post({ quantity: 1 }), sctx(J));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Live stock is disabled" });
    expect((await waste(post({ quantity: 1 }), sctx(J))).status).toBe(409);
    state.liveStock = true;
    expect((await restock(post({ quantity: 1 }), sctx(J, MISSING))).status).toBe(404);
    state.stops[0].status = "completed";
    expect((await restock(post({ quantity: 1 }), sctx(J))).status).toBe(409);
    expect(state.increments).toEqual([]);
    expect(state.waste).toEqual([]);
  });
});
