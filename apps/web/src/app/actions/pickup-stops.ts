"use server";

import {
  DrizzleSettingsRepository,
  DrizzleStockRepository,
  DrizzleTrailerStopRepository,
} from "@workspace/db/repositories";
import { eligiblePickupStops, type PickupStopsData } from "@/lib/pickup-stops";

// Lectura pública (sin sesión): paradas de retiro elegibles y su stock actual.
export async function getPickupStopsAction(): Promise<PickupStopsData> {
  const stockRepo = new DrizzleStockRepository();
  const [settings, visible] = await Promise.all([
    new DrizzleSettingsRepository().get(),
    new DrizzleTrailerStopRepository().listVisible(),
  ]);
  const stops = await Promise.all(
    eligiblePickupStops(visible, new Date()).map(async (stop) => ({
      stopId: stop.id,
      location: stop.location,
      startTime: stop.startTime,
      endTime: stop.endTime,
      availability: (await stockRepo.listByStop(stop.id)).map((row) => ({
        productId: row.productId,
        available: row.currentStock,
      })),
    })),
  );
  return { autoSoldOutEnabled: settings.autoSoldOutEnabled, stops };
}
