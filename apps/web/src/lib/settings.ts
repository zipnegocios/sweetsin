import { z } from "zod/v4";
import type { AppSettings } from "@workspace/domain/settings";
import { DrizzleSettingsRepository } from "@workspace/db/repositories";

// Actualización parcial: cada campo es opcional; un campo desconocido invalida el cuerpo.
export const settingsUpdateSchema = z.strictObject({
  deliveryFeeCents: z.number().int().min(0).optional(),
  deliveryEvidenceRequired: z.boolean().optional(),
  requireStockConfirmationOnOpen: z.boolean().optional(),
  allowMultipleActiveStops: z.boolean().optional(),
  liveStockEnabled: z.boolean().optional(),
  autoSoldOutEnabled: z.boolean().optional(),
  timingEnabled: z.boolean().optional(),
  showPerStaffBreakdown: z.boolean().optional(),
});

/** `null` si el cuerpo no es válido; si no trae campos, devuelve los Settings actuales sin escribir. */
export async function applySettingsUpdate(input: unknown): Promise<AppSettings | null> {
  const parsed = settingsUpdateSchema.safeParse(input);
  if (!parsed.success) return null;
  const repo = new DrizzleSettingsRepository();
  return Object.keys(parsed.data).length === 0 ? repo.get() : repo.update(parsed.data);
}
