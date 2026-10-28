import { describe, it, expect, afterAll } from "vitest";
import { like, inArray } from "drizzle-orm";
import { DrizzleTrailerStopRepository } from "./trailer-stop-repository";
import { db } from "../index";
import { trailerStopsTable, stopProductStockTable, stockEventsTable, productsTable } from "../schema";

const DAY = 86_400_000;

describe("DrizzleTrailerStopRepository", () => {
  const prefix = `Plan1 Test ${Date.now()}`;
  const repo = new DrizzleTrailerStopRepository();

  const base = (suffix: string, startOffset: number, endOffset: number, status: "scheduled" | "active" | "completed" | "cancelled") => ({
    location: `${prefix} ${suffix}`,
    lat: -34.9289,
    lng: 138.5999,
    startTime: new Date(Date.now() + startOffset),
    endTime: new Date(Date.now() + endOffset),
    status,
  });

  afterAll(async () => {
    const stops = await db
      .select({ id: trailerStopsTable.id })
      .from(trailerStopsTable)
      .where(like(trailerStopsTable.location, `${prefix}%`));
    const stopIds = stops.map((s) => s.id);
    if (stopIds.length === 0) return;
    const stocks = await db
      .select({ id: stopProductStockTable.id })
      .from(stopProductStockTable)
      .where(inArray(stopProductStockTable.stopId, stopIds));
    const stockIds = stocks.map((s) => s.id);
    if (stockIds.length > 0) {
      await db.delete(stockEventsTable).where(inArray(stockEventsTable.stopProductStockId, stockIds));
      await db.delete(stopProductStockTable).where(inArray(stopProductStockTable.id, stockIds));
    }
    await db.delete(trailerStopsTable).where(inArray(trailerStopsTable.id, stopIds));
  });

  it("listVisible includes future scheduled and cancelled; excludes completed and ended cancelled", async () => {
    const scheduled = await repo.create(base("vis-scheduled", DAY, DAY + 3_600_000, "scheduled"));
    const cancelled = await repo.create(base("vis-cancelled", DAY, DAY + 3_600_000, "cancelled"));
    const completed = await repo.create(base("vis-completed", DAY, DAY + 3_600_000, "completed"));
    const endedCancelled = await repo.create(base("vis-ended-cancelled", -2 * DAY, -DAY, "cancelled"));

    const ids = (await repo.listVisible()).map((s) => s.id);

    expect(ids).toContain(scheduled.id);
    expect(ids).toContain(cancelled.id);
    expect(ids).not.toContain(completed.id);
    expect(ids).not.toContain(endedCancelled.id);
  });

  it("creates a stop with null original fields, finds it by id, and updates its status", async () => {
    const stop = await repo.create(base("crud", DAY, DAY + 3_600_000, "scheduled"));
    expect(stop.originalLocation).toBeNull();
    expect(stop.originalStartTime).toBeNull();

    const found = await repo.findById(stop.id);
    expect(found?.location).toBe(stop.location);

    await repo.updateStatus(stop.id, "completed");
    expect((await repo.findById(stop.id))?.status).toBe("completed");
  });

  it("update persists location, original fields and dates", async () => {
    const stop = await repo.create(base("update", DAY, DAY + 3_600_000, "scheduled"));
    const newStart = new Date(Date.now() + 2 * DAY);
    const newEnd = new Date(Date.now() + 2 * DAY + 3_600_000);

    await repo.update(stop.id, {
      location: `${prefix} update moved`,
      originalLocation: stop.location,
      originalLat: stop.lat,
      originalLng: stop.lng,
      originalStartTime: stop.startTime,
      originalEndTime: stop.endTime,
      startTime: newStart,
      endTime: newEnd,
    });

    const found = await repo.findById(stop.id);
    expect(found?.location).toBe(`${prefix} update moved`);
    expect(found?.originalLocation).toBe(stop.location);
    expect(found?.originalStartTime?.getTime()).toBe(stop.startTime.getTime());
    expect(found?.startTime.getTime()).toBe(newStart.getTime());
    expect(found?.endTime.getTime()).toBe(newEnd.getTime());
  });

  it("countOrders returns 0 for a stop without orders", async () => {
    const stop = await repo.create(base("count", DAY, DAY + 3_600_000, "scheduled"));
    expect(await repo.countOrders(stop.id)).toBe(0);
  });

  it("deleteWithStock removes the stop, its stock rows and stock events", async () => {
    const stop = await repo.create(base("delete", DAY, DAY + 3_600_000, "scheduled"));
    const [product] = await db.select({ id: productsTable.id }).from(productsTable).limit(1);
    const [stock] = await db
      .insert(stopProductStockTable)
      .values({ stopId: stop.id, productId: product.id, maxStock: 5, currentStock: 5 })
      .returning();
    await db.insert(stockEventsTable).values({ stopProductStockId: stock.id, eventType: "restock", quantity: 1 });

    await repo.deleteWithStock(stop.id);

    expect(await repo.findById(stop.id)).toBeNull();
    const stocks = await db.select().from(stopProductStockTable).where(inArray(stopProductStockTable.stopId, [stop.id]));
    expect(stocks).toHaveLength(0);
    const events = await db.select().from(stockEventsTable).where(inArray(stockEventsTable.stopProductStockId, [stock.id]));
    expect(events).toHaveLength(0);
  });
});
