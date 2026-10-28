"use server";

import {
  listAllTrailerStops,
  createTrailerStop,
  completeTrailerStop,
  cancelTrailerStop,
  updateTrailerStop,
  reactivateTrailerStop,
  deleteTrailerStop,
  openTrailerStop,
  closeTrailerStop,
  getStopCloseSummary,
} from "@workspace/domain/trailer-stops";
import type { TrailerStop } from "@workspace/domain/trailer-stops";
import {
  initializeStopStock,
  restockProduct,
  reportStockWaste,
  setStopProductQuantity,
  addStopProduct,
  removeStopProduct,
  saveStopStockAsTemplate,
  isStockConflictMessage,
  restockStopProduct,
  wasteStopProduct,
} from "@workspace/domain/stock";
import type { StopStockSummary } from "@workspace/domain/stock";
import { isStopConflictMessage } from "@workspace/domain/trailer-stops";
import { isStockTemplateConflictMessage } from "@workspace/domain/stock-templates";
import {
  DrizzleTrailerStopRepository,
  DrizzleStockRepository,
  DrizzleEventBookingRepository,
  DrizzleStockTemplateRepository,
  DrizzleOrderRepository,
  DrizzleSettingsRepository,
} from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";
import { runAdminAction } from "@/lib/run-admin-action";
import { assertLiveStockEnabled } from "@/lib/live-stock";
import { LIVE_STOCK_DISABLED } from "@/lib/settings-errors";

export async function listTrailerStopsAction(): Promise<TrailerStop[]> {
  await requireAdmin();
  return listAllTrailerStops(new DrizzleTrailerStopRepository());
}

export async function checkStopOverlapAction(
  startTime: string,
  endTime: string,
): Promise<{ clientName: string; eventDate: string }[]> {
  await requireAdmin();
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const overlapping = await new DrizzleEventBookingRepository().findOverlapping(start, start, end);
  return overlapping.map((b) => ({ clientName: b.clientName, eventDate: b.eventDate.toISOString() }));
}

export interface CreateTrailerStopInput {
  location: string;
  lat: number;
  lng: number;
  startTime: string;
  endTime: string;
  products: { productId: string; maxStock: number }[];
}

export async function createTrailerStopAction(input: CreateTrailerStopInput): Promise<TrailerStop> {
  await requireAdmin();
  const stop = await createTrailerStop(new DrizzleTrailerStopRepository(), {
    location: input.location,
    lat: input.lat,
    lng: input.lng,
    startTime: new Date(input.startTime),
    endTime: new Date(input.endTime),
  });

  if (input.products.length > 0) {
    await initializeStopStock(new DrizzleStockRepository(), stop.id, input.products);
  }

  return stop;
}

export async function completeTrailerStopAction(id: string): Promise<void> {
  await requireAdmin();
  await completeTrailerStop(new DrizzleTrailerStopRepository(), id);
}

export async function cancelTrailerStopAction(id: string): Promise<void> {
  await requireAdmin();
  await cancelTrailerStop({ stops: new DrizzleTrailerStopRepository(), orders: new DrizzleOrderRepository() }, id);
}

export async function updateTrailerStopAction(
  id: string,
  input: { location: string; lat: number; lng: number; startTime: string; endTime: string },
): Promise<TrailerStop> {
  await requireAdmin();
  return updateTrailerStop(new DrizzleTrailerStopRepository(), id, {
    location: input.location,
    lat: input.lat,
    lng: input.lng,
    startTime: new Date(input.startTime),
    endTime: new Date(input.endTime),
  });
}

export async function reactivateTrailerStopAction(id: string): Promise<void> {
  await requireAdmin();
  await reactivateTrailerStop(new DrizzleTrailerStopRepository(), id);
}

export async function deleteTrailerStopAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteTrailerStop(new DrizzleTrailerStopRepository(), id);
}

export async function restockAction(stopId: string, productId: string, quantity: number): Promise<void> {
  await requireAdmin();
  await restockProduct(new DrizzleStockRepository(), stopId, productId, quantity, null);
}

export async function reportWasteAction(
  stopId: string,
  productId: string,
  quantity: number,
  reason: string | null,
): Promise<void> {
  await requireAdmin();
  await reportStockWaste(new DrizzleStockRepository(), stopId, productId, quantity, reason, null);
}

