import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "../index";
import { orderItemsTable, orderStatusEventsTable, ordersTable, productsTable } from "../schema";
import { DrizzleOrderTimingRepository } from "./order-timing-repository";
import { DrizzleTrailerStopRepository } from "./trailer-stop-repository";

describe("DrizzleOrderTimingRepository.listForReport", () => {
  const repo = new DrizzleOrderTimingRepository();
  const stops = new DrizzleTrailerStopRepository();
  const tag = `order-timing-test-${Date.now()}`;
  // Fechas lejanas para que ningún pedido real caiga en el rango del test.
  const day = (d: number, h = 0) => new Date(Date.UTC(2001, 0, d, h));
  const productIds: Record<"coffee" | "sin" | "virtue", string> = { coffee: "", sin: "", virtue: "" };
  const orderIds: string[] = [];
  let stopA: string;
  let stopB: string;

  async function insertOrder(values: {
    createdAt: Date;
    stopId: string | null;
    fulfillmentStatus?: "pending" | "received" | "cancelled";
    items: { productId: string; quantity: number }[];
  }) {
    const [o] = await db
      .insert(ordersTable)
      .values({
        customerName: "Timing Test",
        customerEmail: `${tag}@example.com`,
        customerPhone: "+61400000000",
        fulfillmentType: "pickup",
        subtotalCents: 1000,
        totalCents: 1000,
        channel: "whatsapp",
        stopId: values.stopId,
        fulfillmentStatus: values.fulfillmentStatus ?? "received",
        createdAt: values.createdAt,
      })
      .returning({ id: ordersTable.id });
    orderIds.push(o.id);
    if (values.items.length) {
      await db
        .insert(orderItemsTable)
        .values(values.items.map((i) => ({ orderId: o.id, ...i, unitPriceCents: 500 })));
    }
    return o.id;
  }

  beforeAll(async () => {
    for (const category of ["coffee", "sin", "virtue"] as const) {
      const [p] = await db
        .insert(productsTable)
        .values({
          slug: `${tag}-${category}`,
          category,
          nameEn: `Timing ${category}`,
          nameEs: `Tiempos ${category}`,
          descriptionEn: "Test",
          descriptionEs: "Prueba",
          priceCents: 500,
        })
        .returning({ id: productsTable.id });
      productIds[category] = p.id;
    }
    const stopInput = {
      location: `${tag} stop`,
      lat: -34.9,
      lng: 138.6,
      startTime: day(1),
      endTime: day(1, 5),
      status: "completed" as const,
    };
    stopA = (await stops.create(stopInput)).id;
    stopB = (await stops.create(stopInput)).id;
  }, 15000);

  afterAll(async () => {
    if (orderIds.length) {
      await db.delete(orderStatusEventsTable).where(inArray(orderStatusEventsTable.orderId, orderIds));
      await db.delete(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds));
      await db.delete(ordersTable).where(inArray(ordersTable.id, orderIds));
    }
    for (const id of [stopA, stopB]) if (id) await stops.deleteWithStock(id);
    const ids = Object.values(productIds).filter(Boolean);
    if (ids.length) await db.delete(productsTable).where(inArray(productsTable.id, ids));
  }, 15000);

  it("cuenta café y dulces de un pedido mixto, adjunta los eventos ordenados y respeta rango y parada", async () => {
    const mixed = await insertOrder({
      createdAt: day(2, 10),
      stopId: stopA,
      items: [
        { productId: productIds.coffee, quantity: 2 },
        { productId: productIds.sin, quantity: 3 },
        { productId: productIds.virtue, quantity: 1 },
      ],
    });
    const cancelled = await insertOrder({
      createdAt: day(2, 11),
      stopId: stopB,
      fulfillmentStatus: "cancelled",
      items: [{ productId: productIds.coffee, quantity: 1 }],
    });
    const outOfRange = await insertOrder({ createdAt: day(5), stopId: stopA, items: [] });

    await db.insert(orderStatusEventsTable).values([
      { orderId: mixed, kind: "fulfillment", fromStatus: "received", toStatus: "in_prep", occurredAt: day(2, 12), source: "mobile" },
      { orderId: mixed, kind: "payment", fromStatus: "pending", toStatus: "paid", occurredAt: day(2, 11), source: "webhook" },
    ]);

    const rows = await repo.listForReport({ from: day(2), to: day(3) });
    expect(rows.map((r) => r.orderId)).toEqual([mixed, cancelled]);
    expect(rows.map((r) => r.orderId)).not.toContain(outOfRange);

    expect(rows[0]).toMatchObject({
      stopId: stopA,
      fulfillmentType: "pickup",
      channel: "whatsapp",
      totalCents: 1000,
      units: 6,
      coffeeUnits: 2,
      sweetUnits: 4,
      cancelled: false,
    });
    expect(rows[0].createdAt.toISOString()).toBe(day(2, 10).toISOString());
    expect(rows[0].events).toEqual([
      { kind: "payment", fromStatus: "pending", toStatus: "paid", occurredAt: day(2, 11), actorUserId: null },
      { kind: "fulfillment", fromStatus: "received", toStatus: "in_prep", occurredAt: day(2, 12), actorUserId: null },
    ]);
    expect(rows[1]).toMatchObject({ units: 1, coffeeUnits: 1, sweetUnits: 0, cancelled: true, events: [] });

    const onlyB = await repo.listForReport({ from: day(2), to: day(3), stopId: stopB });
    expect(onlyB.map((r) => r.orderId)).toEqual([cancelled]);

    expect(await repo.listForReport({ from: day(4), to: day(4, 23) })).toEqual([]);
  }, 15000);
});
