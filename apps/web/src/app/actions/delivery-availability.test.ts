import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  enabled: true,
  mode: "separate" as "separate" | "shared",
  settingsFails: false,
  stops: [] as Array<{ id: string; status: string; kind: string }>,
  rows: [] as Array<{ stopId: string; productId: string; currentStock: number; maxStock: number }>,
}));

vi.mock("@workspace/db/repositories", () => ({
  DrizzleSettingsRepository: class {
    async get() {
      if (state.settingsFails) throw new Error("db down");
      return { deliveryStockControlEnabled: state.enabled, deliveryStockMode: state.mode };
    }
  },
  DrizzleTrailerStopRepository: class {
    async listAll(kind = "trailer") {
      return state.stops.filter((s) => s.kind === kind);
    }
  },
  DrizzleStockRepository: class {
    async listByStop(stopId: string) {
      return state.rows.filter((r) => r.stopId === stopId);
    }
  },
}));

import { getDeliveryAvailability } from "./delivery-availability";

const EMPTY = { enabled: false, open: false, stock: {} };

beforeEach(() => {
  state.enabled = true;
  state.mode = "separate";
  state.settingsFails = false;
  state.stops = [];
  state.rows = [];
});

describe("getDeliveryAvailability", () => {
  it("apagado: vacío", async () => {
    state.enabled = false;
    state.stops = [{ id: "j1", status: "active", kind: "delivery" }];
    expect(await getDeliveryAvailability()).toEqual(EMPTY);
  });

  it("si falla la lectura: vacío", async () => {
    state.settingsFails = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getDeliveryAvailability()).toEqual(EMPTY);
  });

  it("encendido sin jornada abierta: enabled sin stock", async () => {
    state.stops = [{ id: "j0", status: "completed", kind: "delivery" }];
    expect(await getDeliveryAvailability()).toEqual({ enabled: true, open: false, stock: {} });
  });

  it("encendido con jornada: solo ids y cantidades de su stock", async () => {
    state.stops = [
      { id: "t1", status: "active", kind: "trailer" },
      { id: "j1", status: "active", kind: "delivery" },
    ];
    state.rows = [
      { stopId: "j1", productId: "p1", currentStock: 3, maxStock: 10 },
      { stopId: "j1", productId: "p2", currentStock: 0, maxStock: 5 },
      { stopId: "t1", productId: "p1", currentStock: 9, maxStock: 9 },
    ];
    expect(await getDeliveryAvailability()).toEqual({ enabled: true, open: true, stock: { p1: 3, p2: 0 } });
  });

  it("modo shared: el stock de la parada del trailer activa", async () => {
    state.mode = "shared";
    state.stops = [{ id: "t1", status: "active", kind: "trailer" }];
    state.rows = [{ stopId: "t1", productId: "p1", currentStock: 9, maxStock: 9 }];
    expect(await getDeliveryAvailability()).toEqual({ enabled: true, open: true, stock: { p1: 9 } });
  });
});
