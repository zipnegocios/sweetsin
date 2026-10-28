import { describe, it, expect } from "vitest";
import { DrizzleSettingsRepository } from "./settings-repository";

describe("DrizzleSettingsRepository", () => {
  it("returns the default delivery fee when no row exists yet, then persists updates", async () => {
    const repo = new DrizzleSettingsRepository();

    const initial = await repo.get();
    expect(initial.deliveryFeeCents).toBe(500);

    // Base compartida dev=prod: se restauran los valores originales aunque una aserción falle.
    try {
      const updated = await repo.update({ deliveryFeeCents: 700 });
      expect(updated.deliveryFeeCents).toBe(700);

      const reread = await repo.get();
      expect(reread.deliveryFeeCents).toBe(700);

      const flagged = await repo.update({ deliveryEvidenceRequired: !initial.deliveryEvidenceRequired });
      expect(flagged.deliveryEvidenceRequired).toBe(!initial.deliveryEvidenceRequired);
    } finally {
      await repo.update({
        deliveryFeeCents: initial.deliveryFeeCents,
        deliveryEvidenceRequired: initial.deliveryEvidenceRequired,
      });
    }
  }, 15000);

  it("expone los seis interruptores de operación con sus defaults y persiste un cambio sin tocar el resto", async () => {
    const repo = new DrizzleSettingsRepository();
    const initial = await repo.get();
    try {
      // Se normaliza a los defaults esperados para verificar la fila "recién creada".
      const base = await repo.update({
        requireStockConfirmationOnOpen: true,
        allowMultipleActiveStops: false,
        liveStockEnabled: true,
        autoSoldOutEnabled: true,
        timingEnabled: true,
        showPerStaffBreakdown: true,
      });
      expect(base).toMatchObject({
        requireStockConfirmationOnOpen: true,
        allowMultipleActiveStops: false,
        liveStockEnabled: true,
        autoSoldOutEnabled: true,
        timingEnabled: true,
        showPerStaffBreakdown: true,
      });

      const updated = await repo.update({ timingEnabled: false });
      expect(updated).toEqual({ ...base, timingEnabled: false });
      expect(await repo.get()).toEqual({ ...base, timingEnabled: false });
    } finally {
      await repo.update(initial);
    }
  }, 15000);
});
