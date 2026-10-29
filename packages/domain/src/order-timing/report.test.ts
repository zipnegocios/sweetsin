import { describe, expect, it } from "vitest";
import type { TimingEvent, TimingOrderRow } from "./ports";
import {
  buildFulfillmentReport,
  classifyComposition,
  percentile,
  reportToCsv,
  sizeBucket,
} from "./report";
import { segmentDurations } from "./segments";

const T0 = Date.UTC(2026, 5, 1, 0, 0, 0);
const ev = (toStatus: string, sec: number, actor: string | null = null): TimingEvent => ({
  kind: "fulfillment",
  fromStatus: null,
  toStatus,
  occurredAt: new Date(T0 + sec * 1000),
  actorUserId: actor,
});
const row = (o: Partial<TimingOrderRow> = {}): TimingOrderRow => ({
  orderId: "o1",
  stopId: null,
  fulfillmentType: "self_delivery",
  channel: "web",
  totalCents: 1000,
  units: 3,
  coffeeUnits: 0,
  sweetUnits: 3,
  createdAt: new Date(T0),
  cancelled: false,
  events: [],
  ...o,
});
const delivery = (o: Partial<TimingOrderRow> = {}) =>
  row({
    events: [ev("received", 0), ev("in_prep", 60), ev("ready_for_pickup", 360), ev("out_for_delivery", 420), ev("delivered", 1020)],
    ...o,
  });

describe("segmentDurations", () => {
  it("delivery completo", () => {
    expect(segmentDurations(delivery())).toEqual({
      queue: 60000, prep: 300000, assignment: 60000, delivery: 600000, total: 1020000,
    });
  });
  it("retiro completo", () => {
    const r = row({
      fulfillmentType: "pickup",
      events: [ev("received", 0), ev("in_prep", 10), ev("ready_for_pickup", 70), ev("delivered", 100)],
    });
    expect(segmentDurations(r)).toEqual({ queue: 10000, prep: 60000, pickupWait: 30000, total: 100000 });
  });
  it("sin received no hay total ni queue", () => {
    const d = segmentDurations(row({ events: [ev("in_prep", 60), ev("ready_for_pickup", 360), ev("out_for_delivery", 420), ev("delivered", 1020)] }));
    expect(d.total).toBeUndefined();
    expect(d.queue).toBeUndefined();
    expect(d.prep).toBe(300000);
  });
  it("cancelado devuelve vacío", () => {
    expect(segmentDurations(delivery({ cancelled: true }))).toEqual({});
  });
  it("descarta duraciones negativas", () => {
    const d = segmentDurations(row({ events: [ev("received", 100), ev("in_prep", 50)] }));
    expect(d.queue).toBeUndefined();
  });
  it("usa la primera ocurrencia", () => {
    const d = segmentDurations(row({ events: [ev("received", 0), ev("in_prep", 10), ev("in_prep", 99)] }));
    expect(d.queue).toBe(10000);
  });
});

