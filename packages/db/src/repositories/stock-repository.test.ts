import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DrizzleStockRepository } from "./stock-repository";
import { DrizzleTrailerStopRepository } from "./trailer-stop-repository";
import { DrizzleProductRepository } from "./product-repository";
import { eq, inArray } from "drizzle-orm";
import { setStopProductQuantity } from "@workspace/domain/stock";
import { db } from "../index";
import { ordersTable, productsTable, stockEventsTable, stopProductStockTable } from "../schema";

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

  afterAll(async () => {
    if (stopId) await new DrizzleTrailerStopRepository().deleteWithStock(stopId);
  });

  it("creates a stock row, lists it by stop and increments it", async () => {
    const repo = new DrizzleStockRepository();

    const created = await repo.create({ stopId, productId, maxStock: 30, currentStock: 30 });
    expect(created.currentStock).toBe(30);

    const byStop = await repo.listByStop(stopId);
    expect(byStop.some((s) => s.id === created.id)).toBe(true);

    const incremented = await repo.incrementStock(created.id, 5);
    expect(incremented.currentStock).toBe(35);

    expect(incremented.currentStock).toBe(35);
  });

  it("sumSold suma solo eventos sale, hasMovements, setQuantity y remove", async () => {
    const repo = new DrizzleStockRepository();
    const row = await repo.create({ stopId, productId, maxStock: 10, currentStock: 10 });
    expect(await repo.hasMovements(row.id)).toBe(false);
    expect(await repo.sumSold(row.id)).toBe(0);

    await repo.recordEvent({ stopProductStockId: row.id, eventType: "sale", quantity: 3, reason: null, reportedByUserId: null });
    await repo.recordEvent({ stopProductStockId: row.id, eventType: "sale", quantity: 2, reason: null, reportedByUserId: null });
    await repo.recordEvent({ stopProductStockId: row.id, eventType: "waste", quantity: 4, reason: null, reportedByUserId: null });
    expect(await repo.sumSold(row.id)).toBe(5);
    expect(await repo.hasMovements(row.id)).toBe(true);

    const updated = await repo.setQuantity(row.id, 20);
    expect(updated).toMatchObject({ maxStock: 20, currentStock: 20 }); // delta relativo: 10 + (20 - 10)

    await db.update(stopProductStockTable).set({ currentStock: 3 }).where(eq(stopProductStockTable.id, row.id)); // current 3
    expect(await repo.setQuantity(row.id, 10)).toBeNull(); // 3 + (10 - 20) < 0
    expect((await repo.listByStop(stopId)).find((x) => x.id === row.id)).toMatchObject({ maxStock: 20, currentStock: 3 });
    expect(await repo.setQuantity(row.id, 18)).toMatchObject({ maxStock: 18, currentStock: 1 });

    const wrath = await new DrizzleProductRepository().findBySlug("wrath");
    if (!wrath) throw new Error("Seed product 'wrath' not found");
    const fresh = await repo.create({ stopId, productId: wrath.id, maxStock: 5, currentStock: 5 });
    await repo.remove(fresh.id);
    expect((await repo.listByStop(stopId)).some((x) => x.id === fresh.id)).toBe(false);
  }, 15000);
});

