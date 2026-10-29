import { describe, it, expect, vi, beforeEach } from "vitest";

const PID = "11111111-1111-4111-8111-111111111111";
const state = vi.hoisted(() => ({
  session: null as { user: { role: string } } | null,
  writes: [] as string[],
  settings: { capacityEngineEnabled: true, workAreaUnits: null, vehicleCapacityUnits: null, tripMinutes: null, maxDeliveryTrips: null, showEstimateToCustomer: false },
}));

vi.mock("@/auth", () => ({ auth: async () => state.session }));
vi.mock("@workspace/db/repositories", () => ({
  DrizzleCapacityRepository: class {
    async getSettings() { return state.settings; }
    async saveSettings(p: object) { state.writes.push("settings"); return { ...state.settings, ...p }; }
    async listRules() { return [{ productId: PID, soldOnline: false, deliveryMaxQty: null, leadTimeMinutes: null, batchUnits: null, batchSeconds: null }]; }
    async listSteps() { return []; }
    async getRule() { return null; }
    async saveRuleWithSteps(r: object, s: object[]) { state.writes.push("rule+steps"); return { rule: r, steps: s }; }
    async lastModifiedAt() { return new Date("2026-01-02T03:04:05.000Z"); }
  },
  DrizzleProductRepository: class {
    async findById(id: string) { return id === PID ? { id } : null; }
  },
  DrizzleOrderTimingRepository: class {
    async listForReport() { return []; }
    async itemsByOrder() { return new Map(); }
  },
}));

import { GET as getSettings, PUT as putSettings } from "./settings/route";
import { GET as getProduct, PUT as putProduct } from "./products/[id]/route";
import { POST as simulate } from "./simulate/route";
import { GET as calibration } from "./calibration/route";

const req = (b: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(b) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const rule = { soldOnline: true, deliveryMaxQty: 5, leadTimeMinutes: null, batchUnits: null, batchSeconds: null };

beforeEach(() => {
  state.session = { user: { role: "admin" } };
  state.writes = [];
});

describe("/api/admin/capacity", () => {
  it("401 sin sesión y 403 para otro rol", async () => {
    state.session = null;
    expect((await getSettings()).status).toBe(401);
    expect((await calibration()).status).toBe(401);
    state.session = { user: { role: "delivery" } };
    expect((await putSettings(req({}))).status).toBe(403);
    expect((await simulate(req({}))).status).toBe(403);
    expect((await putProduct(req({ rule, steps: [] }), ctx(PID))).status).toBe(403);
  });

  it("GET settings y producto exponen lastModifiedAt en ISO", async () => {
    expect((await (await getSettings()).json()).lastModifiedAt).toBe("2026-01-02T03:04:05.000Z");
    expect((await (await getProduct(req(null), ctx(PID))).json()).lastModifiedAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("simulate con el motor apagado igual devuelve razones", async () => {
    state.settings = { ...state.settings, capacityEngineEnabled: false };
    const res = await simulate(req({ lines: [{ productId: PID, quantity: 1 }] }));
    expect((await res.json()).evaluation.reasons[0].code).toBe("not_sold_online");
    state.settings = { ...state.settings, capacityEngineEnabled: true };
  });

  it("settings: valores <= 0 -> 400 sin escribir; válido -> 200", async () => {
    expect((await putSettings(req({ workAreaUnits: 0 }))).status).toBe(400);
    expect((await putSettings(req({ tripMinutes: -1 }))).status).toBe(400);
    expect(state.writes).toEqual([]);
    expect((await putSettings(req({ workAreaUnits: 6, maxDeliveryTrips: null }))).status).toBe(200);
  });

  it("producto: id no UUID -> 404; valores <= 0 -> 400; válido escribe regla y pasos", async () => {
    expect((await getProduct(req(null), ctx("nope"))).status).toBe(404);
    expect((await putProduct(req({ rule, steps: [] }), ctx("nope"))).status).toBe(404);
    expect((await putProduct(req({ rule: { ...rule, deliveryMaxQty: 0 }, steps: [] }), ctx(PID))).status).toBe(400);
    expect((await putProduct(req({ rule, steps: [{ name: "a", seconds: 0, mode: "per_unit" }] }), ctx(PID))).status).toBe(400);
    expect(state.writes).toEqual([]);
    const ok = await putProduct(req({ rule, steps: [{ name: "a", seconds: 30, mode: "per_unit" }] }), ctx(PID));
    expect(ok.status).toBe(200);
    expect(state.writes).toEqual(["rule+steps"]);
  });

  it("producto: PUT con UUID de un producto inexistente -> 404 sin escribir", async () => {
    state.writes = [];
    const missing = "99999999-9999-4999-8999-999999999999";
    expect((await putProduct(req({ rule, steps: [] }), ctx(missing))).status).toBe(404);
    expect(state.writes).toEqual([]);
  });

  it("simulate: evalúa sin escribir; cantidad <= 0 -> 400", async () => {
    expect((await simulate(req({ lines: [{ productId: PID, quantity: 0 }] }))).status).toBe(400);
    expect((await simulate(req({ lines: [{ productId: PID, quantity: 10_001 }] }))).status).toBe(400);
    expect((await simulate(req({ lines: [{ productId: PID, quantity: 1 }], scheduledFor: "no" }))).status).toBe(400);
    const res = await simulate(req({ lines: [{ productId: PID, quantity: 1 }] }));
    expect(res.status).toBe(200);
    expect((await res.json()).evaluation.reasons[0].code).toBe("not_sold_online");
    expect(state.writes).toEqual([]);
  });

  it("calibración: sin datos mediana null", async () => {
    const body = await (await calibration()).json();
    expect(body.calibration).toEqual([
      { productId: PID, configuredSeconds: null, measuredMedianSeconds: null, sampleSize: 0, smallSample: true },
    ]);
  });
});
