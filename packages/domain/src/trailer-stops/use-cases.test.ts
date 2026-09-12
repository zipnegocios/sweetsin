import { describe, it, expect } from "vitest";
import { listActiveTrailerStops } from "./use-cases";
import type { TrailerStop } from "./entities";
import type { TrailerStopRepository } from "./ports";

function fakeStop(overrides: Partial<TrailerStop> = {}): TrailerStop {
  return {
    id: "stop1",
    location: "Central Market, Adelaide CBD",
    lat: -34.9289,
    lng: 138.5999,
    startTime: new Date("2026-09-18T06:30:00Z"),
    endTime: new Date("2026-09-18T10:30:00Z"),
    status: "scheduled",
    ...overrides,
  };
}

function fakeRepo(stops: TrailerStop[]): TrailerStopRepository {
  return {
    async listActive() {
      return stops.filter((s) => s.status !== "completed" && s.status !== "cancelled");
    },
  };
}

describe("listActiveTrailerStops", () => {
  it("returns only stops that are not completed or cancelled", async () => {
    const repo = fakeRepo([
      fakeStop({ id: "stop1", status: "scheduled" }),
      fakeStop({ id: "stop2", status: "cancelled" }),
      fakeStop({ id: "stop3", status: "completed" }),
      fakeStop({ id: "stop4", status: "active" }),
    ]);

    const result = await listActiveTrailerStops(repo);
    expect(result.map((s) => s.id)).toEqual(["stop1", "stop4"]);
  });
});
