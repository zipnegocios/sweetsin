import type { StockRepository } from "./ports";
import type { StopProductStock } from "./entities";
import { createStockTemplate } from "../stock-templates";
import type { StockTemplateRepository, StockTemplateWithItems } from "../stock-templates";
import type { TrailerStopRepository } from "../trailer-stops";

export async function initializeStopStock(
  repo: StockRepository,
  stopId: string,
  items: { productId: string; maxStock: number }[],
): Promise<import("./entities").StopProductStock[]> {
  const created = [];
  for (const item of items) {
    created.push(await repo.create({ stopId, productId: item.productId, maxStock: item.maxStock, currentStock: item.maxStock }));
  }
  return created;
}

export async function restockProduct(
  repo: StockRepository,
  stopId: string,
  productId: string,
  quantity: number,
  reportedByUserId: string | null,
): Promise<void> {
  const stock = await repo.findByStopAndProduct(stopId, productId);
  if (!stock) throw new Error(`No stock record for product ${productId} at stop ${stopId}`);

  await repo.incrementStock(stock.id, quantity);
  await repo.recordEvent({
    stopProductStockId: stock.id,
    eventType: "restock",
    quantity,
    reason: null,
    reportedByUserId,
  });
}

export function isStockConflictMessage(message: string): boolean {
  return [
    "Cannot set stock below units already sold",
    "Current stock would be negative",
    "Stock row has movements",
    "Product already has stock at this stop",
    "Stock row not found",
    "Quantity must be a positive integer",
    "Stop is not active",
    "Waste exceeds current stock",
  ].includes(message);
}

function assertPositiveInteger(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Quantity must be a positive integer");
}

async function requireRow(repo: StockRepository, stopId: string, productId: string): Promise<StopProductStock> {
  const row = await repo.findByStopAndProduct(stopId, productId);
  if (!row) throw new Error("Stock row not found");
  return row;
}

interface ActiveStopStockDeps {
  stops: TrailerStopRepository;
  stock: StockRepository;
}

async function requireActiveStopRow(
  deps: ActiveStopStockDeps,
  stopId: string,
  productId: string,
  quantity: number,
): Promise<StopProductStock> {
  assertPositiveInteger(quantity);
  const stop = await deps.stops.findById(stopId);
  if (!stop) throw new Error("Stop not found");
  if (stop.status !== "active") throw new Error("Stop is not active");
  return requireRow(deps.stock, stopId, productId);
}

export async function restockStopProduct(
  deps: ActiveStopStockDeps,
  stopId: string,
  productId: string,
  quantity: number,
  reportedByUserId: string | null,
): Promise<void> {
  await requireActiveStopRow(deps, stopId, productId, quantity);
  await restockProduct(deps.stock, stopId, productId, quantity, reportedByUserId);
}

export async function wasteStopProduct(
  deps: ActiveStopStockDeps,
  stopId: string,
  productId: string,
  quantity: number,
  reason: string | null,
  reportedByUserId: string | null,
): Promise<void> {
  const row = await requireActiveStopRow(deps, stopId, productId, quantity);
  // La guarda vive en el repositorio (UPDATE ... WHERE current_stock >= q): una venta
  // concurrente entre la lectura y la escritura no puede dejar el stock negativo.
  const updated = await deps.stock.recordWaste(row.id, quantity, reason, reportedByUserId);
  if (!updated) throw new Error("Waste exceeds current stock");
}

export async function setStopProductQuantity(
  repo: StockRepository,
  stopId: string,
  productId: string,
  quantity: number,
): Promise<StopProductStock> {
  assertPositiveInteger(quantity);
  const row = await requireRow(repo, stopId, productId);
  const sold = await repo.sumSold(row.id);
  if (quantity < sold) throw new Error("Cannot set stock below units already sold");
  const updated = await repo.setQuantity(row.id, quantity);
  if (!updated) throw new Error("Current stock would be negative");
  return updated;
}

export async function addStopProduct(
  repo: StockRepository,
  stopId: string,
  productId: string,
  quantity: number,
): Promise<StopProductStock> {
  assertPositiveInteger(quantity);
  if (await repo.findByStopAndProduct(stopId, productId)) {
    throw new Error("Product already has stock at this stop");
  }
  const [created] = await initializeStopStock(repo, stopId, [{ productId, maxStock: quantity }]);
  return created;
}

export async function removeStopProduct(repo: StockRepository, stopId: string, productId: string): Promise<void> {
  const row = await requireRow(repo, stopId, productId);
  if (await repo.hasMovements(row.id)) throw new Error("Stock row has movements");
  await repo.remove(row.id);
}

export async function saveStopStockAsTemplate(
  stock: StockRepository,
  templates: StockTemplateRepository,
  stopId: string,
  name: string,
): Promise<StockTemplateWithItems> {
  const rows = await stock.listByStop(stopId);
  return createStockTemplate(templates, {
    name,
    items: rows.map((r) => ({ productId: r.productId, quantity: r.maxStock })),
  });
}
