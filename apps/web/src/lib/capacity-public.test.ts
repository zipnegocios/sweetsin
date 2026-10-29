import { describe, it, expect } from "vitest";
import {
  EMPTY_PUBLIC_CAPACITY,
  deliveryBlockers,
  requiredLeadMinutes,
  earliestScheduleAt,
  capacityReasonMessage,
  leadParts,
  minScheduleAt,
  maxScheduleAt,
  LEAD_TIME_MARGIN_MINUTES,
  MAX_SCHEDULE_DAYS,
  type PublicCapacityData,
} from "./capacity-public";

const rule = (productId: string, over: Partial<PublicCapacityData["rules"][number]> = {}) => ({
  productId,
  soldOnline: true,
  deliveryMaxQty: null,
  leadTimeMinutes: null,
  ...over,
});
const data = (rules: PublicCapacityData["rules"]): PublicCapacityData => ({ rules });

describe("deliveryBlockers", () => {
  it("con reglas vacías (motor apagado) no bloquea nada", () => {
    expect(deliveryBlockers(EMPTY_PUBLIC_CAPACITY, [{ productId: "a", quantity: 99 }])).toEqual([]);
  });
  it("marca productos solo-trailer y los que superan el tope", () => {
    const d = data([rule("a", { soldOnline: false }), rule("b", { deliveryMaxQty: 3 }), rule("c", { deliveryMaxQty: 3 })]);
    expect(
      deliveryBlockers(d, [
        { productId: "a", quantity: 1 },
        { productId: "b", quantity: 4 },
        { productId: "c", quantity: 3 },
        { productId: "z", quantity: 1 },
      ]),
    ).toEqual([
      { code: "not_sold_online", productId: "a" },
      { code: "over_delivery_cap", productId: "b", allowedQty: 3 },
    ]);
  });
});

describe("requiredLeadMinutes / earliestScheduleAt", () => {
  it("es el mayor tiempo de antelación entre los productos del carrito", () => {
    const d = data([rule("a", { leadTimeMinutes: 60 }), rule("b", { leadTimeMinutes: 240 }), rule("c", { leadTimeMinutes: 999 })]);
    expect(requiredLeadMinutes(d, [{ productId: "a", quantity: 1 }, { productId: "b", quantity: 1 }])).toBe(240);
  });
  it("es 0 sin antelación (no se exige hora)", () => {
    expect(requiredLeadMinutes(data([rule("a")]), [{ productId: "a", quantity: 1 }])).toBe(0);
    expect(requiredLeadMinutes(EMPTY_PUBLIC_CAPACITY, [{ productId: "a", quantity: 1 }])).toBe(0);
  });
  it("la hora mínima es ahora + antelación", () => {
    const now = new Date("2026-11-01T00:00:00.000Z");
    expect(earliestScheduleAt(now, 90).toISOString()).toBe("2026-11-01T01:30:00.000Z");
  });
});

describe("capacityReasonMessage", () => {
  const fmt = (iso: string) => `<${iso}>`;
  it("mapea cada razón a clave y valores", () => {
    expect(capacityReasonMessage({ code: "not_sold_online", productName: "Gula" }, fmt)).toEqual({
      key: "capacity_not_sold_online",
      values: { product: "Gula" },
    });
    expect(capacityReasonMessage({ code: "over_delivery_cap", productName: "Gula", allowedQty: 2 }, fmt)).toEqual({
      key: "capacity_over_delivery_cap",
      values: { product: "Gula", allowed: 2 },
    });
    expect(capacityReasonMessage({ code: "lead_time", productName: "Gula", earliestAt: "2026-11-01T01:00:00.000Z" }, fmt)).toEqual({
      key: "capacity_lead_time",
      values: { product: "Gula", earliest: "<2026-11-01T01:00:00.000Z>" },
    });
    expect(capacityReasonMessage({ code: "over_vehicle_trips", maxTrips: 1, neededTrips: 3 }, fmt)).toEqual({
      key: "capacity_over_vehicle_trips",
      values: { max: 1, needed: 3 },
    });
    expect(capacityReasonMessage({ code: "scheduled_for_invalid" }, fmt)).toEqual({
      key: "capacity_scheduled_for_invalid",
      values: {},
    });
  });
});

describe("leadParts", () => {
  it("usa horas solo cuando son exactas", () => {
    expect(leadParts(120)).toEqual({ key: "leadHours", count: 2 });
    expect(leadParts(90)).toEqual({ key: "leadMinutes", count: 90 });
    expect(leadParts(45)).toEqual({ key: "leadMinutes", count: 45 });
  });
});

describe("límites de hora pedida", () => {
  const now = new Date("2026-11-01T00:00:00.000Z");
  it("el mínimo descuenta el margen del servidor y el máximo son 60 días", () => {
    expect(minScheduleAt(now, 60).getTime()).toBe(now.getTime() + (60 - LEAD_TIME_MARGIN_MINUTES) * 60_000);
    expect(maxScheduleAt(now).getTime()).toBe(now.getTime() + MAX_SCHEDULE_DAYS * 86_400_000);
  });
});
