import { describe, it, expect } from "vitest";
import {
  addStopProduct,
  decrementStockOnSale,
  initializeStopStock,
  isStockConflictMessage,
  removeStopProduct,
  restockProduct,
  restockStopProduct,
  reportStockWaste,
  saveStopStockAsTemplate,
  setStopProductQuantity,
  wasteStopProduct,
} from "./use-cases";
import type { StockTemplateRepository } from "../stock-templates";
import type { TrailerStop, TrailerStopRepository, TrailerStopStatus } from "../trailer-stops";
import type { StopProductStock, StockEvent } from "./entities";
import type { StockRepository } from "./ports";

function fakeStockRepo(
  initial: StopProductStock[] = [],
  movements: { stockId: string; type: StockEvent["eventType"]; quantity: number }[] = [],
): StockRepository & {
  events: Omit<StockEvent, "id">[];
  created: Omit<StopProductStock, "id">[];
} {
  const stock = [...initial];
  const events: Omit<StockEvent, "id">[] = [];
  const created: Omit<StopProductStock, "id">[] = [];
  return {
    events,
    created,
    async findByStopAndProduct(stopId, productId) {
      return stock.find((s) => s.stopId === stopId && s.productId === productId) ?? null;
    },
    async decrementStock(id, quantity) {
      const item = stock.find((s) => s.id === id);
      if (!item) throw new Error("not found");
      item.currentStock -= quantity;
      return item;
    },
    async incrementStock(id, quantity) {
      const item = stock.find((s) => s.id === id);
      if (!item) throw new Error("not found");
      item.currentStock += quantity;
      return item;
    },
    async recordEvent(event) {
      events.push(event);
      return { ...event, id: `event-${events.length}` };
    },
    async create(item) {
      created.push(item);
      const inserted = { ...item, id: `stock-${created.length}` };
      stock.push(inserted);
      return inserted;
    },
    async listByStop(stopId) {
      return stock.filter((s) => s.stopId === stopId);
    },
    async sumSold(id) {
      return movements
        .filter((m) => m.stockId === id && (m.type === "sale" || m.type === "sale_reversal"))
        .reduce((a, m) => a + (m.type === "sale" ? m.quantity : -m.quantity), 0);
    },
    async recordWaste(id, quantity, reason, reportedByUserId) {
      const item = stock.find((s) => s.id === id);
      if (!item || item.currentStock < quantity) return null;
      item.currentStock -= quantity;
      events.push({ stopProductStockId: id, eventType: "waste", quantity, reason, reportedByUserId });
      return item;
    },
    async decrementForOrder() {
      throw new Error("not used");
    },
    async reverseOrderSale() {
      throw new Error("not used");
    },
    async summarizeByStop() {
      throw new Error("not used");
    },
    async hasMovements(id) {
      return movements.some((m) => m.stockId === id);
    },
    async setQuantity(id, maxStock) {
      const item = stock.find((s) => s.id === id);
      if (!item) return null;
      const current = item.currentStock + (maxStock - item.maxStock);
      if (current < 0) return null;
      item.maxStock = maxStock;
      item.currentStock = current;
      return item;
    },
    async remove(id) {
      const i = stock.findIndex((s) => s.id === id);
      if (i >= 0) stock.splice(i, 1);
    },
  };
}

describe("decrementStockOnSale", () => {
  it("decrements stock and records a sale event", async () => {
    const repo = fakeStockRepo([{ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 10 }]);

    await decrementStockOnSale(repo, "stop1", "p1", 3);

    expect(repo.events).toEqual([
      { stopProductStockId: "s1", eventType: "sale", quantity: 3, reason: null, reportedByUserId: null },
    ]);
  });

  it("throws when there is no stock record for that stop/product", async () => {
    const repo = fakeStockRepo([{ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 10 }]);

    await expect(decrementStockOnSale(repo, "other-stop", "p1", 1)).rejects.toThrow(
      "No stock record for product p1 at stop other-stop",
    );
  });

  it("throws when there is not enough stock", async () => {
    const repo = fakeStockRepo([{ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 2 }]);

    await expect(decrementStockOnSale(repo, "stop1", "p1", 3)).rejects.toThrow(
      "Insufficient stock for product p1 at stop stop1",
    );
  });
});

describe("initializeStopStock", () => {
  it("creates one stock row per product with currentStock equal to maxStock", async () => {
    const repo = fakeStockRepo([]);

    const result = await initializeStopStock(repo, "stop1", [
      { productId: "p1", maxStock: 20 },
      { productId: "p2", maxStock: 15 },
    ]);

    expect(result).toHaveLength(2);
    expect(repo.created).toEqual([
      { stopId: "stop1", productId: "p1", maxStock: 20, currentStock: 20 },
      { stopId: "stop1", productId: "p2", maxStock: 15, currentStock: 15 },
    ]);
  });
});

describe("restockProduct", () => {
  it("increments stock and records a restock event", async () => {
    const repo = fakeStockRepo([{ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 10 }]);

    await restockProduct(repo, "stop1", "p1", 5, "user1");

    expect(repo.events).toEqual([
      { stopProductStockId: "s1", eventType: "restock", quantity: 5, reason: null, reportedByUserId: "user1" },
    ]);
  });
});

