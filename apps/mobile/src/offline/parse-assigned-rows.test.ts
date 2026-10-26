import { describe, expect, it } from "vitest";
import { parseAssignedRows } from "./parse-assigned-rows";

describe("parseAssignedRows", () => {
  it("parsea filas válidas y omite las corruptas", () => {
    const rows = [{ payload: '{"id":"a"}' }, { payload: "{no-json" }, { payload: '{"id":"b"}' }];
    expect(parseAssignedRows<{ id: string }>(rows)).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("acepta filas viejas sin los campos de detalle y filas nuevas con ellos", () => {
    const nuevo = {
      id: "n",
      fulfillmentType: "self_delivery",
      items: [{ name: "Gluttony", quantity: 2 }],
      subtotalCents: 1,
      discountCents: 0,
      deliveryFeeCents: 2,
      totalCents: 3,
      channel: "web",
      paymentStatus: "paid",
      deliveryNotes: "timbre roto",
    };
    const rows = [{ payload: '{"id":"viejo","customerName":"A"}' }, { payload: JSON.stringify(nuevo) }];
    expect(parseAssignedRows<{ id: string }>(rows)).toEqual([{ id: "viejo", customerName: "A" }, nuevo]);
  });

  it("ignora campos nuevos con tipo incorrecto sin descartar la fila", () => {
    const row = { id: "x", items: "no", totalCents: "9", deliveryNotes: 5, fulfillmentType: "otro", customerName: "A" };
    expect(parseAssignedRows<{ id: string }>([{ payload: JSON.stringify(row) }])).toEqual([{ id: "x", customerName: "A" }]);
  });

  it("descarta filas que no son objetos o no tienen id", () => {
    const rows = [{ payload: "null" }, { payload: "[1]" }, { payload: '"s"' }, { payload: '{"nombre":"sin id"}' }];
    expect(parseAssignedRows(rows)).toEqual([]);
  });
});
