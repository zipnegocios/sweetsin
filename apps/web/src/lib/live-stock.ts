import { DrizzleSettingsRepository } from "@workspace/db/repositories";
import { LIVE_STOCK_DISABLED } from "./settings-errors";

// Interruptor `liveStockEnabled` de Settings: apagado, no se registra reposición ni merma.
export async function assertLiveStockEnabled(): Promise<void> {
  const { liveStockEnabled } = await new DrizzleSettingsRepository().get();
  if (!liveStockEnabled) throw new Error(LIVE_STOCK_DISABLED);
}
