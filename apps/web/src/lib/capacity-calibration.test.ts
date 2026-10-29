import { describe, it, expect } from "vitest";
import type { TimingOrderRow } from "@workspace/domain/order-timing";
import { buildCalibration } from "./capacity-calibration";

const at = (s: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, s));
const order = (id: string, prepSeconds: number, cancelled = false): TimingOrderRow => ({
  orderId: id, stopId: null, fulfillmentType: "pickup", channel: "web", totalCents: 0, units: 1,
  coffeeUnits: 0, sweetUnits: 1, createdAt: at(0), cancelled,
  events: [
    { kind: "fulfillment", fromStatus: null, toStatus: "in_prep", occurredAt: at(0), actorUserId: null },
    { kind: "fulfillment", fromStatus: "in_prep", toStatus: "ready_for_pickup", occurredAt: at(prepSeconds), actorUserId: null },
  ],
});
const rule = { productId: "p", soldOnline: true, deliveryMaxQty: null, leadTimeMinutes: null, batchUnits: null, batchSeconds: 120 };
const base = { rules: [], steps: [], workAreaUnits: null };

describe("buildCalibration", () => {
  it("sin datos: mediana null y muestra 0", () => {
    const r = buildCalibration({ ...base, rows: [], items: new Map(), rules: [rule] });
    expect(r).toEqual([{ productId: "p", configuredSeconds: 120, measuredMedianSeconds: null, sampleSize: 0, smallSample: true }]);
  });

  it("mediana de pedidos de una línea y cantidad 1; ignora multiproducto, cantidad > 1 y cancelados", () => {
    const rows = [order("a", 100), order("b", 200), order("c", 300), order("m", 9999), order("q", 9999), order("x", 9999, true)];
    const items = new Map([
      ["a", [{ productId: "p", quantity: 1 }]], ["b", [{ productId: "p", quantity: 1 }]], ["c", [{ productId: "p", quantity: 1 }]],
      ["m", [{ productId: "p", quantity: 1 }, { productId: "z", quantity: 1 }]],
      ["q", [{ productId: "p", quantity: 2 }]], ["x", [{ productId: "p", quantity: 1 }]],
    ]);
    const [r] = buildCalibration({ ...base, rows, items, rules: [rule] });
    expect(r).toMatchObject({ measuredMedianSeconds: 200, sampleSize: 3, smallSample: true });
  });

  it("10 muestras ya no es muestra pequeña", () => {
    const rows = Array.from({ length: 10 }, (_, i) => order(`o${i}`, 60));
    const items = new Map(rows.map((r) => [r.orderId, [{ productId: "p", quantity: 1 }]]));
    expect(buildCalibration({ ...base, rows, items })[0]).toMatchObject({ configuredSeconds: null, sampleSize: 10, smallSample: false });
  });
});
