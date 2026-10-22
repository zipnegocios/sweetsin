import { describe, it, expect } from "vitest";
import { DrizzleSettingsRepository } from "./settings-repository";

describe("DrizzleSettingsRepository", () => {
  it("returns the default delivery fee when no row exists yet, then persists updates", async () => {
    const repo = new DrizzleSettingsRepository();

    const initial = await repo.get();
    expect(initial.deliveryFeeCents).toBe(500);

    const updated = await repo.update({ deliveryFeeCents: 700 });
    expect(updated.deliveryFeeCents).toBe(700);

    const reread = await repo.get();
    expect(reread.deliveryFeeCents).toBe(700);

    expect(initial.deliveryEvidenceRequired).toBe(false);
    const flagged = await repo.update({ deliveryEvidenceRequired: true });
    expect(flagged.deliveryEvidenceRequired).toBe(true);
    await repo.update({ deliveryEvidenceRequired: false });

    // Deja la fila en el valor por defecto para no afectar otros tests o el checkout real.
    await repo.update({ deliveryFeeCents: 500 });
  });
});
