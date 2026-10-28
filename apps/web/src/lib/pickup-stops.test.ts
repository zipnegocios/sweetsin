import { describe, it, expect } from "vitest";
import type { TrailerStop } from "@workspace/domain/trailer-stops";
import { eligiblePickupStops } from "./pickup-stops";

const now = new Date("2026-10-28T10:00:00Z");

function stop(id: string, status: TrailerStop["status"], endTime: string): TrailerStop {
  return {
    id,
    location: id,
    lat: 0,
    lng: 0,
    startTime: new Date("2026-10-28T08:00:00Z"),
    endTime: new Date(endTime),
    status,
    originalLocation: null,
    originalLat: null,
    originalLng: null,
    originalStartTime: null,
    originalEndTime: null,
  };
}

describe("eligiblePickupStops", () => {
  it("ofrece la activa y las programadas que aún no terminaron", () => {
    const stops = [
      stop("active", "active", "2026-10-28T12:00:00Z"),
      stop("future", "scheduled", "2026-10-29T12:00:00Z"),
    ];
    expect(eligiblePickupStops(stops, now).map((s) => s.id)).toEqual(["active", "future"]);
  });

  it("nunca ofrece canceladas ni completadas", () => {
    const stops = [
      stop("cancelled", "cancelled", "2026-10-29T12:00:00Z"),
      stop("completed", "completed", "2026-10-29T12:00:00Z"),
    ];
    expect(eligiblePickupStops(stops, now)).toEqual([]);
  });

  it("excluye programadas ya terminadas, igual que createOrder", () => {
    const stops = [stop("ended-scheduled", "scheduled", "2026-10-28T10:00:00Z")];
    expect(eligiblePickupStops(stops, now)).toEqual([]);
  });

  it("la activa sigue elegible pasada su hora de fin, hasta que se cierra", () => {
    const stops = [stop("ended-active", "active", "2026-10-28T09:00:00Z")];
    expect(eligiblePickupStops(stops, now).map((s) => s.id)).toEqual(["ended-active"]);
  });
});
