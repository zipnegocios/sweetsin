export type StockEventType = "sale" | "waste" | "early_sellout" | "restock" | "sale_reversal";

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
  orderId?: string | null;
}

export interface StopStockSummary {
  productId: string;
  maxStock: number;
  currentStock: number;
  sold: number;
  wasted: number;
  soldOut: boolean;
}
