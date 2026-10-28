"use server";

import {
  createStockTemplate,
  updateStockTemplate,
  archiveStockTemplate,
  unarchiveStockTemplate,
  deleteStockTemplate,
  isStockTemplateConflictMessage,
} from "@workspace/domain/stock-templates";
import { DrizzleStockTemplateRepository } from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";

// Devuelven un resultado en vez de lanzar: en producción Next oculta el mensaje
// de los errores lanzados desde Server Actions.
export type StockTemplateActionResult = { ok: true } | { ok: false; error: string };

export interface StockTemplateActionInput {
  name: string;
  items: { productId: string; quantity: number }[];
}

async function run(fn: () => Promise<unknown>): Promise<StockTemplateActionResult> {
  await requireAdmin();
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return { ok: false, error: isStockTemplateConflictMessage(message) ? message : "generic" };
  }
}

export async function createStockTemplateAction(input: StockTemplateActionInput) {
  return run(() => createStockTemplate(new DrizzleStockTemplateRepository(), input));
}

export async function updateStockTemplateAction(id: string, input: StockTemplateActionInput) {
  return run(() => updateStockTemplate(new DrizzleStockTemplateRepository(), id, input));
}

export async function archiveStockTemplateAction(id: string) {
  return run(() => archiveStockTemplate(new DrizzleStockTemplateRepository(), id));
}

export async function unarchiveStockTemplateAction(id: string) {
  return run(() => unarchiveStockTemplate(new DrizzleStockTemplateRepository(), id));
}

export async function deleteStockTemplateAction(id: string) {
  return run(() => deleteStockTemplate(new DrizzleStockTemplateRepository(), id));
}
