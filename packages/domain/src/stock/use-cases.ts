import type { StockRepository } from "./ports";
import type { StockEventType } from "./entities";

async function decrementWithEvent(
  repo: StockRepository,
  stopId: string,
  productId: string,
  quantity: number,
  eventType: StockEventType,
  reason: string | null,
  reportedByUserId: string | null,
): Promise<void> {
  const stock = await repo.findByStopAndProduct(stopId, productId);
  if (!stock) throw new Error(`No stock record for product ${productId} at stop ${stopId}`);
  if (stock.currentStock < quantity) {
    throw new Error(`Insufficient stock for product ${productId} at stop ${stopId}`);
  }

  await repo.decrementStock(stock.id, quantity);
  await repo.recordEvent({
    stopProductStockId: stock.id,
    eventType,
    quantity,
    reason,
    reportedByUserId,
  });
}

export function decrementStockOnSale(
  repo: StockRepository,
  stopId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  return decrementWithEvent(repo, stopId, productId, quantity, "sale", null, null);
}

export function reportStockWaste(
  repo: StockRepository,
  stopId: string,
  productId: string,
  quantity: number,
  reason: string | null,
  reportedByUserId: string | null,
): Promise<void> {
  return decrementWithEvent(repo, stopId, productId, quantity, "waste", reason, reportedByUserId);
}

export async function initializeStopStock(
  repo: StockRepository,
  stopId: string,
  items: { productId: string; maxStock: number }[],
): Promise<import("./entities").StopProductStock[]> {
  const created = [];
  for (const item of items) {
    created.push(await repo.create({ stopId, productId: item.productId, maxStock: item.maxStock, currentStock: item.maxStock }));
  }
  return created;
}

export async function restockProduct(
  repo: StockRepository,
  stopId: string,
  productId: string,
  quantity: number,
  reportedByUserId: string | null,
): Promise<void> {
  const stock = await repo.findByStopAndProduct(stopId, productId);
  if (!stock) throw new Error(`No stock record for product ${productId} at stop ${stopId}`);

  await repo.incrementStock(stock.id, quantity);
  await repo.recordEvent({
    stopProductStockId: stock.id,
    eventType: "restock",
    quantity,
    reason: null,
    reportedByUserId,
  });
}
