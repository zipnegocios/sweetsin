import { describe, expect, it } from "vitest";
import { interpretLoad, type Fetched } from "./load";

const ok = (body: unknown): PromiseSettledResult<Fetched> => ({ status: "fulfilled", value: { status: 200, body } });
const http = (status: number): PromiseSettledResult<Fetched> => ({ status: "fulfilled", value: { status, body: null } });
const fail = (reason: unknown): PromiseSettledResult<Fetched> => ({ status: "rejected", reason });

const order = {
  id: "o1",
  customerName: "Ana",
  fulfillmentType: "pickup",
  fulfillmentStatus: "received",
  deliveryAddress: null,
  totalCents: 1500,
  itemCount: 2,
};

describe("interpretLoad", () => {
  it("ambas bien: cola y repartidores, con red", () => {
    expect(interpretLoad(ok({ orders: [order] }), ok({ staff: [{ id: "d1", name: "Leo" }] }))).toEqual({
      unauthorized: false,
      forbidden: false,
      offline: false,
      orders: [order],
      staff: [{ id: "d1", name: "Leo" }],
    });
  });

  it("un 401 en cualquiera de las dos cierra sesión", () => {
    expect(interpretLoad(ok({ orders: [] }), http(401)).unauthorized).toBe(true);
    expect(interpretLoad(http(401), ok({ staff: [] })).unauthorized).toBe(true);
  });

  it("si falla repartidores (HTTP o json), la cola recibida se conserva y staff queda sin dato", () => {
    const r1 = interpretLoad(ok({ orders: [order] }), http(500));
    expect(r1.orders).toEqual([order]);
    expect(r1.staff).toBeNull();
    expect(r1.offline).toBe(false);
    const r2 = interpretLoad(ok({ orders: [order] }), fail(new SyntaxError("json")));
    expect(r2.orders).toEqual([order]);
    expect(r2.staff).toBeNull();
  });

  it("si falla la cola, orders es null aunque lleguen repartidores", () => {
    const r = interpretLoad(http(503), ok({ staff: [] }));
    expect(r.orders).toBeNull();
    expect(r.staff).toEqual([]);
    expect(r.offline).toBe(false);
  });

  it("un 403 en cualquiera de las dos marca forbidden sin cerrar sesión", () => {
    const r = interpretLoad(http(403), ok({ staff: [] }));
    expect(r.forbidden).toBe(true);
    expect(r.unauthorized).toBe(false);
    expect(interpretLoad(ok({ orders: [order] }), http(403)).forbidden).toBe(true);
    expect(interpretLoad(ok({ orders: [] }), ok({ staff: [] })).forbidden).toBe(false);
  });

  it("sin red solo si nada respondió y hubo error de red", () => {
    expect(interpretLoad(fail(new TypeError("net")), fail(new TypeError("net"))).offline).toBe(true);
    expect(interpretLoad(fail(new TypeError("net")), http(500)).offline).toBe(false);
    expect(interpretLoad(fail(new Error("Timeout")), fail(new Error("Timeout"))).offline).toBe(false);
  });
});
