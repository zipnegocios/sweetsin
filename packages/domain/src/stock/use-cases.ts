import type { StockRepository } from "./ports";

export async function decrementStockOnSale(
  repo: StockRepository,
  stopId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  const stock = await repo.findByStopAndProduct(stopId, productId);
  if (!stock) throw new Error(`No stock record for product ${productId} at stop ${stopId}`);
  if (stock.currentStock < quantity) {
    throw new Error(`Insufficient stock for product ${productId} at stop ${stopId}`);
  }

  await repo.decrementStock(stock.id, quantity);
  await repo.recordEvent({
    stopProductStockId: stock.id,
    eventType: "sale",
    quantity,
    reason: null,
    reportedByUserId: null,
  });
}
