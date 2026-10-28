import type { TransitionContext } from "@workspace/domain/orders";
import { DrizzleSettingsRepository } from "@workspace/db/repositories";

// El interruptor `timingEnabled` de Settings decide si la transición deja evento (medición de tiempos).
export async function buildTransitionContext(opts: {
  actorUserId: string | null;
  source: TransitionContext["source"];
  occurredAt?: Date;
}): Promise<TransitionContext> {
  const { timingEnabled } = await new DrizzleSettingsRepository().get();
  return { ...opts, record: timingEnabled };
}
