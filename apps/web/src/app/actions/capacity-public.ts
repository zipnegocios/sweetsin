"use server";

import { listAvailableProducts } from "@workspace/domain/products";
import { DrizzleCapacityRepository, DrizzleProductRepository } from "@workspace/db/repositories";
import { EMPTY_PUBLIC_CAPACITY, type PublicCapacityData } from "@/lib/capacity-public";

// Lectura pública (sin sesión): solo lo que el cliente necesita ver. Nada de tiempos de
// preparación, lotes ni capacidades. Motor apagado (o lectura fallida) = sin reglas.
export async function getPublicCapacityAction(): Promise<PublicCapacityData> {
  try {
    const repo = new DrizzleCapacityRepository();
    const settings = await repo.getSettings();
    if (!settings.capacityEngineEnabled) return EMPTY_PUBLIC_CAPACITY;
    const [rules, available] = await Promise.all([
      repo.listRules(),
      listAvailableProducts(new DrizzleProductRepository()),
    ]);
    const availableIds = new Set(available.map((p) => p.id));
    return {
      rules: rules.filter((r) => availableIds.has(r.productId)).map(({ productId, soldOnline, deliveryMaxQty, leadTimeMinutes }) => ({
        productId,
        soldOnline,
        deliveryMaxQty,
        leadTimeMinutes,
      })),
    };
  } catch (error) {
    console.error("getPublicCapacityAction failed", error);
    return EMPTY_PUBLIC_CAPACITY;
  }
}
