import type { StopProductStock, StockEvent } from "./entities";

export interface StockRepository {
  findByStopAndProduct(stopId: string, productId: string): Promise<StopProductStock | null>;
  decrementStock(stopProductStockId: string, quantity: number): Promise<StopProductStock>;
  incrementStock(stopProductStockId: string, quantity: number): Promise<StopProductStock>;
  recordEvent(event: Omit<StockEvent, "id">): Promise<StockEvent>;
  create(stock: Omit<StopProductStock, "id">): Promise<StopProductStock>;
  listByStop(stopId: string): Promise<StopProductStock[]>;
}
