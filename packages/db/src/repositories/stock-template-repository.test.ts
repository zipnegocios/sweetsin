import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { DrizzleStockTemplateRepository } from "./stock-template-repository";
import { DrizzleProductRepository } from "./product-repository";
import { db } from "../index";
import { stockTemplatesTable, stockTemplateItemsTable } from "../schema";

describe("DrizzleStockTemplateRepository", () => {
  const repo = new DrizzleStockTemplateRepository();
  const createdIds: string[] = [];
  let productId: string;
  const uniq = () => `Test Template ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    const product = await new DrizzleProductRepository().findBySlug("gluttony");
    if (!product) throw new Error("Seed product 'gluttony' not found — run the seed first");
    productId = product.id;
  });

  afterAll(async () => {
    if (createdIds.length) {
      await db.delete(stockTemplateItemsTable).where(inArray(stockTemplateItemsTable.templateId, createdIds));
      await db.delete(stockTemplatesTable).where(inArray(stockTemplatesTable.id, createdIds));
    }
  });

  it("crea, lista y busca una plantilla con ítems", async () => {
    const name = uniq();
    const t = await repo.create(name, [{ productId, quantity: 7 }]);
    createdIds.push(t.id);
    expect(t.items).toEqual([{ productId, quantity: 7 }]);
    expect((await repo.findById(t.id))?.name).toBe(name);
    const listed = await repo.list(false);
    expect(listed.find((x) => x.id === t.id)?.items).toEqual([{ productId, quantity: 7 }]);
  }, 15000);

  it("update reemplaza los ítems", async () => {
    const t = await repo.create(uniq(), [{ productId, quantity: 1 }]);
    createdIds.push(t.id);
    const u = await repo.update(t.id, "Test Template renamed " + Date.now(), [{ productId, quantity: 9 }]);
    expect(u.items).toEqual([{ productId, quantity: 9 }]);
    expect((await repo.findById(t.id))?.items).toHaveLength(1);
  }, 15000);

  it("archivar la oculta de list(false) y la muestra en list(true)", async () => {
    const t = await repo.create(uniq(), []);
    createdIds.push(t.id);
    await repo.setArchived(t.id, true);
    expect((await repo.list(false)).some((x) => x.id === t.id)).toBe(false);
    expect((await repo.list(true)).some((x) => x.id === t.id)).toBe(true);
    await repo.setArchived(t.id, false);
    expect((await repo.list(false)).some((x) => x.id === t.id)).toBe(true);
  }, 15000);

  it("nameExists ignora mayúsculas, archivadas y el excludeId", async () => {
    const name = uniq();
    const t = await repo.create(name, []);
    createdIds.push(t.id);
    expect(await repo.nameExists(name.toUpperCase())).toBe(true);
    expect(await repo.nameExists(name, t.id)).toBe(false);
    await repo.setArchived(t.id, true);
    expect(await repo.nameExists(name)).toBe(false);
  }, 15000);

  it("delete elimina plantilla e ítems", async () => {
    const t = await repo.create(uniq(), [{ productId, quantity: 2 }]);
    createdIds.push(t.id);
    await repo.delete(t.id);
    expect(await repo.findById(t.id)).toBeNull();
    const left = await db.select().from(stockTemplateItemsTable).where(inArray(stockTemplateItemsTable.templateId, [t.id]));
    expect(left).toHaveLength(0);
  }, 15000);
});
