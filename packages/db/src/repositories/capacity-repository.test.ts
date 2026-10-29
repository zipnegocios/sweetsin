import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { DrizzleCapacityRepository } from "./capacity-repository";
import { db } from "../index";
import { productsTable, productCapacityRulesTable, productPrepStepsTable } from "../schema";

describe("DrizzleCapacityRepository", () => {
  const repo = new DrizzleCapacityRepository();
  let productId: string;

  beforeAll(async () => {
    const [p] = await db
      .insert(productsTable)
      .values({
        slug: `cap-test-${Date.now()}`,
        category: "sin",
        nameEn: "Capacity Test",
        nameEs: "Prueba Capacidad",
        descriptionEn: "Test",
        descriptionEs: "Prueba",
        priceCents: 1000,
      })
      .returning({ id: productsTable.id });
    productId = p.id;
  }, 15000);

  afterAll(async () => {
    await db.delete(productPrepStepsTable).where(eq(productPrepStepsTable.productId, productId));
    await db.delete(productCapacityRulesTable).where(eq(productCapacityRulesTable.productId, productId));
    await db.delete(productsTable).where(eq(productsTable.id, productId));
  });

  it("saveRule crea y luego actualiza la misma fila por productId", async () => {
    const base = { productId, soldOnline: true, deliveryMaxQty: null, leadTimeMinutes: null, batchUnits: null, batchSeconds: null };
    expect(await repo.getRule(productId)).toBeNull();
    expect(await repo.saveRule({ ...base, batchUnits: 6, batchSeconds: 600 })).toEqual({ ...base, batchUnits: 6, batchSeconds: 600 });
    const updated = await repo.saveRule({ ...base, soldOnline: false, deliveryMaxQty: 12 });
    expect(updated).toEqual({ ...base, soldOnline: false, deliveryMaxQty: 12 });
    expect((await repo.listRules()).filter((r) => r.productId === productId)).toHaveLength(1);
    const before = await repo.lastModifiedAt();
    expect(before).toBeInstanceOf(Date);
    await new Promise((r) => setTimeout(r, 20));
    await repo.saveRule({ ...base, deliveryMaxQty: 13 });
    expect((await repo.lastModifiedAt())!.getTime()).toBeGreaterThan(before!.getTime());
  }, 15000);

  it("replaceSteps reemplaza todo o nada y respeta position", async () => {
    await repo.replaceSteps(productId, [
      { position: 2, name: "Hornear", seconds: 600, mode: "per_batch" },
      { position: 1, name: "Mezclar", seconds: 60, mode: "per_unit" },
    ]);
    const first = await repo.listSteps(productId);
    expect(first.map((s) => s.name)).toEqual(["Mezclar", "Hornear"]);

    await expect(
      repo.replaceSteps(productId, [
        { position: 1, name: "Nuevo", seconds: 30, mode: "per_unit" },
        { position: 1, name: "Duplicado", seconds: 30, mode: "per_unit" },
      ]),
    ).rejects.toThrow();
    expect((await repo.listSteps(productId)).map((s) => s.name)).toEqual(["Mezclar", "Hornear"]);

    const replaced = await repo.replaceSteps(productId, [{ position: 1, name: "Solo", seconds: 5, mode: "per_unit" }]);
    expect(replaced.map((s) => s.name)).toEqual(["Solo"]);
    expect(await repo.listSteps(productId)).toHaveLength(1);
  }, 15000);

  it("getSettings devuelve capacityEngineEnabled=false por defecto y persiste un cambio", async () => {
    const initial = await repo.getSettings();
    expect(initial.capacityEngineEnabled).toBe(false);
    expect(initial.showEstimateToCustomer).toBe(false);
    try {
      const saved = await repo.saveSettings({ workAreaUnits: 40 });
      expect(saved.workAreaUnits).toBe(40);
    } finally {
      await repo.saveSettings({ workAreaUnits: initial.workAreaUnits });
    }
  }, 15000);

  it("rechaza enteros menores o iguales a cero", async () => {
    const base = { productId, soldOnline: true, deliveryMaxQty: null, leadTimeMinutes: null, batchUnits: null, batchSeconds: null };
    await expect(repo.saveRule({ ...base, deliveryMaxQty: 0 })).rejects.toThrow();
    await expect(repo.saveRule({ ...base, batchSeconds: -5 })).rejects.toThrow();
    await expect(repo.replaceSteps(productId, [{ position: 1, name: "x", seconds: 0, mode: "per_unit" }])).rejects.toThrow();
    await expect(repo.saveSettings({ tripMinutes: 0 })).rejects.toThrow();
  }, 15000);
});
