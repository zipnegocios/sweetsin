import { describe, it, expect } from "vitest";
import { decrementStockOnSale, initializeStopStock, restockProduct, reportStockWaste } from "./use-cases";
import type { StopProductStock, StockEvent } from "./entities";
import type { StockRepository } from "./ports";

function fakeStockRepo(initial: StopProductStock[] = []): StockRepository & {
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
