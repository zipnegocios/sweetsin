export type StockEventType = "sale" | "waste" | "early_sellout" | "restock";

export interface StopProductStock {
  id: string;
  stopId: string;
  productId: string;
  maxStock: number;
  currentStock: number;
}

export interface StockEvent {
  id: string;
  stopProductStockId: string;
  eventType: StockEventType;
  quantity: number;
  reason: string | null;
  reportedByUserId: string | null;
}
