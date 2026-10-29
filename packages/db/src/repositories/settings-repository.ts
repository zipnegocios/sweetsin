import { eq } from "drizzle-orm";
import type { AppSettings, SettingsRepository } from "@workspace/domain/settings";
import { db } from "../index";
import { settingsTable } from "../schema";

const SETTINGS_ROW_ID = 1;

function toSettings(row: typeof settingsTable.$inferSelect): AppSettings {
  return {
    deliveryFeeCents: row.deliveryFeeCents,
    deliveryEvidenceRequired: row.deliveryEvidenceRequired,
    requireStockConfirmationOnOpen: row.requireStockConfirmationOnOpen,
    allowMultipleActiveStops: row.allowMultipleActiveStops,
    liveStockEnabled: row.liveStockEnabled,
    autoSoldOutEnabled: row.autoSoldOutEnabled,
    timingEnabled: row.timingEnabled,
    showPerStaffBreakdown: row.showPerStaffBreakdown,
    capacityEngineEnabled: row.capacityEngineEnabled,
    workAreaUnits: row.workAreaUnits,
    vehicleCapacityUnits: row.vehicleCapacityUnits,
    tripMinutes: row.tripMinutes,
    maxDeliveryTrips: row.maxDeliveryTrips,
    showEstimateToCustomer: row.showEstimateToCustomer,
    deliveryStockControlEnabled: row.deliveryStockControlEnabled,
    deliveryStockMode: row.deliveryStockMode,
  };
}

export class DrizzleSettingsRepository implements SettingsRepository {
  async get(): Promise<AppSettings> {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.id, SETTINGS_ROW_ID));
    if (row) return toSettings(row);

    const [inserted] = await db.insert(settingsTable).values({ id: SETTINGS_ROW_ID }).returning();
    return toSettings(inserted);
  }

  async update(partial: Partial<AppSettings>): Promise<AppSettings> {
    const [updated] = await db
      .insert(settingsTable)
      .values({ id: SETTINGS_ROW_ID, ...partial })
      .onConflictDoUpdate({ target: settingsTable.id, set: partial })
      .returning();
    return toSettings(updated);
  }
}
