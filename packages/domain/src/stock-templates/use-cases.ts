import type { StockTemplateItem, StockTemplateWithItems } from "./entities";
import type { StockTemplateRepository } from "./ports";

export function isStockTemplateConflictMessage(message: string): boolean {
  return [
    "Template name is required",
    "Template name already exists",
    "Quantity must be a positive integer",
    "Duplicate product in template",
  ].includes(message);
}

interface StockTemplateInput {
  name: string;
  items: StockTemplateItem[];
}

async function validate(
  repo: StockTemplateRepository,
  input: StockTemplateInput,
  excludeId?: string,
): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error("Template name is required");
  if (await repo.nameExists(name, excludeId)) throw new Error("Template name already exists");
  const seen = new Set<string>();
  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error("Quantity must be a positive integer");
    }
    if (seen.has(item.productId)) throw new Error("Duplicate product in template");
    seen.add(item.productId);
  }
  return name;
}

async function requireTemplate(repo: StockTemplateRepository, id: string): Promise<StockTemplateWithItems> {
  const template = await repo.findById(id);
  if (!template) throw new Error("Template not found");
  return template;
}

export function listStockTemplates(repo: StockTemplateRepository, includeArchived: boolean) {
  return repo.list(includeArchived);
}

export function getStockTemplate(repo: StockTemplateRepository, id: string) {
  return requireTemplate(repo, id);
}

export async function createStockTemplate(repo: StockTemplateRepository, input: StockTemplateInput) {
  const name = await validate(repo, input);
  return repo.create(name, input.items);
}

export async function updateStockTemplate(
  repo: StockTemplateRepository,
  id: string,
  input: StockTemplateInput,
) {
  await requireTemplate(repo, id);
  const name = await validate(repo, input, id);
  return repo.update(id, name, input.items);
}

export async function archiveStockTemplate(repo: StockTemplateRepository, id: string): Promise<void> {
  await requireTemplate(repo, id);
  await repo.setArchived(id, true);
}

export async function unarchiveStockTemplate(repo: StockTemplateRepository, id: string): Promise<void> {
  const template = await requireTemplate(repo, id);
  if (await repo.nameExists(template.name, id)) throw new Error("Template name already exists");
  await repo.setArchived(id, false);
}

export async function deleteStockTemplate(repo: StockTemplateRepository, id: string): Promise<void> {
  await requireTemplate(repo, id);
  await repo.delete(id);
}
