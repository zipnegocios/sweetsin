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
  // listAll (no listVisible): una parada activa sigue abierta aunque haya pasado su hora de fin.
  const [settings, all] = await Promise.all([
    new DrizzleSettingsRepository().get(),
    new DrizzleTrailerStopRepository().listAll(),
  ]);
  const stops = await Promise.all(
    eligiblePickupStops(all, new Date()).map(async (stop) => ({
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
