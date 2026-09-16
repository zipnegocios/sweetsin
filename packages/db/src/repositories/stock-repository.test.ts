import { describe, it, expect, beforeAll } from "vitest";
import { DrizzleStockRepository } from "./stock-repository";
import { DrizzleTrailerStopRepository } from "./trailer-stop-repository";
import { DrizzleProductRepository } from "./product-repository";

describe("DrizzleStockRepository", () => {
  let stopId: string;
  let productId: string;

  beforeAll(async () => {
    const stops = new DrizzleTrailerStopRepository();
    const stop = await stops.create({
      location: `Stock Test Stop ${Date.now()}`,
      lat: -34.9,
      lng: 138.6,
      startTime: new Date("2026-11-02T00:00:00Z"),
      endTime: new Date("2026-11-02T05:00:00Z"),
      status: "scheduled",
    });
    stopId = stop.id;

    const products = new DrizzleProductRepository();
    const product = await products.findBySlug("gluttony");
    if (!product) throw new Error("Seed product 'gluttony' not found — run the seed first");
    productId = product.id;
  });

  it("creates a stock row, lists it by stop, increments and decrements it", async () => {
    const repo = new DrizzleStockRepository();

    const created = await repo.create({ stopId, productId, maxStock: 30, currentStock: 30 });
    expect(created.currentStock).toBe(30);

    const byStop = await repo.listByStop(stopId);
    expect(byStop.some((s) => s.id === created.id)).toBe(true);

    const incremented = await repo.incrementStock(created.id, 5);
    expect(incremented.currentStock).toBe(35);

    const decremented = await repo.decrementStock(created.id, 10);
    expect(decremented.currentStock).toBe(25);
  });
});
