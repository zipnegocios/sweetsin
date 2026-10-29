import { describe, expect, it } from "vitest";
import type { CapacitySettings, ProductCapacityRule } from "./entities";
import { evaluateDeliveryOrder } from "./evaluate";

const now = new Date("2026-10-29T10:00:00Z");
const rule = (o: Partial<ProductCapacityRule> = {}): ProductCapacityRule => ({
  productId: "p",
  soldOnline: true,
  deliveryMaxQty: null,
  leadTimeMinutes: null,
  batchUnits: null,
  batchSeconds: null,
  ...o,
});
const settings = (o: Partial<CapacitySettings> = {}): CapacitySettings => ({
  capacityEngineEnabled: true,
  workAreaUnits: null,
  vehicleCapacityUnits: null,
  tripMinutes: null,
  maxDeliveryTrips: null,
  showEstimateToCustomer: false,
  ...o,
});
const run = (
  q: number,
  r: ProductCapacityRule,
  s = settings(),
  scheduledFor: Date | null = null,
) =>
  evaluateDeliveryOrder({
    lines: [{ productId: "p", quantity: q }],
    rules: new Map([["p", r]]),
    steps: new Map(),
    settings: s,
    now,
    scheduledFor,
  });
const inMin = (m: number) => new Date(now.getTime() + m * 60_000);

describe("evaluateDeliveryOrder", () => {
  it("tope igual pasa, +1 rechaza", () => {
    expect(run(5, rule({ deliveryMaxQty: 5 })).ok).toBe(true);
    expect(run(6, rule({ deliveryMaxQty: 5 })).reasons).toEqual([
      { code: "over_delivery_cap", productId: "p", allowedQty: 5 },
    ]);
  });
  it("not_sold_online", () =>
    expect(run(1, rule({ soldOnline: false })).reasons[0].code).toBe(
      "not_sold_online",
    ));
  it("lead_time con scheduledFor cercano", () => {
    const r = run(1, rule({ leadTimeMinutes: 120 }), settings(), inMin(30));
    expect(r.reasons[0]).toMatchObject({
      code: "lead_time",
      earliestAt: inMin(120),
    });
  });
  it("lead_time sin scheduledFor", () =>
    expect(run(1, rule({ leadTimeMinutes: 120 })).reasons[0].code).toBe(
      "lead_time",
    ));
  it("scheduledFor pasado o > 60 dias", () => {
    expect(run(1, rule(), settings(), inMin(-5)).reasons[0].code).toBe(
      "scheduled_for_invalid",
    );
    expect(run(1, rule(), settings(), inMin(61 * 1440)).reasons[0].code).toBe(
      "scheduled_for_invalid",
    );
  });
  it("over_vehicle_trips", () =>
    expect(
      run(250, rule(), settings({ vehicleCapacityUnits: 100, maxDeliveryTrips: 2 }))
        .reasons[0],
    ).toEqual({ code: "over_vehicle_trips", maxTrips: 2, neededTrips: 3 }));
  it("motor apagado: ok sin razones", () =>
    expect(
      run(99, rule({ soldOnline: false }), settings({ capacityEngineEnabled: false })),
    ).toMatchObject({ ok: true, reasons: [] }));
});
