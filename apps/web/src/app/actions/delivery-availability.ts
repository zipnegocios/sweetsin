"use server";

import { findDeliveryStop } from "@workspace/domain/delivery-jornadas";
import {
  DrizzleSettingsRepository,
  DrizzleStockRepository,
  DrizzleTrailerStopRepository,
} from "@workspace/db/repositories";
import { EMPTY_DELIVERY_AVAILABILITY, type DeliveryAvailability } from "@/lib/cart-availability";

// Lectura pública (sin sesión): solo ids de producto y cantidades de la jornada (o parada) de la que
// descontaría una entrega. Interruptor apagado (o lectura fallida) = vacío, el checkout queda como antes.
export async function getDeliveryAvailability(): Promise<DeliveryAvailability> {
  try {
    const settings = await new DrizzleSettingsRepository().get();
    if (!settings.deliveryStockControlEnabled) return EMPTY_DELIVERY_AVAILABILITY;
    const stop = await findDeliveryStop(new DrizzleTrailerStopRepository(), settings.deliveryStockMode);
    if (!stop) return { enabled: true, open: false, stock: {} };
    const rows = await new DrizzleStockRepository().listByStop(stop.id);
    return { enabled: true, open: true, stock: Object.fromEntries(rows.map((r) => [r.productId, r.currentStock])) };
  } catch (error) {
    console.error("getDeliveryAvailability failed", error);
    return EMPTY_DELIVERY_AVAILABILITY;
  }
}
