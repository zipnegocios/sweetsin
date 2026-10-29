import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { OrderTimingRepository, TimingEvent, TimingOrderRow } from "@workspace/domain/order-timing";
import { db } from "../index";
import { orderItemsTable, orderStatusEventsTable, ordersTable, productsTable } from "../schema";

export class DrizzleOrderTimingRepository implements OrderTimingRepository {
  async listForReport(filter: { from: Date; to: Date; stopId?: string }): Promise<TimingOrderRow[]> {
    const conditions = [gte(ordersTable.createdAt, filter.from), lte(ordersTable.createdAt, filter.to)];
    if (filter.stopId) conditions.push(eq(ordersTable.stopId, filter.stopId));

    const orders = await db
      .select({
        orderId: ordersTable.id,
        stopId: ordersTable.stopId,
        fulfillmentType: ordersTable.fulfillmentType,
        channel: ordersTable.channel,
        totalCents: ordersTable.totalCents,
        createdAt: ordersTable.createdAt,
        fulfillmentStatus: ordersTable.fulfillmentStatus,
        units: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)::int`,
        coffeeUnits: sql<number>`coalesce(sum(${orderItemsTable.quantity}) filter (where ${productsTable.category} = 'coffee'), 0)::int`,
        sweetUnits: sql<number>`coalesce(sum(${orderItemsTable.quantity}) filter (where ${productsTable.category} in ('sin', 'virtue')), 0)::int`,
      })
      .from(ordersTable)
      .leftJoin(orderItemsTable, eq(orderItemsTable.orderId, ordersTable.id))
      .leftJoin(productsTable, eq(productsTable.id, orderItemsTable.productId))
      .where(and(...conditions))
      .groupBy(ordersTable.id)
      .orderBy(asc(ordersTable.createdAt));
    if (orders.length === 0) return [];

    const events = await db
      .select({
        orderId: orderStatusEventsTable.orderId,
        kind: orderStatusEventsTable.kind,
        fromStatus: orderStatusEventsTable.fromStatus,
        toStatus: orderStatusEventsTable.toStatus,
        occurredAt: orderStatusEventsTable.occurredAt,
        actorUserId: orderStatusEventsTable.actorUserId,
      })
      .from(orderStatusEventsTable)
      .where(inArray(orderStatusEventsTable.orderId, orders.map((o) => o.orderId)))
      .orderBy(asc(orderStatusEventsTable.occurredAt), asc(orderStatusEventsTable.recordedAt));

    const byOrder = new Map<string, TimingEvent[]>();
    for (const { orderId, ...event } of events) {
      const list = byOrder.get(orderId) ?? [];
      list.push(event);
      byOrder.set(orderId, list);
    }

    return orders.map(({ fulfillmentStatus, ...o }) => ({
      ...o,
      cancelled: fulfillmentStatus === "cancelled",
      events: byOrder.get(o.orderId) ?? [],
    }));
  }

  /** Lineas (producto y cantidad) de los pedidos con `createdAt` en [from, to]; acotado por fecha, sin lista de ids. */
  async itemsByOrder(filter: { from: Date; to: Date }): Promise<Map<string, { productId: string; quantity: number }[]>> {
    const out = new Map<string, { productId: string; quantity: number }[]>();
    const rows = await db
      .select({ orderId: orderItemsTable.orderId, productId: orderItemsTable.productId, quantity: orderItemsTable.quantity })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
      .where(and(gte(ordersTable.createdAt, filter.from), lte(ordersTable.createdAt, filter.to)));
    for (const { orderId, ...line } of rows) out.set(orderId, [...(out.get(orderId) ?? []), line]);
    return out;
  }
}
