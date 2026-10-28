import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type {
  StockTemplate,
  StockTemplateItem,
  StockTemplateRepository,
  StockTemplateWithItems,
} from "@workspace/domain/stock-templates";
import { db } from "../index";
import { stockTemplateItemsTable, stockTemplatesTable } from "../schema";

async function withItems(templates: StockTemplate[]): Promise<StockTemplateWithItems[]> {
  if (templates.length === 0) return [];
  const rows = await db
    .select()
    .from(stockTemplateItemsTable)
    .where(inArray(stockTemplateItemsTable.templateId, templates.map((t) => t.id)));
  return templates.map((t) => ({
    ...t,
    items: rows.filter((r) => r.templateId === t.id).map(({ productId, quantity }) => ({ productId, quantity })),
  }));
}

export class DrizzleStockTemplateRepository implements StockTemplateRepository {
  async list(includeArchived: boolean): Promise<StockTemplateWithItems[]> {
    const templates = await db
      .select()
      .from(stockTemplatesTable)
      .where(includeArchived ? undefined : isNull(stockTemplatesTable.archivedAt))
      .orderBy(desc(stockTemplatesTable.createdAt));
    return withItems(templates);
  }

  async findById(id: string): Promise<StockTemplateWithItems | null> {
    const templates = await db.select().from(stockTemplatesTable).where(eq(stockTemplatesTable.id, id));
    return (await withItems(templates))[0] ?? null;
  }

  async create(name: string, items: StockTemplateItem[]): Promise<StockTemplateWithItems> {
    return db.transaction(async (tx) => {
      const [template] = await tx.insert(stockTemplatesTable).values({ name }).returning();
      if (items.length > 0) {
        await tx.insert(stockTemplateItemsTable).values(items.map((i) => ({ ...i, templateId: template.id })));
      }
      return { ...template, items };
    });
  }

  async update(id: string, name: string, items: StockTemplateItem[]): Promise<StockTemplateWithItems> {
    return db.transaction(async (tx) => {
      const [template] = await tx.update(stockTemplatesTable).set({ name }).where(eq(stockTemplatesTable.id, id)).returning();
      await tx.delete(stockTemplateItemsTable).where(eq(stockTemplateItemsTable.templateId, id));
      if (items.length > 0) {
        await tx.insert(stockTemplateItemsTable).values(items.map((i) => ({ ...i, templateId: id })));
      }
      return { ...template, items };
    });
  }

  async setArchived(id: string, archived: boolean): Promise<void> {
    await db
      .update(stockTemplatesTable)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(stockTemplatesTable.id, id));
  }

  async delete(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(stockTemplateItemsTable).where(eq(stockTemplateItemsTable.templateId, id));
      await tx.delete(stockTemplatesTable).where(eq(stockTemplatesTable.id, id));
    });
  }

  async nameExists(name: string, excludeId?: string): Promise<boolean> {
    const [row] = await db
      .select({ id: stockTemplatesTable.id })
      .from(stockTemplatesTable)
      .where(
        and(
          sql`lower(${stockTemplatesTable.name}) = lower(${name})`,
          isNull(stockTemplatesTable.archivedAt),
          excludeId ? ne(stockTemplatesTable.id, excludeId) : undefined,
        ),
      )
      .limit(1);
    return row !== undefined;
  }
}
