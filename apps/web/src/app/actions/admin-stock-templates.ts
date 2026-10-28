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
import { runAdminAction, type AdminActionResult } from "@/lib/run-admin-action";

export type StockTemplateActionResult = AdminActionResult;

export interface StockTemplateActionInput {
  name: string;
  items: { productId: string; quantity: number }[];
}

function run(fn: () => Promise<unknown>) {
  return runAdminAction(fn, isStockTemplateConflictMessage);
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
