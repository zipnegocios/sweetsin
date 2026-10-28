import type { StopProductStock, StockEvent } from "./entities";

export interface StockRepository {
  findByStopAndProduct(stopId: string, productId: string): Promise<StopProductStock | null>;
  decrementStock(stopProductStockId: string, quantity: number): Promise<StopProductStock>;
  incrementStock(stopProductStockId: string, quantity: number): Promise<StopProductStock>;
  recordEvent(event: Omit<StockEvent, "id">): Promise<StockEvent>;
  create(stock: Omit<StopProductStock, "id">): Promise<StopProductStock>;
  listByStop(stopId: string): Promise<StopProductStock[]>;
  /** Unidades vendidas: suma de los eventos 'sale' de la fila. */
  sumSold(stopProductStockId: string): Promise<number>;
  hasMovements(stopProductStockId: string): Promise<boolean>;
  /** Atomico y relativo: ajusta currentStock por el delta de maxStock; null si quedaria negativo o no existe. */
  setQuantity(stopProductStockId: string, maxStock: number): Promise<StopProductStock | null>;
  remove(stopProductStockId: string): Promise<void>;
}
