import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import type {
  StockEvent,
  StockEventType,
  StockRepository,
  StopProductStock,
  StopStockSummary,
} from "@workspace/domain/stock";
import { db } from "../index";
import { ordersTable, stockEventsTable, stopProductStockTable } from "../schema";

const sumOf = (type: StockEventType) =>
  sql<number>`coalesce(sum(${stockEventsTable.quantity}) filter (where ${stockEventsTable.eventType} = ${type}), 0)::int`;

/** Vendido neto: ventas menos reversas. */
const netSold = sql<number>`(${sumOf("sale")} - ${sumOf("sale_reversal")})::int`;

/** Centinela para revertir la transacción de decrementForOrder. */
class InsufficientStock extends Error {
  constructor(readonly productId: string) {
    super(`Insufficient stock for product ${productId}`);
  }
}

export class DrizzleStockRepository implements StockRepository {
  async findByStopAndProduct(stopId: string, productId: string): Promise<StopProductStock | null> {
    const [row] = await db
      .select()
      .from(stopProductStockTable)
      .where(and(eq(stopProductStockTable.stopId, stopId), eq(stopProductStockTable.productId, productId)));
    return row ?? null;
  }

  async recordEvent(event: Omit<StockEvent, "id">): Promise<StockEvent> {
    const [inserted] = await db.insert(stockEventsTable).values(event).returning();
    return inserted;
  }

  async create(stock: Omit<StopProductStock, "id">): Promise<StopProductStock> {
    const [inserted] = await db.insert(stopProductStockTable).values(stock).returning();
    return inserted;
  }

  async listByStop(stopId: string): Promise<StopProductStock[]> {
    return db.select().from(stopProductStockTable).where(eq(stopProductStockTable.stopId, stopId));
  }

  async incrementStock(stopProductStockId: string, quantity: number): Promise<StopProductStock> {
    const [updated] = await db
      .update(stopProductStockTable)
      .set({ currentStock: sql`${stopProductStockTable.currentStock} + ${quantity}` })
      .where(eq(stopProductStockTable.id, stopProductStockId))
      .returning();
    return updated;
  }

  async sumSold(stopProductStockId: string): Promise<number> {
    const [row] = await db
      .select({ total: netSold })
      .from(stockEventsTable)
      .where(eq(stockEventsTable.stopProductStockId, stopProductStockId));
    return row.total;
  }

