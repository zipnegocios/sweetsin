import { describe, it, expect, vi, beforeEach } from "vitest";

const PID = "11111111-1111-4111-8111-111111111111";
const state = vi.hoisted(() => ({ writes: [] as string[], fail: false }));

vi.mock("@/lib/require-admin", () => ({ requireAdmin: vi.fn().mockResolvedValue({ userId: "a" }) }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleCapacityRepository: class {
    async saveSettings() { if (state.fail) throw new Error("boom"); state.writes.push("settings"); }
    async saveRule() { state.writes.push("rule"); }
    async replaceSteps() { state.writes.push("steps"); }
    async listRules() { return []; }
    async listSteps() { return []; }
    async getSettings() { return { capacityEngineEnabled: true, workAreaUnits: null, vehicleCapacityUnits: null, tripMinutes: null, maxDeliveryTrips: null, showEstimateToCustomer: false }; }
  },
}));

import { saveCapacitySettingsAction, saveProductRuleAction, simulateAction } from "./admin-capacity";

const rule = { soldOnline: true, deliveryMaxQty: 5, leadTimeMinutes: null, batchUnits: null, batchSeconds: null };
beforeEach(() => { state.writes = []; state.fail = false; });

describe("admin-capacity actions", () => {
  it("guardan y devuelven { ok }", async () => {
    expect(await saveCapacitySettingsAction({ workAreaUnits: 4 })).toEqual({ ok: true });
    expect(await saveProductRuleAction(PID, { rule, steps: [] })).toEqual({ ok: true });
    expect(state.writes).toEqual(["settings", "rule", "steps"]);
  });

  it("rechazan valores <= 0 o id inválido sin escribir ni lanzar", async () => {
    expect(await saveCapacitySettingsAction({ workAreaUnits: 0 })).toEqual({ ok: false, error: "Invalid body" });
    expect(await saveProductRuleAction("x", { rule, steps: [] })).toEqual({ ok: false, error: "Invalid body" });
    expect(state.writes).toEqual([]);
  });

  it("un fallo del repositorio devuelve generic", async () => {
    state.fail = true;
    expect(await saveCapacitySettingsAction({ workAreaUnits: 4 })).toEqual({ ok: false, error: "generic" });
  });

  it("simulateAction devuelve la evaluación sin escribir", async () => {
    const r = await simulateAction({ lines: [{ productId: PID, quantity: 2 }] });
    expect(r).toMatchObject({ ok: true, evaluation: { ok: true } });
    expect(await simulateAction({ lines: [] })).toEqual({ ok: false, error: "Invalid body" });
    expect(state.writes).toEqual([]);
  });
});
