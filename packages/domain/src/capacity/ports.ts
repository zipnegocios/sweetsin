import type { CapacitySettings, PrepStep, PrepStepInput, ProductCapacityRule } from "./entities";

export interface CapacityRepository {
  getSettings(): Promise<CapacitySettings>;
  saveSettings(patch: Partial<CapacitySettings>): Promise<CapacitySettings>;
  listRules(): Promise<ProductCapacityRule[]>;
  getRule(productId: string): Promise<ProductCapacityRule | null>;
  /** Upsert por `productId`. */
  saveRule(rule: ProductCapacityRule): Promise<ProductCapacityRule>;
  listSteps(productId?: string): Promise<PrepStep[]>;
  /** Guarda la regla y reemplaza sus pasos en una sola transaccion. */
  saveRuleWithSteps(
    rule: ProductCapacityRule,
    steps: PrepStepInput[],
  ): Promise<{ rule: ProductCapacityRule; steps: PrepStep[] }>;
  /** Reemplazo atómico de todos los pasos del producto. */
  replaceSteps(productId: string, steps: PrepStepInput[]): Promise<PrepStep[]>;
  /** Última modificación de reglas o pasos; null si no hay ninguna. Borrar todos los pasos de un producto no la modifica. */
  lastModifiedAt(): Promise<Date | null>;
}
