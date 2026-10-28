import { describe, expect, it } from "vitest";
import type { StockTemplateRepository } from "./ports";
import type { StockTemplateItem, StockTemplateWithItems } from "./entities";
import {
  archiveStockTemplate,
  createStockTemplate,
  deleteStockTemplate,
  isStockTemplateConflictMessage,
  unarchiveStockTemplate,
  updateStockTemplate,
} from "./use-cases";

function fakeRepo(): StockTemplateRepository & { rows: StockTemplateWithItems[] } {
  const rows: StockTemplateWithItems[] = [];
  let seq = 0;
  return {
    rows,
    async list(includeArchived) {
      return rows.filter((r) => includeArchived || !r.archivedAt);
    },
    async findById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async create(name, items) {
      const row = { id: `t${++seq}`, name, archivedAt: null, createdAt: new Date(), items };
      rows.push(row);
      return row;
    },
    async update(id, name, items) {
      const row = rows.find((r) => r.id === id)!;
      row.name = name;
      row.items = items;
      return row;
    },
    async setArchived(id, archived) {
      rows.find((r) => r.id === id)!.archivedAt = archived ? new Date() : null;
    },
    async delete(id) {
      rows.splice(rows.findIndex((r) => r.id === id), 1);
    },
    async nameExists(name, excludeId) {
      return rows.some(
        (r) => !r.archivedAt && r.id !== excludeId && r.name.toLowerCase() === name.toLowerCase(),
      );
    },
  };
}

const item = (productId: string, quantity: number): StockTemplateItem => ({ productId, quantity });

describe("stock templates", () => {
  it("crea una plantilla vacía", async () => {
    const repo = fakeRepo();
    const t = await createStockTemplate(repo, { name: "Base", items: [] });
    expect(t.name).toBe("Base");
    expect(t.items).toEqual([]);
  });

  it("recorta el nombre y rechaza uno vacío", async () => {
    const repo = fakeRepo();
    expect((await createStockTemplate(repo, { name: "  Base  ", items: [] })).name).toBe("Base");
    await expect(createStockTemplate(repo, { name: "   ", items: [] })).rejects.toThrow(
      "Template name is required",
    );
  });

  it("rechaza nombre duplicado sin distinguir mayúsculas", async () => {
    const repo = fakeRepo();
    await createStockTemplate(repo, { name: "Base", items: [] });
    await expect(createStockTemplate(repo, { name: "bAsE", items: [] })).rejects.toThrow(
      "Template name already exists",
    );
  });

  it("permite repetir el nombre de una archivada", async () => {
    const repo = fakeRepo();
    const t = await createStockTemplate(repo, { name: "Base", items: [] });
    await archiveStockTemplate(repo, t.id);
    await expect(createStockTemplate(repo, { name: "Base", items: [] })).resolves.toBeDefined();
  });

  it("rechaza cantidad 0, negativa o decimal", async () => {
    const repo = fakeRepo();
    for (const q of [0, -1, 1.5]) {
      await expect(
        createStockTemplate(repo, { name: "X", items: [item("p1", q)] }),
      ).rejects.toThrow("Quantity must be a positive integer");
    }
  });

  it("rechaza producto repetido", async () => {
    const repo = fakeRepo();
    await expect(
      createStockTemplate(repo, { name: "X", items: [item("p1", 1), item("p1", 2)] }),
    ).rejects.toThrow("Duplicate product in template");
  });

  it("update de id inexistente lanza Template not found", async () => {
    await expect(updateStockTemplate(fakeRepo(), "nope", { name: "X", items: [] })).rejects.toThrow(
      "Template not found",
    );
  });

  it("archivar y desarchivar", async () => {
    const repo = fakeRepo();
    const t = await createStockTemplate(repo, { name: "Base", items: [] });
    await archiveStockTemplate(repo, t.id);
    expect(repo.rows[0]!.archivedAt).not.toBeNull();
    await unarchiveStockTemplate(repo, t.id);
    expect(repo.rows[0]!.archivedAt).toBeNull();
  });

  it("desarchivar con nombre en uso lanza Template name already exists", async () => {
    const repo = fakeRepo();
    const a = await createStockTemplate(repo, { name: "Base", items: [] });
    await archiveStockTemplate(repo, a.id);
    await createStockTemplate(repo, { name: "Base", items: [] });
    await expect(unarchiveStockTemplate(repo, a.id)).rejects.toThrow("Template name already exists");
  });

  it("delete inexistente lanza Template not found", async () => {
    await expect(deleteStockTemplate(fakeRepo(), "nope")).rejects.toThrow("Template not found");
  });

  it("isStockTemplateConflictMessage reconoce los mensajes de negocio y no otros", () => {
    for (const m of [
      "Template name is required",
      "Template name already exists",
      "Quantity must be a positive integer",
      "Duplicate product in template",
    ]) {
      expect(isStockTemplateConflictMessage(m)).toBe(true);
    }
    expect(isStockTemplateConflictMessage("Template not found")).toBe(false);
    expect(isStockTemplateConflictMessage("boom")).toBe(false);
  });
});
