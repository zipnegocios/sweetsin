import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  updates: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/require-admin", () => ({ requireAdmin: vi.fn().mockResolvedValue({ userId: "admin-1" }) }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleSettingsRepository: class {
    async get() {
      return state.settings;
    }
    async update(partial: Record<string, unknown>) {
      state.updates.push(partial);
      state.settings = { ...state.settings, ...partial };
      return state.settings;
    }
  },
}));

import { getSettingsAction, updateSettingsAction } from "./admin-settings";

beforeEach(() => {
  state.settings = { deliveryFeeCents: 500, timingEnabled: true };
  state.updates = [];
});

describe("admin-settings actions", () => {
  it("getSettingsAction devuelve los Settings", async () => {
    expect(await getSettingsAction()).toEqual({ ok: true, settings: state.settings });
  });

  it("updateSettingsAction aplica una actualización parcial", async () => {
    const result = await updateSettingsAction({ timingEnabled: false, deliveryFeeCents: 0 });
    expect(result).toEqual({ ok: true, settings: { deliveryFeeCents: 0, timingEnabled: false } });
    expect(state.updates).toEqual([{ timingEnabled: false, deliveryFeeCents: 0 }]);
  });

  it("updateSettingsAction rechaza valores inválidos sin lanzar ni escribir", async () => {
    expect(await updateSettingsAction({ deliveryFeeCents: -5 })).toEqual({ ok: false, error: "Invalid settings" });
    expect(await updateSettingsAction({ liveStockEnabled: "on" })).toEqual({ ok: false, error: "Invalid settings" });
    expect(await updateSettingsAction(null)).toEqual({ ok: false, error: "Invalid settings" });
    expect(state.updates).toEqual([]);
  });

  it("un error inesperado de la DB vuelve como generic", async () => {
    state.updates = null as unknown as Record<string, unknown>[];
    expect(await updateSettingsAction({ timingEnabled: true })).toEqual({ ok: false, error: "generic" });
  });
});
