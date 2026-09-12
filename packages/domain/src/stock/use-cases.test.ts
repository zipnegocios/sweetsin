import { describe, it, expect } from "vitest";
import { decrementStockOnSale } from "./use-cases";
import type { StopProductStock, StockEvent } from "./entities";
import type { StockRepository } from "./ports";

function fakeStockRepo(stock: StopProductStock): StockRepository & { events: Omit<StockEvent, "id">[] } {
  const events: Omit<StockEvent, "id">[] = [];
  let current = stock;
  return {
    events,
    async findByStopAndProduct(stopId, productId) {
      return stopId === current.stopId && productId === current.productId ? current : null;
    },
    async decrementStock(id, quantity) {
      current = { ...current, currentStock: current.currentStock - quantity };
      return current;
    },
    async recordEvent(event) {
      events.push(event);
      return { ...event, id: `event-${events.length}` };
    },
  };
}

describe("decrementStockOnSale", () => {
  it("decrements stock and records a sale event", async () => {
    const repo = fakeStockRepo({ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 10 });

    await decrementStockOnSale(repo, "stop1", "p1", 3);

    expect(repo.events).toEqual([
      { stopProductStockId: "s1", eventType: "sale", quantity: 3, reason: null, reportedByUserId: null },
    ]);
  });

  it("throws when there is no stock record for that stop/product", async () => {
    const repo = fakeStockRepo({ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 10 });

    await expect(decrementStockOnSale(repo, "other-stop", "p1", 1)).rejects.toThrow(
      "No stock record for product p1 at stop other-stop",
    );
  });

  it("throws when there is not enough stock", async () => {
    const repo = fakeStockRepo({ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 2 });

    await expect(decrementStockOnSale(repo, "stop1", "p1", 3)).rejects.toThrow(
      "Insufficient stock for product p1 at stop stop1",
    );
  });
});
