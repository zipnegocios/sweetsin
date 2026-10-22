import { eq } from "drizzle-orm";
import type { DeliveryLocation, DeliveryLocationRepository } from "@workspace/domain/delivery-tracking";
import { db } from "../index";
import { deliveryLocationsTable } from "../schema";

export class DrizzleDeliveryLocationRepository implements DeliveryLocationRepository {
  async upsert(location: DeliveryLocation): Promise<void> {
    const values = {
      lat: location.lat,
      lng: location.lng,
      accuracyM: location.accuracyMeters,
      recordedAt: location.recordedAt,
    };
    await db
      .insert(deliveryLocationsTable)
      .values({ userId: location.userId, ...values })
      .onConflictDoUpdate({ target: deliveryLocationsTable.userId, set: values });
  }

  async findLatest(userId: string): Promise<DeliveryLocation | null> {
    const [row] = await db.select().from(deliveryLocationsTable).where(eq(deliveryLocationsTable.userId, userId));
    if (!row) return null;
    return { userId: row.userId, lat: row.lat, lng: row.lng, accuracyMeters: row.accuracyM, recordedAt: row.recordedAt };
  }

  async remove(userId: string): Promise<void> {
    await db.delete(deliveryLocationsTable).where(eq(deliveryLocationsTable.userId, userId));
  }
}
