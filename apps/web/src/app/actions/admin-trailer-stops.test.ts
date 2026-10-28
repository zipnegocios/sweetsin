import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  admin: true,
  stops: [] as { id: string; status: string; location: string }[],
  settings: { allowMultipleActiveStops: false, liveStockEnabled: true },
  undelivered: 0,
  updates: [] as [string, string][],
  current: 5,
  events: [] as Record<string, unknown>[],
  waste: [] as unknown[][],
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdmin: async () => {
    if (!state.admin) throw new Error("Forbidden");
    return { userId: "admin-1" };
  },
}));
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
  DrizzleOrderRepository: class {
    async countUndeliveredForStop() {
      return state.undelivered;
    }
  },
  DrizzleStockRepository: class {
    async findByStopAndProduct() {
      return { id: "r1", stopId: "s1", productId: "p1", maxStock: 10, currentStock: state.current };
    }
    async incrementStock() {}
    async recordEvent(e: Record<string, unknown>) {
      state.events.push(e);
    }
    async recordWaste(id: string, q: number, reason: string | null, by: string | null) {
      if (q > state.current) return false;
      state.waste.push([id, q, reason, by]);
      return true;
    }
    async summarizeByStop() {
      return [{ productId: "p1", maxStock: 10, currentStock: 5, sold: 5, wasted: 0, soldOut: false }];
    }
  },
  DrizzleSettingsRepository: class {
    async get() {
      return state.settings;
    }
  },
  DrizzleEventBookingRepository: class {},
  DrizzleStockTemplateRepository: class {},
}));

import {
  openTrailerStopAction,
  closeTrailerStopAction,
  restockStopProductAction,
  wasteStopProductAction,
  getStopCloseSummaryAction,
} from "./admin-trailer-stops";

beforeEach(() => {
  state.admin = true;
  state.stops = [{ id: "s1", status: "scheduled", location: "Glenelg" }];
  state.settings = { allowMultipleActiveStops: false, liveStockEnabled: true };
  state.undelivered = 0;
  state.updates = [];
  state.current = 5;
  state.events = [];
  state.waste = [];
});

describe("openTrailerStopAction", () => {
  it("abre una parada programada", async () => {
    expect(await openTrailerStopAction("s1")).toEqual({ ok: true });
    expect(state.updates).toEqual([["s1", "active"]]);
  });

  it("respeta allowMultipleActiveStops de Settings", async () => {
    state.stops.push({ id: "s2", status: "active", location: "Henley" });
    expect(await openTrailerStopAction("s1")).toEqual({ ok: false, error: "Another stop is active: Henley" });
    state.settings.allowMultipleActiveStops = true;
    expect(await openTrailerStopAction("s1")).toEqual({ ok: true });
  });

  it("devuelve los conflictos de dominio sin lanzar", async () => {
    state.stops[0]!.status = "completed";
    expect(await openTrailerStopAction("s1")).toEqual({ ok: false, error: "Only scheduled stops can be opened" });
    expect(await openTrailerStopAction("missing")).toEqual({ ok: false, error: "Stop not found" });
  });

  it("sin admin lanza Forbidden (igual que las acciones hermanas)", async () => {
    state.admin = false;
    await expect(openTrailerStopAction("s1")).rejects.toThrow("Forbidden");
  });
});

describe("closeTrailerStopAction", () => {
  beforeEach(() => {
    state.stops[0]!.status = "active";
  });

  it("exige confirmar si hay pedidos sin entregar", async () => {
    state.undelivered = 1;
    expect(await closeTrailerStopAction("s1")).toEqual({ ok: false, error: "Stop has undelivered orders" });
    expect(await closeTrailerStopAction("s1", { confirmUndelivered: true })).toEqual({ ok: true });
    expect(state.updates).toEqual([["s1", "completed"]]);
  });

  it("rechaza cerrar una parada que no está activa", async () => {
    state.stops[0]!.status = "scheduled";
    expect(await closeTrailerStopAction("s1")).toEqual({ ok: false, error: "Only active stops can be closed" });
  });
});

describe("restockStopProductAction y wasteStopProductAction", () => {
  beforeEach(() => {
    state.stops[0]!.status = "active";
  });

  it("con stock en vivo apagado responden Live stock is disabled", async () => {
    state.settings.liveStockEnabled = false;
    expect(await restockStopProductAction("s1", "p1", 2)).toEqual({ ok: false, error: "Live stock is disabled" });
    expect(await wasteStopProductAction("s1", "p1", 2)).toEqual({ ok: false, error: "Live stock is disabled" });
    expect(state.events).toEqual([]);
    expect(state.waste).toEqual([]);
  });

  it("registran al admin como quien reportó", async () => {
    expect(await restockStopProductAction("s1", "p1", 2)).toEqual({ ok: true });
    expect(state.events[0]).toMatchObject({ eventType: "restock", quantity: 2, reportedByUserId: "admin-1" });
    expect(await wasteStopProductAction("s1", "p1", 1, " Dropped ")).toEqual({ ok: true });
    expect(state.waste).toEqual([["r1", 1, "Dropped", "admin-1"]]);
  });

  it("devuelven los conflictos de stock", async () => {
    expect(await wasteStopProductAction("s1", "p1", 9)).toEqual({ ok: false, error: "Waste exceeds current stock" });
    state.stops[0]!.status = "scheduled";
    expect(await restockStopProductAction("s1", "p1", 1)).toEqual({ ok: false, error: "Stop is not active" });
  });
});

describe("getStopCloseSummaryAction", () => {
  it("devuelve el resumen de cierre", async () => {
    state.undelivered = 2;
    const result = await getStopCloseSummaryAction("s1");
    expect(result).toEqual({
      ok: true,
      summary: {
        products: [{ productId: "p1", maxStock: 10, currentStock: 5, sold: 5, wasted: 0, soldOut: false }],
        undeliveredOrders: 2,
      },
    });
  });

  it("parada inexistente: Stop not found", async () => {
    expect(await getStopCloseSummaryAction("missing")).toEqual({ ok: false, error: "Stop not found" });
  });
});
