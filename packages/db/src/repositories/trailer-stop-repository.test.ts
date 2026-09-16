import { describe, it, expect, beforeAll } from "vitest";
import { DrizzleTrailerStopRepository } from "./trailer-stop-repository";
import { db } from "../index";
import { trailerStopsTable } from "../schema";

describe("DrizzleTrailerStopRepository", () => {
  const label = `Test Stop ${Date.now()}`;

  beforeAll(async () => {
    await db.insert(trailerStopsTable).values([
      {
        location: label,
        lat: -34.9289,
        lng: 138.5999,
        startTime: new Date(Date.now() + 86_400_000),
        endTime: new Date(Date.now() + 90_000_000),
        status: "scheduled",
      },
      {
        location: label,
        lat: -34.9289,
        lng: 138.5999,
        startTime: new Date(Date.now() - 172_800_000),
        endTime: new Date(Date.now() - 169_200_000),
        status: "completed",
      },
      {
        // status sigue en "scheduled" pero ya venció — nadie lo marca
        // "completed" automáticamente hasta el panel admin de Fase 5.
        // Este caso es el que justifica el filtro por endTime en
        // listActive(): sin él, esta fila se colaría igual.
        location: label,
        lat: -34.9289,
        lng: 138.5999,
        startTime: new Date(Date.now() - 259_200_000),
        endTime: new Date(Date.now() - 255_600_000),
        status: "scheduled",
      },
    ]);
  });

  it("lists only stops that are not completed/cancelled and have not ended yet", async () => {
    const repo = new DrizzleTrailerStopRepository();
    const result = await repo.listActive();
    const matching = result.filter((s) => s.location === label);

    expect(matching).toHaveLength(1);
    expect(matching[0].status).toBe("scheduled");
    expect(matching[0].endTime.getTime()).toBeGreaterThan(Date.now());
  });

  it("creates a stop, finds it by id, and updates its status", async () => {
    const repo = new DrizzleTrailerStopRepository();

    const stop = await repo.create({
      location: `Test Stop ${Date.now()}`,
      lat: -34.9,
      lng: 138.6,
      startTime: new Date("2026-11-01T00:00:00Z"),
      endTime: new Date("2026-11-01T05:00:00Z"),
      status: "scheduled",
    });

    const found = await repo.findById(stop.id);
    expect(found?.location).toBe(stop.location);

    await repo.updateStatus(stop.id, "completed");
    const updated = await repo.findById(stop.id);
    expect(updated?.status).toBe("completed");
  });
});
