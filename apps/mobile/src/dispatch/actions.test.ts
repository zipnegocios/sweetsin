import { describe, expect, it } from "vitest";
import { classifyDispatchResponse, nextAction, parseQueue, parseStaff } from "./actions";
import type { QueueOrder } from "./types";

const base: QueueOrder = {
  id: "o1",
  customerName: "Ana",
  customerPhone: "+61400000000",
  fulfillmentType: "pickup",
  fulfillmentStatus: "received",
  deliveryAddress: null,
  totalCents: 1500,
  itemCount: 2,
};

describe("nextAction", () => {
  it("received -> start_prep", () => {
    expect(nextAction({ ...base, fulfillmentStatus: "received" })).toEqual({ kind: "start_prep" });
  });
  it("in_prep -> mark_ready", () => {
    expect(nextAction({ ...base, fulfillmentStatus: "in_prep" })).toEqual({ kind: "mark_ready" });
  });
  it("ready_for_pickup + self_delivery -> assign", () => {
    expect(
      nextAction({ ...base, fulfillmentStatus: "ready_for_pickup", fulfillmentType: "self_delivery" }),
    ).toEqual({ kind: "assign" });
  });
  it("ready_for_pickup + pickup -> none", () => {
    expect(nextAction({ ...base, fulfillmentStatus: "ready_for_pickup" })).toEqual({ kind: "none" });
  });
});

describe("parseQueue", () => {
  it("descarta filas sin id y conserva las válidas", () => {
    const { id: _id, ...sinId } = base;
    expect(parseQueue({ orders: [sinId, base] })).toEqual([base]);
  });
  it("cuerpo inválido -> []", () => {
    expect(parseQueue("x")).toEqual([]);
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue({ orders: "x" })).toEqual([]);
  });
  it("descarta estados fuera del subconjunto", () => {
    expect(parseQueue({ orders: [{ ...base, fulfillmentStatus: "delivered" }] })).toEqual([]);
  });
});

describe("parseStaff", () => {
  it("conserva válidas y descarta mal formadas", () => {
    expect(parseStaff({ staff: [{ id: "u1", name: "Leo" }, { id: "u2" }, 3] })).toEqual([
      { id: "u1", name: "Leo" },
    ]);
  });
  it("cuerpo inválido -> []", () => {
    expect(parseStaff(undefined)).toEqual([]);
  });
});

describe("classifyDispatchResponse", () => {
  it("2xx -> ok", () => expect(classifyDispatchResponse(200, {})).toEqual({ kind: "ok" }));
  it("401 -> unauthorized", () =>
    expect(classifyDispatchResponse(401, null)).toEqual({ kind: "unauthorized" }));
  it("403 -> forbidden", () =>
    expect(classifyDispatchResponse(403, null)).toEqual({ kind: "forbidden" }));
  it("409 -> conflict con motivo", () => {
    expect(
      classifyDispatchResponse(409, { error: "Cannot move to in_prep from status: in_prep" }),
    ).toEqual({ kind: "conflict", reason: "Cannot move to in_prep from status: in_prep" });
  });
  it("409 sin error string -> motivo vacío", () =>
    expect(classifyDispatchResponse(409, null)).toEqual({ kind: "conflict", reason: "" }));
  it("500 -> server", () => expect(classifyDispatchResponse(500, {})).toEqual({ kind: "server" }));
});
