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
}