describe("percentile", () => {
  it("vacío", () => expect(percentile([], 50)).toBeNull());
  it("1 valor", () => expect(percentile([7], 90)).toBe(7));
  it("2 valores", () => {
    expect(percentile([10, 2], 50)).toBe(2);
    expect(percentile([10, 2], 90)).toBe(10);
  });
  it("10 valores", () => {
    const v = [10, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(percentile(v, 50)).toBe(5);
    expect(percentile(v, 90)).toBe(9);
    expect(percentile(v, 100)).toBe(10);
  });
});

describe("clasificación", () => {
  it("composición", () => {
    expect(classifyComposition(2, 0)).toBe("coffee");
    expect(classifyComposition(0, 2)).toBe("sweets");
    expect(classifyComposition(1, 1)).toBe("mixed");
    expect(classifyComposition(0, 0)).toBe("mixed");
  });
  it("buckets", () => {
    expect([1, 5, 6, 20, 21, 50, 51].map(sizeBucket)).toEqual(["1-5", "1-5", "6-20", "6-20", "21-50", "21-50", "51+"]);
  });
});

describe("buildFulfillmentReport", () => {
  const opts = { groupBy: "none" as const, dayKey: (d: Date) => d.toISOString().slice(0, 10), minSample: 5 };

  it("excluye cancelados, cuenta en curso y marca muestra chica", () => {
    const r = buildFulfillmentReport(
      [delivery(), delivery({ orderId: "o2", cancelled: true }), row({ orderId: "o3", events: [ev("received", 0)] })],
      opts,
    );
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.orders).toBe(2);
    expect(r.groups[0]!.inProgress).toBe(1);
    expect(r.groups[0]!.segments.total).toEqual({ count: 1, medianMs: 1020000, p90Ms: 1020000, smallSample: true });
  });

  it("minSample 5 no marca grupos con 5", () => {
    const rows = Array.from({ length: 5 }, (_, i) => delivery({ orderId: `o${i}` }));
    expect(buildFulfillmentReport(rows, opts).groups[0]!.segments.total!.smallSample).toBe(false);
  });

  it("slowest ordena y limita a 10", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      row({ orderId: `o${i}`, events: [ev("received", 0), ev("delivered", (i + 1) * 10)] }),
    );
    const { slowest } = buildFulfillmentReport(rows, opts);
    expect(slowest).toHaveLength(10);
    expect(slowest[0]).toEqual({ orderId: "o11", totalMs: 120000 });
    expect(slowest[9]!.orderId).toBe("o2");
  });

  it("agrupa por tipo, canal, tamaño, composición y parada", () => {
    const rows = [
      delivery({ orderId: "a", stopId: "s1", units: 30, coffeeUnits: 30, sweetUnits: 0 }),
      delivery({ orderId: "b", fulfillmentType: "pickup", channel: "whatsapp" }),
    ];
    const keys = (g: "type" | "channel" | "size" | "composition" | "stop") =>
      buildFulfillmentReport(rows, { ...opts, groupBy: g }).groups.map((x) => x.key);
    expect(keys("type")).toEqual(["pickup", "self_delivery"]);
    expect(keys("channel")).toEqual(["web", "whatsapp"]);
    expect(keys("size")).toEqual(["1-5", "21-50"]);
    expect(keys("composition")).toEqual(["coffee", "sweets"]);
    expect(keys("stop")).toEqual(["none", "s1"]);
  });

  it("ordena los grupos de tamaño de menor a mayor, no alfabéticamente", () => {
    const rows = [51, 21, 6, 1].map((units, i) => delivery({ orderId: `s${i}`, units }));
    expect(buildFulfillmentReport(rows, { ...opts, groupBy: "size" }).groups.map((x) => x.key)).toEqual([
      "1-5",
      "6-20",
      "21-50",
      "51+",
    ]);
  });

  const adelaide = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Adelaide", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const dayKey = (d: Date) => adelaide.format(d);
  const at = (iso: string, id: string) => delivery({ orderId: id, createdAt: new Date(iso) });

  it("día de Adelaida: noche del cambio de octubre (inicio DST)", () => {
    const rows = [
      at("2026-10-03T14:29:00Z", "a"), // 3 oct 23:59 local
      at("2026-10-03T14:30:00Z", "b"), // 4 oct 00:00 local
      at("2026-10-03T16:29:00Z", "c"), // 4 oct 02:59 ACST
      at("2026-10-03T16:30:00Z", "d"), // 4 oct 04:00 ACDT
      at("2026-10-04T13:29:00Z", "e"), // 4 oct 23:59 ACDT
      at("2026-10-04T13:30:00Z", "f"), // 5 oct 00:00 ACDT
    ];
    const r = buildFulfillmentReport(rows, { ...opts, groupBy: "day", dayKey });
    expect(r.groups.map((g) => [g.key, g.orders])).toEqual([["2026-10-03", 1], ["2026-10-04", 4], ["2026-10-05", 1]]);
    expect(r.groups.reduce((n, g) => n + g.orders, 0)).toBe(rows.length);
  });

  it("día de Adelaida: noche del cambio de abril (fin DST, hora repetida)", () => {
    const rows = [
      at("2026-04-04T13:29:00Z", "a"), // 4 abr 23:59 ACDT
      at("2026-04-04T13:30:00Z", "b"), // 5 abr 00:00 ACDT
      at("2026-04-04T16:29:00Z", "c"), // 5 abr 02:59 ACDT
      at("2026-04-04T16:31:00Z", "d"), // 5 abr 02:01 ACST (hora repetida)
      at("2026-04-05T14:29:00Z", "e"), // 5 abr 23:59 ACST
    ];
    const r = buildFulfillmentReport(rows, { ...opts, groupBy: "day", dayKey });
    expect(r.groups.map((g) => [g.key, g.orders])).toEqual([["2026-04-04", 1], ["2026-04-05", 4]]);
    expect(r.groups.reduce((n, g) => n + g.orders, 0)).toBe(rows.length);
  });

  it("por persona: cada tramo va a quien lo cerró", () => {
    const r = buildFulfillmentReport(
      [row({ events: [ev("received", 0, "x"), ev("in_prep", 60, "ana"), ev("ready_for_pickup", 360, "ana"), ev("out_for_delivery", 420, "bob"), ev("delivered", 1020, "bob")] })],
      { ...opts, groupBy: "staff" },
    );
    const byKey = Object.fromEntries(r.groups.map((g) => [g.key, g]));
    expect(Object.keys(byKey).sort()).toEqual(["ana", "bob"]);
    expect(Object.keys(byKey.ana!.segments).sort()).toEqual(["prep", "queue"]);
    expect(Object.keys(byKey.bob!.segments).sort()).toEqual(["assignment", "delivery", "total"]);
    expect(byKey.ana!.orders).toBe(1);
    expect(byKey.bob!.orders).toBe(1);
  });

  it("actor nulo cae en system", () => {
    const r = buildFulfillmentReport([delivery()], { ...opts, groupBy: "staff" });
    expect(r.groups.map((g) => g.key)).toEqual(["system"]);
  });
});

describe("reportToCsv", () => {
  it("encabezado, redondeo a un decimal y sin filas de tramos sin datos", () => {
    const r = buildFulfillmentReport(
      [row({ fulfillmentType: "pickup", events: [ev("received", 0), ev("in_prep", 1.26)] })],
      { groupBy: "none", dayKey: () => "d", minSample: 5 },
    );
    expect(reportToCsv(r)).toBe(
      "group,segment,count,median_seconds,p90_seconds,small_sample\nall,queue,1,1.3,1.3,true",
    );
  });
});