function runStock(fn: () => Promise<unknown>) {
  return runAdminAction(
    fn,
    (m) => isStockConflictMessage(m) || isStockTemplateConflictMessage(m) || isStopConflictMessage(m),
  );
}

// Una parada completada no admite cambios de stock (misma regla que updateTrailerStop).
async function assertStopEditable(stopId: string): Promise<void> {
  const stop = await new DrizzleTrailerStopRepository().findById(stopId);
  if (stop?.status === "completed") throw new Error("Completed stops cannot be edited");
}

export async function setStopProductQuantityAction(stopId: string, productId: string, quantity: number) {
  return runStock(async () => {
    await assertStopEditable(stopId);
    return setStopProductQuantity(new DrizzleStockRepository(), stopId, productId, quantity);
  });
}

export async function addStopProductAction(stopId: string, productId: string, quantity: number) {
  return runStock(async () => {
    await assertStopEditable(stopId);
    return addStopProduct(new DrizzleStockRepository(), stopId, productId, quantity);
  });
}

export async function removeStopProductAction(stopId: string, productId: string) {
  return runStock(async () => {
    await assertStopEditable(stopId);
    return removeStopProduct(new DrizzleStockRepository(), stopId, productId);
  });
}

export async function saveStopStockAsTemplateAction(stopId: string, name: string) {
  return runStock(() =>
    saveStopStockAsTemplate(new DrizzleStockRepository(), new DrizzleStockTemplateRepository(), stopId, name),
  );
}

// Abrir, cerrar y stock en vivo: los mensajes de reglas conocidas vuelven tal cual; el resto como "generic".
const isLiveStopMessage = (m: string) =>
  m === "Stop not found" || m === LIVE_STOCK_DISABLED || isStopConflictMessage(m) || isStockConflictMessage(m);

export async function openTrailerStopAction(id: string) {
  return runAdminAction(async () => {
    const { allowMultipleActiveStops } = await new DrizzleSettingsRepository().get();
    await openTrailerStop({ stops: new DrizzleTrailerStopRepository() }, id, {
      allowMultipleActive: allowMultipleActiveStops,
    });
  }, isLiveStopMessage);
}

export async function closeTrailerStopAction(id: string, options: { confirmUndelivered?: boolean } = {}) {
  return runAdminAction(
    () =>
      closeTrailerStop({ stops: new DrizzleTrailerStopRepository(), orders: new DrizzleOrderRepository() }, id, {
        confirmUndelivered: options.confirmUndelivered === true,
      }),
    isLiveStopMessage,
  );
}

export async function restockStopProductAction(stopId: string, productId: string, quantity: number) {
  return runAdminAction(async ({ userId }) => {
    await assertLiveStockEnabled();
    await restockStopProduct(
      { stops: new DrizzleTrailerStopRepository(), stock: new DrizzleStockRepository() },
      stopId,
      productId,
      quantity,
      userId,
    );
  }, isLiveStopMessage);
}

export async function wasteStopProductAction(
  stopId: string,
  productId: string,
  quantity: number,
  reason: string | null = null,
) {
  return runAdminAction(async ({ userId }) => {
    await assertLiveStockEnabled();
    await wasteStopProduct(
      { stops: new DrizzleTrailerStopRepository(), stock: new DrizzleStockRepository() },
      stopId,
      productId,
      quantity,
      reason?.trim() || null,
      userId,
    );
  }, isLiveStopMessage);
}

export type StopCloseSummary = { products: StopStockSummary[]; undeliveredOrders: number };

export async function getStopCloseSummaryAction(
  stopId: string,
): Promise<{ ok: true; summary: StopCloseSummary } | { ok: false; error: string }> {
  let summary: StopCloseSummary | undefined;
  const result = await runAdminAction(async () => {
    if (!(await new DrizzleTrailerStopRepository().findById(stopId))) throw new Error("Stop not found");
    summary = await getStopCloseSummary(
      { stock: new DrizzleStockRepository(), orders: new DrizzleOrderRepository() },
      stopId,
    );
  }, isLiveStopMessage);
  return result.ok ? { ok: true, summary: summary! } : result;
}
