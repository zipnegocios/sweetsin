export interface StockTemplate {
  id: string;
  name: string;
  archivedAt: Date | null;
  createdAt: Date;
}

export interface StockTemplateItem {
  productId: string;
  quantity: number;
}

export type StockTemplateWithItems = StockTemplate & { items: StockTemplateItem[] };
