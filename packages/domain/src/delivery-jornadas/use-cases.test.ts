import { describe, it, expect } from "vitest";
import { openJornada, closeJornada, findDeliveryStop } from "./use-cases";
import { isStopConflictMessage } from "../trailer-stops/use-cases";
import type { TrailerStop, NewTrailerStop } from "../trailer-stops/entities";
import type { TrailerStopRepository } from "../trailer-stops/ports";

function stop(overrides: Partial<TrailerStop> = {}): TrailerStop {
  return {
    id: "j1",
    location: "Delivery",
    lat: 0,
    lng: 0,
    startTime: new Date("2026-10-29T00:00:00Z"),
    endTime: new Date("2026-10-30T00:00:00Z"),
    status: "active",
    kind: "delivery",
    originalLocation: null,
    originalLat: null,
    originalLng: null,
    originalStartTime: null,
    originalEndTime: null,
    ...overrides,
  };
}

function fakeStops(stops: TrailerStop[]): TrailerStopRepository & { created: NewTrailerStop[] } {
  const created: NewTrailerStop[] = [];
  return {
    created,
    listVisible: async (kind) => stops.filter((s) => !kind || s.kind === kind),
    listAll: async (kind) => stops.filter((s) => !kind || s.kind === kind),
    create: async (s) => {
      created.push(s);
      const inserted = { ...stop(), ...s, id: `j${stops.length + 1}`, kind: s.kind ?? "trailer" };
      stops.push(inserted);
      return inserted;
    },
    findById: async (id) => stops.find((s) => s.id === id) ?? null,
    updateStatus: async (id, status) => {
      const s = stops.find((x) => x.id === id);
      if (s) s.status = status;
    },
    update: async () => {},
    countOrders: async () => 0,
    deleteWithStock: async () => {},
  };
}

const now = new Date("2026-10-29T10:00:00Z");

describe("openJornada", () => {
  it("crea una parada delivery activa con placeholders de ubicación y 24 h de vigencia", async () => {
    const stops = fakeStops([]);
    const j = await openJornada({ stops }, { name: "Martes" }, now);
    expect(j).toMatchObject({ kind: "delivery", status: "active", location: "Martes" });
    expect(stops.created).toEqual([
      {
        location: "Martes",
        lat: 0,
        lng: 0,
        startTime: now,
        endTime: new Date(now.getTime() + 24 * 3_600_000),
        status: "active",
        kind: "delivery",
      },
    ]);
  });

  it("sin nombre usa 'Delivery'", async () => {
    const stops = fakeStops([]);
    await openJornada({ stops }, {}, now);
    expect(stops.created[0]?.location).toBe("Delivery");
  });

  it("rechaza abrir una segunda jornada si hay otra activa", async () => {
    const stops = fakeStops([stop()]);
    await expect(openJornada({ stops }, {}, now)).rejects.toThrow("A jornada is already open");
    expect(stops.created).toHaveLength(0);
  });

  it("una parada trailer activa o una jornada cerrada no impiden abrir", async () => {
    const stops = fakeStops([stop({ id: "t1", kind: "trailer" }), stop({ id: "j0", status: "completed" })]);
    await expect(openJornada({ stops }, {}, now)).resolves.toMatchObject({ kind: "delivery", status: "active" });
  });
});

describe("closeJornada", () => {
  it("pasa una jornada activa a completed", async () => {
    const j = stop();
    await closeJornada({ stops: fakeStops([j]) }, "j1");
    expect(j.status).toBe("completed");
  });

  it("una parada trailer o inexistente responde Stop not found", async () => {
    const t = stop({ kind: "trailer" });
    await expect(closeJornada({ stops: fakeStops([t]) }, "j1")).rejects.toThrow("Stop not found");
    expect(t.status).toBe("active");
    await expect(closeJornada({ stops: fakeStops([]) }, "j1")).rejects.toThrow("Stop not found");
  });

  it("rechaza cerrar una jornada que no está activa", async () => {
    await expect(closeJornada({ stops: fakeStops([stop({ status: "completed" })]) }, "j1")).rejects.toThrow(
      "Only open jornadas can be closed",
    );
  });

  it("los rechazos de jornada son conflictos (409)", () => {
    expect(isStopConflictMessage("A jornada is already open")).toBe(true);
    expect(isStopConflictMessage("Only open jornadas can be closed")).toBe(true);
  });
});

describe("findDeliveryStop", () => {
  it("separate: la jornada activa; shared: la parada del trailer activa más antigua; null si no hay", async () => {
    const stops = fakeStops([
      stop({ id: "j0", status: "completed" }),
      stop({ id: "t1", kind: "trailer" }),
      stop({ id: "t2", kind: "trailer" }),
      stop({ id: "j1" }),
    ]);
    expect((await findDeliveryStop(stops, "separate"))?.id).toBe("j1");
    expect((await findDeliveryStop(stops, "shared"))?.id).toBe("t1");
    expect(await findDeliveryStop(fakeStops([stop({ status: "completed" })]), "separate")).toBeNull();
    expect(await findDeliveryStop(fakeStops([stop()]), "shared")).toBeNull();
  });
});