describe("reportStockWaste", () => {
  it("decrements stock and records a waste event with a reason", async () => {
    const repo = fakeStockRepo([{ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 10 }]);

    await reportStockWaste(repo, "stop1", "p1", 2, "Dropped tray", "user1");

    expect(repo.events).toEqual([
      { stopProductStockId: "s1", eventType: "waste", quantity: 2, reason: "Dropped tray", reportedByUserId: "user1" },
    ]);
  });

  it("throws when there is not enough stock to waste", async () => {
    const repo = fakeStockRepo([{ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 1 }]);

    await expect(reportStockWaste(repo, "stop1", "p1", 2, null, null)).rejects.toThrow(
      "Insufficient stock for product p1 at stop stop1",
    );
  });
});

const row = (over: Partial<StopProductStock> = {}): StopProductStock => ({
  id: "s1", stopId: "stop1", productId: "p1", maxStock: 20, currentStock: 20, ...over,
});

describe("setStopProductQuantity", () => {
  it("sube la cantidad y suma la diferencia al stock actual", async () => {
    const repo = fakeStockRepo([row({ currentStock: 15 })], [{ stockId: "s1", type: "sale", quantity: 5 }]);
    const result = await setStopProductQuantity(repo, "stop1", "p1", 30);
    expect(result).toMatchObject({ maxStock: 30, currentStock: 25 });
  });

  it("baja la cantidad hasta lo vendido", async () => {
    const repo = fakeStockRepo([row({ currentStock: 15 })], [{ stockId: "s1", type: "sale", quantity: 5 }]);
    const result = await setStopProductQuantity(repo, "stop1", "p1", 5);
    expect(result).toMatchObject({ maxStock: 5, currentStock: 0 });
  });

  it("rechaza bajar por debajo de lo vendido", async () => {
    const repo = fakeStockRepo([row({ currentStock: 15 })], [{ stockId: "s1", type: "sale", quantity: 5 }]);
    await expect(setStopProductQuantity(repo, "stop1", "p1", 4)).rejects.toThrow(
      "Cannot set stock below units already sold",
    );
  });

  it("rechaza si el stock actual quedaría negativo (hubo mermas)", async () => {
    const repo = fakeStockRepo([row({ currentStock: 5 })], [{ stockId: "s1", type: "waste", quantity: 15 }]);
    await expect(setStopProductQuantity(repo, "stop1", "p1", 10)).rejects.toThrow("Current stock would be negative");
  });

  it("rechaza cantidad 0 o decimal", async () => {
    const repo = fakeStockRepo([row()]);
    await expect(setStopProductQuantity(repo, "stop1", "p1", 0)).rejects.toThrow("Quantity must be a positive integer");
    await expect(setStopProductQuantity(repo, "stop1", "p1", 1.5)).rejects.toThrow("Quantity must be a positive integer");
  });

  it("rechaza si la fila no existe", async () => {
    await expect(setStopProductQuantity(fakeStockRepo(), "stop1", "p1", 3)).rejects.toThrow("Stock row not found");
  });
});

describe("addStopProduct", () => {
  it("agrega un producto nuevo", async () => {
    const repo = fakeStockRepo();
    await addStopProduct(repo, "stop1", "p2", 12);
    expect(repo.created).toEqual([{ stopId: "stop1", productId: "p2", maxStock: 12, currentStock: 12 }]);
  });

  it("rechaza agregar un producto ya presente", async () => {
    const repo = fakeStockRepo([row()]);
    await expect(addStopProduct(repo, "stop1", "p1", 5)).rejects.toThrow("Product already has stock at this stop");
  });

  it("rechaza cantidad inválida", async () => {
    await expect(addStopProduct(fakeStockRepo(), "stop1", "p2", 0)).rejects.toThrow("Quantity must be a positive integer");
  });
});

describe("removeStopProduct", () => {
  it("quita un producto sin movimientos", async () => {
    const repo = fakeStockRepo([row()]);
    await removeStopProduct(repo, "stop1", "p1");
    expect(await repo.listByStop("stop1")).toEqual([]);
  });

  it("rechaza quitar uno con movimientos", async () => {
    const repo = fakeStockRepo([row()], [{ stockId: "s1", type: "restock", quantity: 1 }]);
    await expect(removeStopProduct(repo, "stop1", "p1")).rejects.toThrow("Stock row has movements");
  });

  it("rechaza si la fila no existe", async () => {
    await expect(removeStopProduct(fakeStockRepo(), "stop1", "p1")).rejects.toThrow("Stock row not found");
  });
});

describe("saveStopStockAsTemplate", () => {
  it("guarda la parada como plantilla copiando maxStock", async () => {
    const stock = fakeStockRepo([row({ currentStock: 3 }), row({ id: "s2", productId: "p2", maxStock: 8, currentStock: 8 })]);
    const calls: { name: string; items: { productId: string; quantity: number }[] }[] = [];
    const templates = {
      async nameExists() { return false; },
      async create(name, items) {
        calls.push({ name, items });
        return { id: "t1", name, archived: false, items };
      },
    } as unknown as StockTemplateRepository;

    await saveStopStockAsTemplate(stock, templates, "stop1", "Viernes");

    expect(calls).toEqual([
      { name: "Viernes", items: [{ productId: "p1", quantity: 20 }, { productId: "p2", quantity: 8 }] },
    ]);
  });
});

