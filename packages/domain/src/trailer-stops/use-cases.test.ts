import { describe, it, expect } from "vitest";
import {
  listVisibleTrailerStops,
  listAllTrailerStops,
  createTrailerStop,
  completeTrailerStop,
  cancelTrailerStop,
  updateTrailerStop,
  reactivateTrailerStop,
  deleteTrailerStop,
  getStopChanges,
} from "./use-cases";
import type { TrailerStop, NewTrailerStop } from "./entities";
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
    originalLocation: null,
    originalLat: null,
    originalLng: null,
    originalStartTime: null,
    originalEndTime: null,
    ...overrides,
  };
}

function fakeRepo(
  stops: TrailerStop[],
  orderCount = 0,
): TrailerStopRepository & { created: NewTrailerStop[]; deleted: string[] } {
  const created: NewTrailerStop[] = [];
  const deleted: string[] = [];
  return {
    created,
    deleted,
    async listVisible() {
      // Espeja el repo real: oculta completadas y vencidas; las canceladas futuras siguen visibles.
      return stops.filter((s) => s.status !== "completed" && s.endTime >= new Date());
    },
    async listAll() {
      return stops;
    },
    async create(stop) {
      created.push(stop);
      const inserted: TrailerStop = {
        ...stop,
        id: `stop-${created.length}`,
        originalLocation: null,
        originalLat: null,
        originalLng: null,
        originalStartTime: null,
        originalEndTime: null,
      };
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
    async update(id, patch) {
      const stop = stops.find((s) => s.id === id);
      if (stop) Object.assign(stop, patch);
    },
    async countOrders() {
      return orderCount;
    },
    async deleteWithStock(id) {
      deleted.push(id);
    },
  };
}

describe("listVisibleTrailerStops", () => {
  it("hides completed stops but keeps future cancelled ones visible", async () => {
    const future = { startTime: new Date(Date.now() + 36e5), endTime: new Date(Date.now() + 72e5) };
    const repo = fakeRepo([
      fakeStop({ id: "stop1", status: "scheduled", ...future }),
      fakeStop({ id: "stop2", status: "cancelled", ...future }),
      fakeStop({ id: "stop3", status: "completed", ...future }),
      fakeStop({ id: "stop4", status: "active", ...future }),
    ]);

    const result = await listVisibleTrailerStops(repo);
    expect(result.map((s) => s.id)).toEqual(["stop1", "stop2", "stop4"]);
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

describe("transition guards", () => {
  it("cancel throws unless scheduled", async () => {
    const repo = fakeRepo([fakeStop({ status: "active" })]);
    await expect(cancelTrailerStop(repo, "stop1")).rejects.toThrow();
  });

  it("reactivate moves cancelled to scheduled and throws otherwise", async () => {
    const repo = fakeRepo([fakeStop({ id: "a", status: "cancelled" }), fakeStop({ id: "b", status: "scheduled" })]);
    await reactivateTrailerStop(repo, "a");
    expect((await repo.findById("a"))?.status).toBe("scheduled");
    await expect(reactivateTrailerStop(repo, "b")).rejects.toThrow();
  });

  it("complete throws when cancelled or completed", async () => {
    const repo = fakeRepo([fakeStop({ id: "a", status: "cancelled" }), fakeStop({ id: "b", status: "completed" })]);
    await expect(completeTrailerStop(repo, "a")).rejects.toThrow();
    await expect(completeTrailerStop(repo, "b")).rejects.toThrow();
  });
});

describe("updateTrailerStop", () => {
  const input = {
    location: "New Place",
    lat: -35,
    lng: 139,
    startTime: new Date("2026-09-19T06:30:00Z"),
    endTime: new Date("2026-09-19T10:30:00Z"),
  };

  it("throws when the stop does not exist", async () => {
    await expect(updateTrailerStop(fakeRepo([]), "x", input)).rejects.toThrow("Stop not found");
  });

  it("throws when completed", async () => {
    const repo = fakeRepo([fakeStop({ status: "completed" })]);
    await expect(updateTrailerStop(repo, "stop1", input)).rejects.toThrow("Completed stops cannot be edited");
  });

  it("throws when startTime is not before endTime", async () => {
    const repo = fakeRepo([fakeStop()]);
    await expect(
      updateTrailerStop(repo, "stop1", { ...input, startTime: input.endTime, endTime: input.startTime }),
    ).rejects.toThrow("startTime must be before endTime");
  });

  it("stores originals on first change and does not overwrite them on the second", async () => {
    const original = fakeStop();
    const repo = fakeRepo([original]);
    await updateTrailerStop(repo, "stop1", input);
    const first = await repo.findById("stop1");
    expect(first?.location).toBe("New Place");
    expect(first?.originalLocation).toBe("Central Market, Adelaide CBD");
    expect(first?.originalLat).toBe(-34.9289);
    expect(first?.originalLng).toBe(138.5999);
    expect(first?.originalStartTime).toEqual(new Date("2026-09-18T06:30:00Z"));
    expect(first?.originalEndTime).toEqual(new Date("2026-09-18T10:30:00Z"));

    await updateTrailerStop(repo, "stop1", { ...input, location: "Third Place" });
    const second = await repo.findById("stop1");
    expect(second?.location).toBe("Third Place");
    expect(second?.originalLocation).toBe("Central Market, Adelaide CBD");
  });

  it("does not store originals when nothing changed", async () => {
    const repo = fakeRepo([fakeStop()]);
    const s = fakeStop();
    await updateTrailerStop(repo, "stop1", {
      location: s.location, lat: s.lat, lng: s.lng, startTime: s.startTime, endTime: s.endTime,
    });
    expect((await repo.findById("stop1"))?.originalLocation).toBeNull();
  });
});

describe("getStopChanges", () => {
  it("is false/false when originals are null", () => {
    expect(getStopChanges(fakeStop())).toEqual({ locationChanged: false, dateChanged: false });
  });

  it("detects location and date changes", () => {
    const stop = fakeStop({
      location: "B",
      originalLocation: "A",
      originalStartTime: new Date("2026-09-17T06:30:00Z"),
      originalEndTime: new Date("2026-09-18T10:30:00Z"),
    });
    expect(getStopChanges(stop)).toEqual({ locationChanged: true, dateChanged: true });
  });

  it("is false when the location is restored to the original", () => {
    const stop = fakeStop({
      originalLocation: "Central Market, Adelaide CBD",
      originalStartTime: new Date("2026-09-18T06:30:00Z"),
      originalEndTime: new Date("2026-09-18T10:30:00Z"),
    });
    expect(getStopChanges(stop)).toEqual({ locationChanged: false, dateChanged: false });
  });
});

describe("deleteTrailerStop", () => {
  it("throws Stop has orders and does not delete", async () => {
    const repo = fakeRepo([fakeStop()], 2);
    await expect(deleteTrailerStop(repo, "stop1")).rejects.toThrow("Stop has orders");
    expect(repo.deleted).toEqual([]);
  });

  it("deletes with stock when no orders", async () => {
    const repo = fakeRepo([fakeStop()], 0);
    await deleteTrailerStop(repo, "stop1");
    expect(repo.deleted).toEqual(["stop1"]);
  });
});

describe("minute granularity and invalid dates", () => {
  const base = { location: "Central Market, Adelaide CBD", lat: -34.9289, lng: 138.5999 };

  it("an update that only changes seconds/ms sets no original* and no dateChanged", async () => {
    const updated = await updateTrailerStop(fakeRepo([fakeStop({ id: "s" })]), "s", {
      ...base,
      startTime: new Date("2026-09-18T06:30:45.123Z"),
      endTime: new Date("2026-09-18T10:30:59.999Z"),
    });
    expect(updated.originalStartTime).toBeNull();
    expect(getStopChanges(updated).dateChanged).toBe(false);
  });

  it("a real minute change stores original* and yields dateChanged", async () => {
    const updated = await updateTrailerStop(fakeRepo([fakeStop({ id: "s" })]), "s", {
      ...base,
      startTime: new Date("2026-09-18T06:31:00Z"),
      endTime: new Date("2026-09-18T10:30:00Z"),
    });
    expect(updated.originalStartTime).toEqual(new Date("2026-09-18T06:30:00Z"));
    expect(getStopChanges(updated).dateChanged).toBe(true);
  });

  it("rejects Invalid Date on create and update", async () => {
    const bad = { ...base, startTime: new Date("nope"), endTime: new Date("2026-09-18T10:30:00Z") };
    await expect(createTrailerStop(fakeRepo([]), bad)).rejects.toThrow("Invalid date");
    await expect(updateTrailerStop(fakeRepo([fakeStop({ id: "s" })]), "s", bad)).rejects.toThrow("Invalid date");
  });
});
