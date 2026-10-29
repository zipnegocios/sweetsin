import { describe, it, expect, vi, beforeEach } from "vitest";

const J = "11111111-1111-4111-8111-111111111111";
const T = "22222222-2222-4222-8222-222222222222";
const P = "33333333-3333-4333-8333-333333333333";

type Stop = { id: string; kind: string; status: string; location: string };
const state = vi.hoisted(() => ({
  stops: [] as Stop[],
  stock: [] as { stopId: string; productId: string; maxStock: number }[],
}));

vi.mock("@/lib/require-admin", () => ({ requireAdmin: vi.fn().mockResolvedValue({ userId: "admin-1" }) }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleTrailerStopRepository: class {
    async listAll(kind = "trailer") {
      return state.stops.filter((s) => s.kind === kind);
    }
    async findById(id: string) {
      return state.stops.find((s) => s.id === id) ?? null;
    }
    async create(stop: Omit<Stop, "id">) {
      const created = { ...stop, id: "new" };
      state.stops.push(created);
      return created;
    }
    async updateStatus(id: string, status: string) {
      state.stops.find((s) => s.id === id)!.status = status;
    }
  },
  DrizzleStockRepository: class {
    async create(row: { stopId: string; productId: string; maxStock: number }) {
      state.stock.push(row);
      return row;
    }
  },
  DrizzleProductRepository: class {
    async findById(id: string) {
      return id === P ? { id } : null;
    }
  },
  DrizzleStockTemplateRepository: class {
    async findById() {
      return null;
    }
  },
}));

import { openJornadaAction, closeJornadaAction } from "./admin-jornadas";

beforeEach(() => {
  state.stops = [
    { id: J, kind: "delivery", status: "active", location: "Viernes" },
    { id: T, kind: "trailer", status: "active", location: "Rundle Mall" },
  ];
  state.stock = [];
});

describe("admin-jornadas actions", () => {
  it("abrir con otra abierta devuelve el mensaje de conflicto sin lanzar", async () => {
    expect(await openJornadaAction({ name: "Otra", products: [] })).toEqual({ ok: false, error: "A jornada is already open" });
  });

  it("abrir con stock inicial", async () => {
    state.stops[0].status = "completed";
    expect(await openJornadaAction({ name: "Sábado", products: [{ productId: P, maxStock: 3 }] })).toEqual({ ok: true, id: "new" });
    expect(state.stock).toEqual([{ stopId: "new", productId: P, maxStock: 3, currentStock: 3 }]);
  });

  it("abrir con datos inválidos -> Invalid body", async () => {
    state.stops[0].status = "completed";
    expect(await openJornadaAction({ products: [{ productId: P, maxStock: 0 }] })).toEqual({ ok: false, error: "Invalid body" });
  });

  it("cerrar: jornada abierta ok; parada del trailer -> Stop not found", async () => {
    expect(await closeJornadaAction(T)).toEqual({ ok: false, error: "Stop not found" });
    expect(state.stops[1].status).toBe("active");
    expect(await closeJornadaAction(J)).toEqual({ ok: true });
    expect(await closeJornadaAction(J)).toEqual({ ok: false, error: "Only open jornadas can be closed" });
  });
});
