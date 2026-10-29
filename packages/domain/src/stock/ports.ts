import type { StopProductStock, StockEvent, StopStockSummary } from "./entities";

export interface StockRepository {
  findByStopAndProduct(stopId: string, productId: string): Promise<StopProductStock | null>;
  incrementStock(stopProductStockId: string, quantity: number): Promise<StopProductStock>;
  recordEvent(event: Omit<StockEvent, "id">): Promise<StockEvent>;
  create(stock: Omit<StopProductStock, "id">): Promise<StopProductStock>;
  listByStop(stopId: string): Promise<StopProductStock[]>;
  /** Unidades vendidas netas: suma de 'sale' menos suma de 'sale_reversal' de la fila. */
  sumSold(stopProductStockId: string): Promise<number>;
  /**
   * Una transacción: descuenta cada línea solo si alcanza el stock (UPDATE con guarda).
   * Si alguna línea no alcanza o no tiene fila, revierte todo y devuelve ese productId.
   * Registra 'sale' por línea con orderId y 'early_sellout' cuando la fila llega a 0.
   */
  decrementForOrder(
    stopId: string,
    orderId: string,
    lines: { productId: string; quantity: number }[],
  ): Promise<{ ok: true } | { ok: false; productId: string }>;
  /**
   * Una transacción: descuenta la merma solo si alcanza el stock (UPDATE con guarda) y registra
   * el evento 'waste'. Devuelve null, sin registrar nada, si la fila no existe o no alcanza.
   */
  recordWaste(
    stopProductStockId: string,
    quantity: number,
    reason: string | null,
    reportedByUserId: string | null,
  ): Promise<StopProductStock | null>;
  /** Devuelve al stock las ventas del pedido aún no revertidas y registra 'sale_reversal'. Idempotente. */
  reverseOrderSale(orderId: string): Promise<void>;
  summarizeByStop(stopId: string): Promise<StopStockSummary[]>;
  hasMovements(stopProductStockId: string): Promise<boolean>;
  /** Atomico y relativo: ajusta currentStock por el delta de maxStock; null si quedaria negativo o no existe. */
  setQuantity(stopProductStockId: string, maxStock: number): Promise<StopProductStock | null>;
  remove(stopProductStockId: string): Promise<void>;
}
