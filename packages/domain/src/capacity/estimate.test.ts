import { describe, expect, it } from "vitest";
import type { PrepStep, ProductCapacityRule } from "./entities";
import { estimatePreparation, estimateTransport } from "./estimate";

const rule = (o: Partial<ProductCapacityRule> = {}): ProductCapacityRule => ({
  productId: "p",
  soldOnline: true,
  deliveryMaxQty: null,
  leadTimeMinutes: null,
  batchUnits: 50,
  batchSeconds: 90,
  ...o,
});
const step = (mode: PrepStep["mode"], seconds: number): PrepStep => ({
  id: "s",
  productId: "p",
  position: 0,
  name: "x",
  seconds,
  mode,
});
const prep = (
  q: number,
  r: ProductCapacityRule | undefined,
  s: PrepStep[] = [],
  area: number | null = null,
) =>
  estimatePreparation(
    [{ productId: "p", quantity: q }],
    new Map(r ? [["p", r]] : []),
    new Map([["p", s]]),
    area,
  );

describe("estimatePreparation", () => {
  it("1000 uds, lote 50 y 90 s = 1800 s", () =>
    expect(prep(1000, rule()).seconds).toBe(1800));
  it("cantidad 1 = 1 lote", () => expect(prep(1, rule()).seconds).toBe(90));
  it("unidadesPorLote = min(area, lote)", () =>
    expect(prep(100, rule(), [], 10).seconds).toBe(900));
  it("suma pasos per_batch y per_unit", () =>
    expect(
      prep(100, rule(), [step("per_batch", 10), step("per_unit", 1)]).seconds,
    ).toBe(180 + 20 + 100));
  it("sin regla ni datos = 0 s", () =>
    expect(prep(5, undefined).perProduct[0]).toEqual({
      productId: "p",
      seconds: 0,
      hasData: false,
    }));
});

describe("estimatePreparation casos limite", () => {
  it("cantidad 0 o negativa = 0 s", () => {
    expect(prep(0, rule()).seconds).toBe(0);
    expect(prep(0, rule({ batchUnits: null }), [step("per_batch", 5)]).seconds).toBe(0);
    expect(prep(-3, rule()).seconds).toBe(0);
  });
  it("solo area nula / solo lote nulo", () => {
    expect(prep(100, rule({ batchUnits: 25 })).seconds).toBe(360);
    expect(prep(100, rule({ batchUnits: null }), [], 20).seconds).toBe(450);
  });
  it("batchSeconds nulo con pasos", () =>
    expect(prep(10, rule({ batchSeconds: null }), [step("per_unit", 2)])).toMatchObject({
      seconds: 20,
      perProduct: [{ hasData: true }],
    }));
  it("suma varios productos", () => {
    const r = estimatePreparation(
      [{ productId: "a", quantity: 50 }, { productId: "b", quantity: 100 }],
      new Map([["a", rule({ productId: "a" })], ["b", rule({ productId: "b" })]]),
      new Map(),
      null,
    );
    expect(r.seconds).toBe(90 + 180);
  });
});

describe("estimateTransport", () => {
  it("250 uds, vehiculo 100 = 3 viajes", () =>
    expect(estimateTransport(250, 100, 20)).toEqual({ trips: 3, minutes: 60 }));
  it("sin capacidad = 1 viaje de 0 min", () =>
    expect(estimateTransport(250, null, 20)).toEqual({ trips: 1, minutes: 0 }));
});
