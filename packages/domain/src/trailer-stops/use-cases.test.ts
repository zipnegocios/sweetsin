import { describe, it, expect } from "vitest";
import { listActiveTrailerStops, listAllTrailerStops, createTrailerStop, completeTrailerStop, cancelTrailerStop } from "./use-cases";
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

function fakeRepo(stops: TrailerStop[]): TrailerStopRepository & { created: Omit<TrailerStop, "id">[] } {
  const created: Omit<TrailerStop, "id">[] = [];
  return {
    created,
    async listActive() {
      return stops.filter((s) => s.status !== "completed" && s.status !== "cancelled");
    },
    async listAll() {
      return stops;
    },
    async create(stop) {
      created.push(stop);
      const inserted = { ...stop, id: `stop-${created.length}` };
      stops.push(inserted);
      return inserted;
    },
    async findById(id) {
      return stops.find((s) => s.id === id) ?? null;
    },
    async updateStatus(id, status) {
      const stop = stops.find((s) => s.id === id);
      if (stop) stop.status = status;
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

describe("listAllTrailerStops", () => {
  it("returns every stop regardless of status", async () => {
    const repo = fakeRepo([fakeStop({ id: "stop1", status: "completed" }), fakeStop({ id: "stop2" })]);

    const result = await listAllTrailerStops(repo);
    expect(result.map((s) => s.id)).toEqual(["stop1", "stop2"]);
  });
});

describe("createTrailerStop", () => {
  it("creates a stop with status scheduled", async () => {
    const repo = fakeRepo([]);

    const stop = await createTrailerStop(repo, {
      location: "Rundle Park, Adelaide",
      lat: -34.9235,
      lng: 138.6087,
      startTime: new Date("2026-10-01T00:00:00Z"),
      endTime: new Date("2026-10-01T05:00:00Z"),
    });

    expect(stop.status).toBe("scheduled");
    expect(repo.created).toHaveLength(1);
  });

  it("throws when startTime is not before endTime", async () => {
    const repo = fakeRepo([]);

    await expect(
      createTrailerStop(repo, {
        location: "Rundle Park, Adelaide",
        lat: -34.9235,
        lng: 138.6087,
        startTime: new Date("2026-10-01T05:00:00Z"),
        endTime: new Date("2026-10-01T00:00:00Z"),
      }),
    ).rejects.toThrow("startTime must be before endTime");
  });
});

describe("completeTrailerStop / cancelTrailerStop", () => {
  it("marks a stop as completed", async () => {
    const repo = fakeRepo([fakeStop({ id: "stop1", status: "active" })]);

    await completeTrailerStop(repo, "stop1");

    expect((await repo.findById("stop1"))?.status).toBe("completed");
  });

  it("marks a stop as cancelled", async () => {
    const repo = fakeRepo([fakeStop({ id: "stop1", status: "scheduled" })]);

    await cancelTrailerStop(repo, "stop1");

    expect((await repo.findById("stop1"))?.status).toBe("cancelled");
  });
});
