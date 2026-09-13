import { eq } from "drizzle-orm";
import type { AppSettings, SettingsRepository } from "@workspace/domain/settings";
import { db } from "../index";
import { settingsTable } from "../schema";

const SETTINGS_ROW_ID = 1;

export class DrizzleSettingsRepository implements SettingsRepository {
  async get(): Promise<AppSettings> {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.id, SETTINGS_ROW_ID));
    if (row) return { deliveryFeeCents: row.deliveryFeeCents };

    const [inserted] = await db.insert(settingsTable).values({ id: SETTINGS_ROW_ID }).returning();
    return { deliveryFeeCents: inserted.deliveryFeeCents };
  }

  async update(partial: Partial<AppSettings>): Promise<AppSettings> {
    const [updated] = await db
      .insert(settingsTable)
      .values({ id: SETTINGS_ROW_ID, ...partial })
      .onConflictDoUpdate({ target: settingsTable.id, set: partial })
      .returning();
    return { deliveryFeeCents: updated.deliveryFeeCents };
  }
}
