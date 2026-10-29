import { describe, expect, it } from "vitest";
import type { CapacitySettings, ProductCapacityRule } from "./entities";
import { evaluateDeliveryOrder, LEAD_TIME_MARGIN_MINUTES } from "./evaluate";

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
  it("dos productos: solo el que tiene tope bloquea", () => {
    const r = evaluateDeliveryOrder({
      lines: [{ productId: "a", quantity: 99 }, { productId: "b", quantity: 6 }],
      rules: new Map([
        ["a", rule({ productId: "a" })],
        ["b", rule({ productId: "b", deliveryMaxQty: 5 })],
      ]),
      steps: new Map(),
      settings: settings(),
      now,
      scheduledFor: null,
    });
    expect(r.reasons).toEqual([{ code: "over_delivery_cap", productId: "b", allowedQty: 5 }]);
  });
  it("producto sin regla: sin limite", () =>
    expect(
      evaluateDeliveryOrder({
        lines: [{ productId: "x", quantity: 99 }],
        rules: new Map(),
        steps: new Map(),
        settings: settings(),
        now,
        scheduledFor: null,
      }).ok,
    ).toBe(true));
  it("60 dias exactos pasa, +1 s rechaza", () => {
    expect(run(1, rule(), settings(), inMin(60 * 1440)).ok).toBe(true);
    expect(
      run(1, rule(), settings(), new Date(inMin(60 * 1440).getTime() + 1000)).reasons[0].code,
    ).toBe("scheduled_for_invalid");
  });
  it("lead_time informa productId", () =>
    expect(run(1, rule({ leadTimeMinutes: 60 })).reasons[0]).toMatchObject({
      productId: "p",
    }));
  it("scheduled_for_invalid tiene prioridad sobre lead_time", () =>
    expect(run(1, rule({ leadTimeMinutes: 60 }), settings(), inMin(-5)).reasons).toEqual([
      { code: "scheduled_for_invalid" },
    ]));

  it("suma líneas repetidas del mismo producto antes de comprobar el tope", () => {
    const r = evaluateDeliveryOrder({
      lines: [
        { productId: "p", quantity: 5 },
        { productId: "p", quantity: 5 },
      ],
      rules: new Map([["p", rule({ deliveryMaxQty: 5 })]]),
      steps: new Map(),
      settings: settings(),
      now,
      scheduledFor: null,
    });
    expect(r.reasons).toEqual([{ code: "over_delivery_cap", productId: "p", allowedQty: 5 }]);
  });

  it("da un margen a lead_time: justo dentro del margen pasa, fuera no", () => {
    const base = rule({ leadTimeMinutes: 120 });
    expect(run(1, base, settings(), inMin(120 - LEAD_TIME_MARGIN_MINUTES)).ok).toBe(true);
    expect(run(1, base, settings(), inMin(120 - LEAD_TIME_MARGIN_MINUTES - 1)).reasons[0]?.code).toBe("lead_time");
  });
});
