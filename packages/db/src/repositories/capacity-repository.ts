import { asc, eq, max } from "drizzle-orm";
import { z } from "zod/v4";
import type {
  CapacityRepository,
  CapacitySettings,
  PrepStep,
  PrepStepInput,
  ProductCapacityRule,
} from "@workspace/domain/capacity";
import { db } from "../index";
import { productCapacityRulesTable, productPrepStepsTable } from "../schema";
import { DrizzleSettingsRepository } from "./settings-repository";

const positiveInt = z.number().int().positive();
const nullablePositiveInt = positiveInt.nullable();

const ruleSchema = z.object({
  productId: z.string(),
  soldOnline: z.boolean(),
  deliveryMaxQty: nullablePositiveInt,
  leadTimeMinutes: nullablePositiveInt,
  batchUnits: nullablePositiveInt,
  batchSeconds: nullablePositiveInt,
});

const stepSchema = z.object({
  position: positiveInt,
  name: z.string().trim().min(1),
  seconds: positiveInt,
  mode: z.enum(["per_batch", "per_unit"]),
});

const settingsPatchSchema = z.object({
  capacityEngineEnabled: z.boolean(),
  workAreaUnits: nullablePositiveInt,
  vehicleCapacityUnits: nullablePositiveInt,
  tripMinutes: nullablePositiveInt,
  maxDeliveryTrips: nullablePositiveInt,
  showEstimateToCustomer: z.boolean(),
}).partial();

function toRule(row: typeof productCapacityRulesTable.$inferSelect): ProductCapacityRule {
  const { updatedAt: _u, ...rule } = row;
  return rule;
}

function toStep(row: typeof productPrepStepsTable.$inferSelect): PrepStep {
  const { updatedAt: _u, ...step } = row;
  return step;
}

function pickSettings(s: CapacitySettings): CapacitySettings {
  return {
    capacityEngineEnabled: s.capacityEngineEnabled,
    workAreaUnits: s.workAreaUnits,
    vehicleCapacityUnits: s.vehicleCapacityUnits,
    tripMinutes: s.tripMinutes,
    maxDeliveryTrips: s.maxDeliveryTrips,
    showEstimateToCustomer: s.showEstimateToCustomer,
  };
}

export class DrizzleCapacityRepository implements CapacityRepository {
  private readonly settings = new DrizzleSettingsRepository();

  async getSettings(): Promise<CapacitySettings> {
    return pickSettings(await this.settings.get());
  }

  async saveSettings(patch: Partial<CapacitySettings>): Promise<CapacitySettings> {
    const valid = settingsPatchSchema.parse(patch);
    return pickSettings(Object.keys(valid).length === 0 ? await this.settings.get() : await this.settings.update(valid));
  }

  async listRules(): Promise<ProductCapacityRule[]> {
    return (await db.select().from(productCapacityRulesTable)).map(toRule);
  }

  async getRule(productId: string): Promise<ProductCapacityRule | null> {
    const [row] = await db.select().from(productCapacityRulesTable).where(eq(productCapacityRulesTable.productId, productId));
    return row ? toRule(row) : null;
  }

  async saveRule(rule: ProductCapacityRule): Promise<ProductCapacityRule> {
    const valid = ruleSchema.parse(rule);
    const { productId, ...values } = valid;
    const [row] = await db
      .insert(productCapacityRulesTable)
      .values(valid)
      .onConflictDoUpdate({ target: productCapacityRulesTable.productId, set: values })
      .returning();
    return toRule(row);
  }

  async listSteps(productId?: string): Promise<PrepStep[]> {
    const rows = await db
      .select()
      .from(productPrepStepsTable)
      .where(productId ? eq(productPrepStepsTable.productId, productId) : undefined)
      .orderBy(asc(productPrepStepsTable.productId), asc(productPrepStepsTable.position));
    return rows.map(toStep);
  }

  async replaceSteps(productId: string, steps: PrepStepInput[]): Promise<PrepStep[]> {
    const valid = z.array(stepSchema).parse(steps);
    return db.transaction(async (tx) => {
      await tx.delete(productPrepStepsTable).where(eq(productPrepStepsTable.productId, productId));
      if (valid.length === 0) return [];
      const rows = await tx
        .insert(productPrepStepsTable)
        .values(valid.map((s) => ({ ...s, productId })))
        .returning();
      return rows.map(toStep).sort((a, b) => a.position - b.position);
    });
  }

  async lastModifiedAt(): Promise<Date | null> {
    const [[rules], [steps]] = await Promise.all([
      db.select({ at: max(productCapacityRulesTable.updatedAt) }).from(productCapacityRulesTable),
      db.select({ at: max(productPrepStepsTable.updatedAt) }).from(productPrepStepsTable),
    ]);
    const dates = [rules?.at, steps?.at].filter((d): d is Date => d != null);
    return dates.length === 0 ? null : new Date(Math.max(...dates.map((d) => d.getTime())));
  }
}
