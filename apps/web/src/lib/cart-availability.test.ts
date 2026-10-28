import { describe, it, expect } from "vitest";
import { limitFor, stopAvailabilityFor, trimCartToAvailability } from "./cart-availability";

const stopA = [
  { productId: "p1", available: 3 },
  { productId: "p2", available: 0 },
  { productId: "p3", available: 10 },
];
const stopB = [
  { productId: "p1", available: 1 },
  { productId: "p3", available: 0 },
];

describe("limitFor", () => {
  it("sin parada elegida no hay límite", () => {
    expect(limitFor("p1", null, true)).toBe(Infinity);
  });

  it("devuelve el disponible de la parada", () => {
    expect(limitFor("p1", stopA, true)).toBe(3);
    expect(limitFor("p2", stopA, true)).toBe(0);
  });

  it("un producto sin fila en la parada no se puede pedir", () => {
    expect(limitFor("p9", stopA, true)).toBe(0);
    expect(limitFor("p9", stopA, false)).toBe(0);
  });

  it("con autoSoldOut apagado no limita productos con fila, aunque estén en 0", () => {
    expect(limitFor("p2", stopA, false)).toBe(Infinity);
  });
});

describe("stopAvailabilityFor", () => {
  it("en delivery la parada no limita ni recorta el carrito", () => {
    const availability = stopAvailabilityFor("self_delivery", stopA);
    expect(availability).toBeNull();
    const lines = [{ productId: "p2", quantity: 9 }];
    expect(trimCartToAvailability(lines, availability, true)).toEqual({ lines, changes: [] });
  });

  it("en retiro (o sin tipo elegido aún) aplica la parada", () => {
    expect(stopAvailabilityFor("pickup", stopA)).toBe(stopA);
    expect(stopAvailabilityFor(null, stopA)).toBe(stopA);
  });

  it("volver de delivery a retiro vuelve a recortar a la parada", () => {
    const lines = [{ productId: "p1", quantity: 9 }];
    expect(trimCartToAvailability(lines, stopAvailabilityFor("self_delivery", stopA), true).lines).toEqual(lines);
    expect(trimCartToAvailability(lines, stopAvailabilityFor("pickup", stopA), true).lines).toEqual([
      { productId: "p1", quantity: 3 },
    ]);
  });
});

describe("trimCartToAvailability", () => {
  it("recorta la cantidad al disponible", () => {
    const result = trimCartToAvailability([{ productId: "p1", quantity: 5 }], stopA, true);
    expect(result.lines).toEqual([{ productId: "p1", quantity: 3 }]);
    expect(result.changes).toEqual([{ productId: "p1", from: 5, to: 3 }]);
  });

  it("elimina productos sin fila en la parada", () => {
    const result = trimCartToAvailability([{ productId: "p9", quantity: 2 }], stopA, true);
    expect(result.lines).toEqual([]);
    expect(result.changes).toEqual([{ productId: "p9", from: 2, to: 0 }]);
  });

  it("elimina productos agotados (stock 0)", () => {
    const result = trimCartToAvailability(
      [
        { productId: "p2", quantity: 1 },
        { productId: "p3", quantity: 2 },
      ],
      stopA,
      true,
    );
    expect(result.lines).toEqual([{ productId: "p3", quantity: 2 }]);
    expect(result.changes).toEqual([{ productId: "p2", from: 1, to: 0 }]);
  });

  it("al cambiar de parada recorta a lo disponible en la nueva", () => {
    const cart = trimCartToAvailability(
      [
        { productId: "p1", quantity: 3 },
        { productId: "p3", quantity: 4 },
      ],
      stopA,
      true,
    ).lines;
    const result = trimCartToAvailability(cart, stopB, true);
    expect(result.lines).toEqual([{ productId: "p1", quantity: 1 }]);
    expect(result.changes).toEqual([
      { productId: "p1", from: 3, to: 1 },
      { productId: "p3", from: 4, to: 0 },
    ]);
  });

  it("un carrito que ya entra no informa cambios y conserva las líneas", () => {
    const lines = [
      { productId: "p1", quantity: 3 },
      { productId: "p3", quantity: 1 },
    ];
    const result = trimCartToAvailability(lines, stopA, true);
    expect(result.lines).toEqual(lines);
    expect(result.changes).toEqual([]);
  });

  it("sin parada elegida no toca el carrito", () => {
    const lines = [{ productId: "p9", quantity: 7 }];
    expect(trimCartToAvailability(lines, null, true)).toEqual({ lines, changes: [] });
  });

  it("quita líneas con cantidad inválida y las informa", () => {
    const result = trimCartToAvailability(
      [
        { productId: "p1", quantity: 0 },
        { productId: "p3", quantity: -2 },
        { productId: "p9", quantity: Number.NaN },
        { productId: "p4", quantity: 1.5 },
      ],
      null,
      true,
    );
    expect(result.lines).toEqual([]);
    expect(result.changes.map((c) => [c.productId, c.to])).toEqual([
      ["p1", 0],
      ["p3", 0],
      ["p9", 0],
      ["p4", 0],
    ]);
  });

  it("con autoSoldOut apagado solo elimina productos sin fila", () => {
    const result = trimCartToAvailability(
      [
        { productId: "p2", quantity: 4 },
        { productId: "p9", quantity: 1 },
      ],
      stopA,
      false,
    );
    expect(result.lines).toEqual([{ productId: "p2", quantity: 4 }]);
    expect(result.changes).toEqual([{ productId: "p9", from: 1, to: 0 }]);
  });
});
