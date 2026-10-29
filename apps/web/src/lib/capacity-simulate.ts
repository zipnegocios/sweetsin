import { evaluateDeliveryOrder, type DeliveryEvaluation, type PrepStep } from "@workspace/domain/capacity";
import { DrizzleCapacityRepository } from "@workspace/db/repositories";
import { simulateBodySchema } from "@/app/api/admin/_lib/capacity-body";

/** Evalúa un pedido hipotético con las reglas actuales. Solo lee; no escribe nada. Devuelve null si el cuerpo es inválido. */
export async function simulateCapacity(input: unknown, now = new Date()): Promise<DeliveryEvaluation | null> {
  const parsed = simulateBodySchema.safeParse(input);
  if (!parsed.success) return null;
  const repo = new DrizzleCapacityRepository();
  const [rules, steps, settings] = await Promise.all([repo.listRules(), repo.listSteps(), repo.getSettings()]);
  const stepMap = new Map<string, PrepStep[]>();
  for (const s of steps) stepMap.set(s.productId, [...(stepMap.get(s.productId) ?? []), s]);
  return evaluateDeliveryOrder({
    lines: parsed.data.lines,
    rules: new Map(rules.map((r) => [r.productId, r])),
    steps: stepMap,
    settings,
    now,
    scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null,
  });
}
