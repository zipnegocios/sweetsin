"use server";

import type { DeliveryEvaluation } from "@workspace/domain/capacity";
import { DrizzleCapacityRepository } from "@workspace/db/repositories";
import { capacitySettingsSchema, productRuleBodySchema } from "@/app/api/admin/_lib/capacity-body";
import { isUuid } from "@/app/api/admin/_lib/domain-error-response";
import { simulateCapacity } from "@/lib/capacity-simulate";
import { requireAdmin } from "@/lib/require-admin";
import { runAdminAction, type AdminActionResult } from "@/lib/run-admin-action";

const INVALID = { ok: false, error: "Invalid body" } as const;
const isInvalid = (m: string) => m === INVALID.error;

export async function saveCapacitySettingsAction(input: unknown): Promise<AdminActionResult> {
  const parsed = capacitySettingsSchema.safeParse(input);
  if (!parsed.success) {
    await requireAdmin();
    return INVALID;
  }
  return runAdminAction(() => new DrizzleCapacityRepository().saveSettings(parsed.data), isInvalid);
}

export async function saveProductRuleAction(productId: string, input: unknown): Promise<AdminActionResult> {
  const parsed = productRuleBodySchema.safeParse(input);
  if (!parsed.success || !isUuid(productId)) {
    await requireAdmin();
    return INVALID;
  }
  return runAdminAction(async () => {
    await new DrizzleCapacityRepository().saveRuleWithSteps(
      { productId, ...parsed.data.rule },
      parsed.data.steps.map((s, i) => ({ ...s, position: i + 1 })),
    );
  }, isInvalid);
}

export async function simulateAction(
  input: unknown,
): Promise<{ ok: true; evaluation: DeliveryEvaluation } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    const evaluation = await simulateCapacity(input);
    return evaluation ? { ok: true, evaluation } : INVALID;
  } catch {
    return { ok: false, error: "generic" };
  }
}
