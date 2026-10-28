import type { StockTemplateItem, StockTemplateWithItems } from "./entities";

export interface StockTemplateRepository {
  list(includeArchived: boolean): Promise<StockTemplateWithItems[]>;
  findById(id: string): Promise<StockTemplateWithItems | null>;
  create(name: string, items: StockTemplateItem[]): Promise<StockTemplateWithItems>;
  update(id: string, name: string, items: StockTemplateItem[]): Promise<StockTemplateWithItems>;
  setArchived(id: string, archived: boolean): Promise<void>;
  delete(id: string): Promise<void>;
  /** Compara sin distinguir mayúsculas, solo contra plantillas no archivadas. */
  nameExists(name: string, excludeId?: string): Promise<boolean>;
}
