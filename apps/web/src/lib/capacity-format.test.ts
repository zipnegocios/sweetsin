import { describe, it, expect } from "vitest";
import { secondsParts, reasonMessage, parseOptionalInt, calibrationState } from "./capacity-format";

describe("secondsParts", () => {
  it("separa minutos y segundos enteros", () => {
    expect(secondsParts(0)).toEqual({ m: 0, s: 0 });
    expect(secondsParts(59.6)).toEqual({ m: 1, s: 0 });
    expect(secondsParts(125)).toEqual({ m: 2, s: 5 });
  });
});

describe("reasonMessage", () => {
  const ctx = { productName: (id: string) => `P-${id}`, formatAt: () => "AT" };
  it("mapea cada código a su clave i18n con valores", () => {
    expect(reasonMessage({ code: "not_sold_online", productId: "1" }, ctx)).toEqual({ key: "capReason_not_sold_online", values: { product: "P-1" } });
    expect(reasonMessage({ code: "over_delivery_cap", productId: "1", allowedQty: 3 }, ctx)).toEqual({ key: "capReason_over_delivery_cap", values: { product: "P-1", allowed: 3 } });
    expect(reasonMessage({ code: "lead_time", productId: "1", earliestAt: new Date(0) }, ctx)).toEqual({ key: "capReason_lead_time", values: { product: "P-1", earliest: "AT" } });
    expect(reasonMessage({ code: "over_vehicle_trips", maxTrips: 2, neededTrips: 3 }, ctx)).toEqual({ key: "capReason_over_vehicle_trips", values: { max: 2, needed: 3 } });
    expect(reasonMessage({ code: "scheduled_for_invalid" }, ctx)).toEqual({ key: "capReason_scheduled_for_invalid", values: {} });
  });
});

describe("parseOptionalInt", () => {
  it("vacío = null (sin límite), entero positivo = número, otro = undefined", () => {
    expect(parseOptionalInt("")).toBeNull();
    expect(parseOptionalInt("  ")).toBeNull();
    expect(parseOptionalInt("12")).toBe(12);
    expect(parseOptionalInt("0")).toBeUndefined();
    expect(parseOptionalInt("1.5")).toBeUndefined();
    expect(parseOptionalInt("abc")).toBeUndefined();
  });
});

describe("calibrationState", () => {
  const row = { productId: "p", configuredSeconds: 60, measuredMedianSeconds: 70, sampleSize: 12, smallSample: false };
  it("clasifica", () => {
    expect(calibrationState({ ...row, measuredMedianSeconds: null, sampleSize: 0, smallSample: true })).toBe("noData");
    expect(calibrationState({ ...row, sampleSize: 3, smallSample: true })).toBe("small");
    expect(calibrationState(row)).toBe("ok");
  });
});
