"use server";

import { DrizzleTrailerStopRepository } from "@workspace/db/repositories";
import { closeJornada } from "@workspace/domain/delivery-jornadas";
import { isStopConflictMessage } from "@workspace/domain/trailer-stops";
import { requireAdmin } from "@/lib/require-admin";
import { runAdminAction, type AdminActionResult } from "@/lib/run-admin-action";
import { openJornadaBodySchema, openJornadaWithStock, type OpenJornadaBody } from "@/lib/jornadas";

// Reposición y merma de una jornada usan las acciones de paradas (restockStopProductAction / wasteStopProductAction).
const isJornadaMessage = (m: string) =>
  m === "Stop not found" || m === "Template not found" || m === "Product not found" || isStopConflictMessage(m);

export async function openJornadaAction(
  input: OpenJornadaBody,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = openJornadaBodySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid body" };
  try {
    return { ok: true, id: (await openJornadaWithStock(parsed.data)).id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return { ok: false, error: isJornadaMessage(message) ? message : "generic" };
  }
}

export async function closeJornadaAction(id: string): Promise<AdminActionResult> {
  return runAdminAction(() => closeJornada({ stops: new DrizzleTrailerStopRepository() }, id), isJornadaMessage);
}