function fakeStops(status: TrailerStopStatus): TrailerStopRepository {
  return {
    async findById(id: string) {
      return id === "stop1" ? ({ id, status } as TrailerStop) : null;
    },
  } as unknown as TrailerStopRepository;
}

describe("restockStopProduct", () => {
  it("repone en una parada activa y guarda quién reportó", async () => {
    const stock = fakeStockRepo([row({ currentStock: 4 })]);
    await restockStopProduct({ stops: fakeStops("active"), stock }, "stop1", "p1", 6, "user1");
    expect((await stock.findByStopAndProduct("stop1", "p1"))?.currentStock).toBe(10);
    expect(stock.events).toEqual([
      { stopProductStockId: "s1", eventType: "restock", quantity: 6, reason: null, reportedByUserId: "user1" },
    ]);
  });

  it.each(["scheduled", "completed"] as const)("rechaza una parada %s", async (status) => {
    const stock = fakeStockRepo([row()]);
    await expect(restockStopProduct({ stops: fakeStops(status), stock }, "stop1", "p1", 1, null)).rejects.toThrow(
      "Stop is not active",
    );
    expect(stock.events).toEqual([]);
  });

  it.each([0, -1, 1.5])("rechaza cantidad %s", async (q) => {
    const stock = fakeStockRepo([row()]);
    await expect(restockStopProduct({ stops: fakeStops("active"), stock }, "stop1", "p1", q, null)).rejects.toThrow(
      "Quantity must be a positive integer",
    );
  });

  it("rechaza si la fila no existe", async () => {
    await expect(
      restockStopProduct({ stops: fakeStops("active"), stock: fakeStockRepo() }, "stop1", "p1", 1, null),
    ).rejects.toThrow("Stock row not found");
  });
});

describe("wasteStopProduct", () => {
  it("merma igual al stock actual lo deja en 0 y guarda motivo y quién reportó", async () => {
    const stock = fakeStockRepo([row({ currentStock: 3 })]);
    await wasteStopProduct({ stops: fakeStops("active"), stock }, "stop1", "p1", 3, "Se cayó", "user1");
    expect((await stock.findByStopAndProduct("stop1", "p1"))?.currentStock).toBe(0);
    expect(stock.events).toEqual([
      { stopProductStockId: "s1", eventType: "waste", quantity: 3, reason: "Se cayó", reportedByUserId: "user1" },
    ]);
  });

  it("rechaza merma mayor al stock actual", async () => {
    const stock = fakeStockRepo([row({ currentStock: 3 })]);
    await expect(
      wasteStopProduct({ stops: fakeStops("active"), stock }, "stop1", "p1", 4, null, null),
    ).rejects.toThrow("Waste exceeds current stock");
    expect(stock.events).toEqual([]);
  });

  it("si la guarda del repositorio no descuenta (venta concurrente), rechaza por merma excesiva", async () => {
    const stock = fakeStockRepo([row({ currentStock: 3 })]);
    stock.recordWaste = async () => null;
    await expect(
      wasteStopProduct({ stops: fakeStops("active"), stock }, "stop1", "p1", 3, null, null),
    ).rejects.toThrow("Waste exceeds current stock");
  });

  it.each(["scheduled", "completed"] as const)("rechaza una parada %s", async (status) => {
    await expect(
      wasteStopProduct({ stops: fakeStops(status), stock: fakeStockRepo([row()]) }, "stop1", "p1", 1, null, null),
    ).rejects.toThrow("Stop is not active");
  });

  it.each([0, -1, 1.5])("rechaza cantidad %s", async (q) => {
    await expect(
      wasteStopProduct({ stops: fakeStops("active"), stock: fakeStockRepo([row()]) }, "stop1", "p1", q, null, null),
    ).rejects.toThrow("Quantity must be a positive integer");
  });
});

describe("setStopProductQuantity con reversas", () => {
  it("lo vendido neto descuenta las reversas", async () => {
    const repo = fakeStockRepo([row({ currentStock: 17 })], [
      { stockId: "s1", type: "sale", quantity: 5 },
      { stockId: "s1", type: "sale_reversal", quantity: 2 },
    ]);
    await expect(setStopProductQuantity(repo, "stop1", "p1", 3)).resolves.toMatchObject({ maxStock: 3 });
  });
});

describe("isStockConflictMessage", () => {
  it("reconoce los mensajes de conflicto", () => {
    for (const m of [
      "Cannot set stock below units already sold",
      "Current stock would be negative",
      "Stock row has movements",
      "Product already has stock at this stop",
      "Stock row not found",
      "Quantity must be a positive integer",
      "Stop is not active",
      "Waste exceeds current stock",
    ]) expect(isStockConflictMessage(m)).toBe(true);
    expect(isStockConflictMessage("boom")).toBe(false);
  });
});
