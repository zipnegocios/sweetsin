"use server";

import { DrizzleCapacityRepository } from "@workspace/db/repositories";
import { EMPTY_PUBLIC_CAPACITY, type PublicCapacityData } from "@/lib/capacity-public";

// Lectura pública (sin sesión): solo lo que el cliente necesita ver. Nada de tiempos de
// preparación, lotes ni capacidades. Motor apagado (o lectura fallida) = sin reglas.
export async function getPublicCapacityAction(): Promise<PublicCapacityData> {
  try {
    const repo = new DrizzleCapacityRepository();
    const settings = await repo.getSettings();
    if (!settings.capacityEngineEnabled) return EMPTY_PUBLIC_CAPACITY;
    const rules = await repo.listRules();
    return {
      showEstimateToCustomer: settings.showEstimateToCustomer,
      rules: rules.map(({ productId, soldOnline, deliveryMaxQty, leadTimeMinutes }) => ({
        productId,
        soldOnline,
        deliveryMaxQty,
        leadTimeMinutes,
      })),
    };
  } catch {
    return EMPTY_PUBLIC_CAPACITY;
  }
}
