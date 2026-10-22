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
  });
});