  async decrementForOrder(
    stopId: string,
    orderId: string,
    lines: { productId: string; quantity: number }[],
  ): Promise<{ ok: true } | { ok: false; productId: string }> {
    for (const { quantity } of lines) {
      if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Quantity must be a positive integer");
    }
    // Orden fijo de bloqueo: dos pedidos [A,B] y [B,A] no se esperan mutuamente (deadlock).
    const sorted = [...lines].sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0));
    try {
      await db.transaction(async (tx) => {
        // Idempotente por pedido: se bloquea la fila del pedido (dos reintentos simultáneos del
        // webhook se serializan) y, si ya tiene ventas sin revertir, no se descuenta de nuevo.
        await tx.select({ id: ordersTable.id }).from(ordersTable).where(eq(ordersTable.id, orderId)).for("update");
        const sold = await tx
          .select({ net: netSold })
          .from(stockEventsTable)
          .where(eq(stockEventsTable.orderId, orderId))
          .groupBy(stockEventsTable.stopProductStockId);
        if (sold.some((r) => r.net > 0)) return;

        for (const { productId, quantity } of sorted) {
          // UPDATE con guarda: la fila queda bloqueada hasta el commit, así que dos
          // pedidos por la última unidad se serializan y solo uno la descuenta.
          const [updated] = await tx
            .update(stopProductStockTable)
            .set({ currentStock: sql`${stopProductStockTable.currentStock} - ${quantity}` })
            .where(
              and(
                eq(stopProductStockTable.stopId, stopId),
                eq(stopProductStockTable.productId, productId),
                gte(stopProductStockTable.currentStock, quantity),
              ),
            )
            .returning();
          if (!updated) throw new InsufficientStock(productId);

          const base = { stopProductStockId: updated.id, reason: null, reportedByUserId: null };
          await tx.insert(stockEventsTable).values({ ...base, eventType: "sale", quantity, orderId });
          // Si la fila tenía stock antes de esta venta y ahora quedó en 0, es un agotamiento nuevo.
          if (updated.currentStock === 0) {
            await tx.insert(stockEventsTable).values({ ...base, eventType: "early_sellout", quantity: 0 });
          }
        }
      });
      return { ok: true };
    } catch (err) {
      if (err instanceof InsufficientStock) return { ok: false, productId: err.productId };
      throw err;
    }
  }

  async recordWaste(
    stopProductStockId: string,
    quantity: number,
    reason: string | null,
    reportedByUserId: string | null,
  ): Promise<StopProductStock | null> {
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(stopProductStockTable)
        .set({ currentStock: sql`${stopProductStockTable.currentStock} - ${quantity}` })
        .where(and(eq(stopProductStockTable.id, stopProductStockId), gte(stopProductStockTable.currentStock, quantity)))
        .returning();
      if (!updated) return null;
      await tx.insert(stockEventsTable).values({
        stopProductStockId,
        eventType: "waste",
        quantity,
        reason,
        reportedByUserId,
      });
      return updated;
    });
  }

  async reverseOrderSale(orderId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Mismo bloqueo por pedido que decrementForOrder: una reversa y un reintento del descuento no se cruzan.
      await tx.select({ id: ordersTable.id }).from(ordersTable).where(eq(ordersTable.id, orderId)).for("update");
      const rowIds = await tx
        .selectDistinct({ id: stockEventsTable.stopProductStockId })
        .from(stockEventsTable)
        .where(and(eq(stockEventsTable.orderId, orderId), eq(stockEventsTable.eventType, "sale")));
      if (rowIds.length === 0) return;

      // Bloquea las filas antes de calcular lo pendiente: dos reversas simultáneas
      // del mismo pedido se serializan y la segunda ve la primera ya registrada.
      const ids = rowIds.map((r) => r.id).sort();
      await tx
        .select({ id: stopProductStockTable.id })
        .from(stopProductStockTable)
        .where(inArray(stopProductStockTable.id, ids))
        .orderBy(asc(stopProductStockTable.id))
        .for("update");

      const pending = await tx
        .select({ id: stockEventsTable.stopProductStockId, net: netSold })
        .from(stockEventsTable)
        .where(and(eq(stockEventsTable.orderId, orderId), inArray(stockEventsTable.stopProductStockId, ids)))
        .groupBy(stockEventsTable.stopProductStockId);

      for (const { id, net } of pending) {
        if (net <= 0) continue;
        await tx
          .update(stopProductStockTable)
          .set({ currentStock: sql`${stopProductStockTable.currentStock} + ${net}` })
          .where(eq(stopProductStockTable.id, id));
        await tx.insert(stockEventsTable).values({
          stopProductStockId: id,
          eventType: "sale_reversal",
          quantity: net,
          reason: null,
          reportedByUserId: null,
          orderId,
        });
      }
    });
  }

  async summarizeByStop(stopId: string): Promise<StopStockSummary[]> {
    const rows = await db
      .select({
        productId: stopProductStockTable.productId,
        maxStock: stopProductStockTable.maxStock,
        currentStock: stopProductStockTable.currentStock,
        sold: netSold,
        wasted: sumOf("waste"),
      })
      .from(stopProductStockTable)
      .leftJoin(stockEventsTable, eq(stockEventsTable.stopProductStockId, stopProductStockTable.id))
      .where(eq(stopProductStockTable.stopId, stopId))
      .groupBy(stopProductStockTable.id);
    return rows.map((r) => ({ ...r, soldOut: r.currentStock === 0 }));
  }

  async hasMovements(stopProductStockId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: stockEventsTable.id })
      .from(stockEventsTable)
      .where(eq(stockEventsTable.stopProductStockId, stopProductStockId))
      .limit(1);
    return row !== undefined;
  }

  async setQuantity(stopProductStockId: string, maxStock: number): Promise<StopProductStock | null> {
    const delta = sql`${maxStock} - ${stopProductStockTable.maxStock}`;
    const [updated] = await db
      .update(stopProductStockTable)
      .set({ maxStock, currentStock: sql`${stopProductStockTable.currentStock} + (${delta})` })
      .where(and(eq(stopProductStockTable.id, stopProductStockId), sql`${stopProductStockTable.currentStock} + (${delta}) >= 0`))
      .returning();
    return updated ?? null;
  }

  async remove(stopProductStockId: string): Promise<void> {
    await db.delete(stopProductStockTable).where(eq(stopProductStockTable.id, stopProductStockId));
  }
}