describe("DrizzleStockRepository — ventas por pedido", () => {
  const repo = new DrizzleStockRepository();
  const stops = new DrizzleTrailerStopRepository();
  const tag = `stock-order-test-${Date.now()}`;
  let stopId: string;
  const productIds: string[] = [];
  const orderIds: string[] = [];

  async function newOrder(): Promise<string> {
    const [o] = await db
      .insert(ordersTable)
      .values({
        customerName: "Stock Test",
        customerEmail: `${tag}@example.com`,
        customerPhone: "+61400000000",
        fulfillmentType: "pickup",
        subtotalCents: 0,
        totalCents: 0,
        channel: "web",
      })
      .returning({ id: ordersTable.id });
    orderIds.push(o.id);
    return o.id;
  }

  async function freshRows(quantities: number[]) {
    for (const r of await repo.listByStop(stopId)) {
      await db.delete(stockEventsTable).where(eq(stockEventsTable.stopProductStockId, r.id));
      await repo.remove(r.id);
    }
    return Promise.all(
      quantities.map((q, i) => repo.create({ stopId, productId: productIds[i], maxStock: q, currentStock: q })),
    );
  }

  const eventsOf = (rowIds: string[]) =>
    db.select().from(stockEventsTable).where(inArray(stockEventsTable.stopProductStockId, rowIds));

  const currentOf = async (rowId: string) =>
    (await repo.listByStop(stopId)).find((r) => r.id === rowId)?.currentStock;

  beforeAll(async () => {
    const stop = await stops.create({
      location: `Stock Order Test Stop ${Date.now()}`,
      lat: -34.9,
      lng: 138.6,
      startTime: new Date("2026-11-03T00:00:00Z"),
      endTime: new Date("2026-11-03T05:00:00Z"),
      status: "active",
    });
    stopId = stop.id;
    for (let i = 0; i < 3; i++) {
      const [p] = await db
        .insert(productsTable)
        .values({
          slug: `${tag}-${i}`,
          category: "sin",
          nameEn: `Stock Test ${i}`,
          nameEs: `Prueba Stock ${i}`,
          descriptionEn: "Test",
          descriptionEs: "Prueba",
          priceCents: 1000,
        })
        .returning({ id: productsTable.id });
      productIds.push(p.id);
    }
  }, 15000);

  afterAll(async () => {
    if (stopId) await stops.deleteWithStock(stopId);
    if (orderIds.length) await db.delete(ordersTable).where(inArray(ordersTable.id, orderIds));
    if (productIds.length) await db.delete(productsTable).where(inArray(productsTable.id, productIds));
  }, 15000);

  it("(a) si una línea no alcanza, revierte todo y no deja eventos", async () => {
    const rows = await freshRows([5, 1, 5]);
    const orderId = await newOrder();
    const result = await repo.decrementForOrder(stopId, orderId, [
      { productId: productIds[0], quantity: 2 },
      { productId: productIds[1], quantity: 2 },
      { productId: productIds[2], quantity: 2 },
    ]);
    expect(result).toEqual({ ok: false, productId: productIds[1] });
    expect(await Promise.all(rows.map((r) => currentOf(r.id)))).toEqual([5, 1, 5]);
    expect(await eventsOf(rows.map((r) => r.id))).toEqual([]);
  }, 15000);

  it("(b) dos pedidos concurrentes por la última unidad: exactamente uno gana", async () => {
    const [row] = await freshRows([1]);
    const [o1, o2] = [await newOrder(), await newOrder()];
    const line = [{ productId: productIds[0], quantity: 1 }];
    const results = await Promise.all([
      repo.decrementForOrder(stopId, o1, line),
      repo.decrementForOrder(stopId, o2, line),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, productId: productIds[0] }]);
    expect(await currentOf(row.id)).toBe(0);
    const sales = (await eventsOf([row.id])).filter((e) => e.eventType === "sale");
    expect(sales).toHaveLength(1);
  }, 15000);

  it("(c) llegar a 0 por venta registra un solo early_sellout", async () => {
    const [row] = await freshRows([3]);
    const [o1, o2, o3] = [await newOrder(), await newOrder(), await newOrder()];
    expect(await repo.decrementForOrder(stopId, o1, [{ productId: productIds[0], quantity: 2 }])).toEqual({ ok: true });
    expect(await repo.decrementForOrder(stopId, o2, [{ productId: productIds[0], quantity: 1 }])).toEqual({ ok: true });
    expect(await repo.decrementForOrder(stopId, o3, [{ productId: productIds[0], quantity: 1 }])).toEqual({
      ok: false,
      productId: productIds[0],
    });
    const events = await eventsOf([row.id]);
    const sellouts = events.filter((e) => e.eventType === "early_sellout");
    expect(sellouts).toHaveLength(1);
    expect(sellouts[0]).toMatchObject({ quantity: 0, orderId: null });
    expect(events.filter((e) => e.eventType === "sale").map((e) => e.orderId).sort()).toEqual([o1, o2].sort());
  }, 15000);

  it("(c1) reponer y volver a agotar registra otro early_sellout", async () => {
    const [row] = await freshRows([1]);
    const [o1, o2] = [await newOrder(), await newOrder()];
    await repo.decrementForOrder(stopId, o1, [{ productId: productIds[0], quantity: 1 }]);
    await repo.incrementStock(row.id, 1);
    await repo.decrementForOrder(stopId, o2, [{ productId: productIds[0], quantity: 1 }]);
    const events = await eventsOf([row.id]);
    expect(events.filter((e) => e.eventType === "early_sellout")).toHaveLength(2);
  }, 15000);

  it("(c2) es idempotente por pedido: repetir el descuento del mismo pedido no toca el stock", async () => {
    const [row] = await freshRows([5]);
    const orderId = await newOrder();
    const line = [{ productId: productIds[0], quantity: 2 }];
    expect(await repo.decrementForOrder(stopId, orderId, line)).toEqual({ ok: true });
    expect(await repo.decrementForOrder(stopId, orderId, line)).toEqual({ ok: true });
    // Aunque la segunda llamada pida más de lo que queda, ya está descontado: no evalúa el stock.
    expect(await repo.decrementForOrder(stopId, orderId, [{ productId: productIds[0], quantity: 9 }])).toEqual({ ok: true });
    expect(await currentOf(row.id)).toBe(3);
    expect((await eventsOf([row.id])).filter((e) => e.eventType === "sale")).toHaveLength(1);
  }, 15000);

  it("(c3) reintentos simultáneos del mismo pedido descuentan una sola vez", async () => {
    const [row] = await freshRows([5]);
    const orderId = await newOrder();
    const line = [{ productId: productIds[0], quantity: 2 }];
    const results = await Promise.all([1, 2, 3].map(() => repo.decrementForOrder(stopId, orderId, line)));
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(await currentOf(row.id)).toBe(3);
    expect((await eventsOf([row.id])).filter((e) => e.eventType === "sale")).toHaveLength(1);
  }, 15000);

  it("(c4) tras reverseOrderSale el mismo pedido puede volver a descontarse", async () => {
    const [row] = await freshRows([5]);
    const orderId = await newOrder();
    const line = [{ productId: productIds[0], quantity: 2 }];
    await repo.decrementForOrder(stopId, orderId, line);
    await repo.reverseOrderSale(orderId);
    expect(await currentOf(row.id)).toBe(5);
    expect(await repo.decrementForOrder(stopId, orderId, line)).toEqual({ ok: true });
    expect(await currentOf(row.id)).toBe(3);
    expect(await repo.sumSold(row.id)).toBe(2);
  }, 15000);

  it("(d) reverseOrderSale devuelve el stock una sola vez y no toca pedidos sin ventas", async () => {
    const rows = await freshRows([5, 5]);
    const orderId = await newOrder();
    await repo.decrementForOrder(stopId, orderId, [
      { productId: productIds[0], quantity: 2 },
      { productId: productIds[1], quantity: 3 },
    ]);
    await repo.reverseOrderSale(orderId);
    expect(await Promise.all(rows.map((r) => currentOf(r.id)))).toEqual([5, 5]);
    await repo.reverseOrderSale(orderId);
    expect(await Promise.all(rows.map((r) => currentOf(r.id)))).toEqual([5, 5]);
    const reversals = (await eventsOf(rows.map((r) => r.id))).filter((e) => e.eventType === "sale_reversal");
    expect(reversals.map((e) => ({ id: e.stopProductStockId, q: e.quantity, o: e.orderId })).sort((a, b) => a.q - b.q)).toEqual([
      { id: rows[0].id, q: 2, o: orderId },
      { id: rows[1].id, q: 3, o: orderId },
    ]);

    const empty = await newOrder();
    await repo.reverseOrderSale(empty);
    expect(await Promise.all(rows.map((r) => currentOf(r.id)))).toEqual([5, 5]);
    expect(await eventsOf(rows.map((r) => r.id))).toHaveLength(4);
  }, 15000);

  it("(e) sumSold descuenta reversas y setStopProductQuantity sigue rechazando bajo lo vendido neto", async () => {
    const [row] = await freshRows([10]);
    const [o1, o2] = [await newOrder(), await newOrder()];
    await repo.decrementForOrder(stopId, o1, [{ productId: productIds[0], quantity: 4 }]);
    await repo.decrementForOrder(stopId, o2, [{ productId: productIds[0], quantity: 3 }]);
    await repo.reverseOrderSale(o1);
    expect(await repo.sumSold(row.id)).toBe(3);
    await expect(setStopProductQuantity(repo, stopId, productIds[0], 2)).rejects.toThrow(
      "Cannot set stock below units already sold",
    );
    await expect(setStopProductQuantity(repo, stopId, productIds[0], 3)).resolves.toMatchObject({
      maxStock: 3,
      currentStock: 0,
    });
  }, 15000);

  it("recordWaste descuenta y registra el evento juntos; si no alcanza no toca nada", async () => {
    const [row] = await freshRows([3]);
    expect(await repo.recordWaste(row.id, 4, "x", null)).toBeNull();
    expect(await currentOf(row.id)).toBe(3);
    expect(await eventsOf([row.id])).toEqual([]);
    expect(await repo.recordWaste(row.id, 2, "Se cayó", null)).toMatchObject({ currentStock: 1 });
    expect(await eventsOf([row.id])).toMatchObject([{ eventType: "waste", quantity: 2, reason: "Se cayó" }]);
  }, 15000);

  it("merma y venta concurrentes por las últimas unidades nunca dejan stock negativo", async () => {
    for (let i = 0; i < 3; i++) {
      const [row] = await freshRows([3]);
      const orderId = await newOrder();
      const [wasted, sale] = await Promise.all([
        repo.recordWaste(row.id, 3, null, null),
        repo.decrementForOrder(stopId, orderId, [{ productId: productIds[0], quantity: 3 }]),
      ]);
      expect([wasted !== null, sale.ok].filter(Boolean)).toHaveLength(1);
      expect(await currentOf(row.id)).toBe(0);
    }
  }, 30000);

  it("decrementForOrder valida cantidades enteras positivas antes de tocar la DB", async () => {
    const [row] = await freshRows([5]);
    const orderId = await newOrder();
    for (const quantity of [0, -1, 1.5]) {
      await expect(
        repo.decrementForOrder(stopId, orderId, [{ productId: productIds[0], quantity }]),
      ).rejects.toThrow("Quantity must be a positive integer");
    }
    expect(await currentOf(row.id)).toBe(5);
    expect(await eventsOf([row.id])).toEqual([]);
  }, 15000);

  it("pedidos concurrentes con líneas en orden opuesto no fallan", async () => {
    const rows = await freshRows([10, 10]);
    const [o1, o2] = [await newOrder(), await newOrder()];
    const a = { productId: productIds[0], quantity: 1 };
    const b = { productId: productIds[1], quantity: 1 };
    const results = await Promise.all([
      repo.decrementForOrder(stopId, o1, [a, b]),
      repo.decrementForOrder(stopId, o2, [b, a]),
    ]);
    expect(results).toEqual([{ ok: true }, { ok: true }]);
    expect(await Promise.all(rows.map((r) => currentOf(r.id)))).toEqual([8, 8]);
  }, 15000);

  it("(f) summarizeByStop cuenta vendido, merma y agotado", async () => {
    const rows = await freshRows([4, 6, 2]);
    const orderId = await newOrder();
    await repo.decrementForOrder(stopId, orderId, [
      { productId: productIds[0], quantity: 4 },
      { productId: productIds[1], quantity: 1 },
    ]);
    await repo.recordWaste(rows[1].id, 2, null, null);
    const summary = await repo.summarizeByStop(stopId);
    const byProduct = Object.fromEntries(summary.map((s) => [s.productId, s]));
    expect(byProduct[productIds[0]]).toEqual({ productId: productIds[0], maxStock: 4, currentStock: 0, sold: 4, wasted: 0, soldOut: true });
    expect(byProduct[productIds[1]]).toEqual({ productId: productIds[1], maxStock: 6, currentStock: 3, sold: 1, wasted: 2, soldOut: false });
    expect(byProduct[productIds[2]]).toEqual({ productId: productIds[2], maxStock: 2, currentStock: 2, sold: 0, wasted: 0, soldOut: false });
  }, 15000);
});
