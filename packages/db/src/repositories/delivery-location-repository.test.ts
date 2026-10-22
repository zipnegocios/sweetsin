import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { DrizzleDeliveryLocationRepository } from "./delivery-location-repository";
import { db } from "../index";
import { usersTable, deliveryLocationsTable } from "../schema";

describe("DrizzleDeliveryLocationRepository", () => {
  let userId: string;
  const repo = new DrizzleDeliveryLocationRepository();

  beforeAll(async () => {
    const [user] = await db
      .insert(usersTable)
      .values({ name: "Tracking Test", email: `tracking-test-${Date.now()}@example.com`, role: "delivery" })
      .returning();
    userId = user.id;
  });

  afterAll(async () => {
    await db.delete(deliveryLocationsTable).where(eq(deliveryLocationsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
  });

  it("upsert twice leaves a single row with the latest values", async () => {
    await repo.upsert({ userId, lat: 25.7, lng: -80.2, accuracyMeters: 12, recordedAt: new Date("2026-10-20T12:00:00Z") });
    await repo.upsert({ userId, lat: 25.8, lng: -80.3, accuracyMeters: null, recordedAt: new Date("2026-10-20T12:01:00Z") });

    const rows = await db.select().from(deliveryLocationsTable).where(eq(deliveryLocationsTable.userId, userId));
    expect(rows).toHaveLength(1);
    const latest = await repo.findLatest(userId);
    expect(latest).toEqual({
      userId,
      lat: 25.8,
      lng: -80.3,
      accuracyMeters: null,
      recordedAt: new Date("2026-10-20T12:01:00Z"),
    });
  });

  it("an upsert with an older recordedAt does not overwrite a newer position", async () => {
    await repo.upsert({ userId, lat: 1, lng: 1, accuracyMeters: 5, recordedAt: new Date("2026-10-20T11:59:00Z") });

    expect(await repo.findLatest(userId)).toEqual({
      userId,
      lat: 25.8,
      lng: -80.3,
      accuracyMeters: null,
      recordedAt: new Date("2026-10-20T12:01:00Z"),
    });
  });

  it("remove deletes the row", async () => {
    await repo.remove(userId);
    expect(await repo.findLatest(userId)).toBeNull();
  });
});
