import { and, eq, sql } from "drizzle-orm";
import type { StockEvent, StockRepository, StopProductStock } from "@workspace/domain/stock";
import { db } from "../index";
import { stockEventsTable, stopProductStockTable } from "../schema";

export class DrizzleStockRepository implements StockRepository {
  async findByStopAndProduct(stopId: string, productId: string): Promise<StopProductStock | null> {
    const [row] = await db
      .select()
      .from(stopProductStockTable)
      .where(and(eq(stopProductStockTable.stopId, stopId), eq(stopProductStockTable.productId, productId)));
    return row ?? null;
  }

  async decrementStock(stopProductStockId: string, quantity: number): Promise<StopProductStock> {
    const [updated] = await db
      .update(stopProductStockTable)
      .set({ currentStock: sql`${stopProductStockTable.currentStock} - ${quantity}` })
      .where(eq(stopProductStockTable.id, stopProductStockId))
      .returning();
    return updated;
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
      .select({ total: sql<number>`coalesce(sum(${stockEventsTable.quantity}), 0)::int` })
      .from(stockEventsTable)
      .where(and(eq(stockEventsTable.stopProductStockId, stopProductStockId), eq(stockEventsTable.eventType, "sale")));
    return row.total;
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
