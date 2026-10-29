import { z } from "zod/v4";
import {
  DrizzleProductRepository,
  DrizzleStockRepository,
  DrizzleStockTemplateRepository,
  DrizzleTrailerStopRepository,
} from "@workspace/db/repositories";
import { discardJornada, openJornada } from "@workspace/domain/delivery-jornadas";
import { initializeStopStock } from "@workspace/domain/stock";
import { getStockTemplate } from "@workspace/domain/stock-templates";
import type { TrailerStop } from "@workspace/domain/trailer-stops";
import { isUuid } from "@/app/api/admin/_lib/domain-error-response";

// Abrir: nombre opcional y stock inicial explícito o copiado de una plantilla (no ambos).
export const openJornadaBodySchema = z
  .strictObject({
    name: z.string().trim().max(120).optional(),
    products: z.array(z.strictObject({ productId: z.string().uuid(), maxStock: z.number().int().min(1).max(100_000) })).default([]),
    templateId: z.string().uuid().optional(),
  })
  .refine((b) => !(b.templateId && b.products.length > 0), "Use products or templateId, not both")
  .refine((b) => new Set(b.products.map((p) => p.productId)).size === b.products.length, "Duplicate product");

export type OpenJornadaBody = z.input<typeof openJornadaBodySchema>;

/** La parada solo si existe y es una jornada (`kind: "delivery"`); una parada del trailer cuenta como inexistente. */
export async function findJornada(id: string): Promise<TrailerStop | null> {
  if (!isUuid(id)) return null;
  const stop = await new DrizzleTrailerStopRepository().findById(id);
  return stop?.kind === "delivery" ? stop : null;
}

/**
 * Valida plantilla y productos antes de abrir (abrir y cargar stock no son una transacción:
 * así un dato inexistente no deja una jornada abierta a medio cargar), abre y carga el stock.
 */
export async function openJornadaWithStock(body: z.output<typeof openJornadaBodySchema>): Promise<TrailerStop> {
  const items = body.templateId
    ? (await getStockTemplate(new DrizzleStockTemplateRepository(), body.templateId)).items.map((i) => ({
        productId: i.productId,
        maxStock: i.quantity,
      }))
    : body.products;
  const products = new DrizzleProductRepository();
  for (const item of items) {
    if (!(await products.findById(item.productId))) throw new Error("Product not found");
  }
  const stops = new DrizzleTrailerStopRepository();
  const jornada = await openJornada({ stops }, { name: body.name }, new Date());
  try {
    if (items.length > 0) await initializeStopStock(new DrizzleStockRepository(), jornada.id, items);
  } catch (error) {
    // Compensación: una jornada abierta con stock a medias bloquearía abrir otra; se descarta y se relanza.
    await discardJornada({ stops }, jornada.id).catch((e) => console.error(e));
    throw error;
  }
  return jornada;
}
