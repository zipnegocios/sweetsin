import { eq, inArray } from "drizzle-orm";
import type { PushTokenRepository } from "@workspace/domain/notifications";
import { db } from "../index";
import { pushTokensTable } from "../schema";

export class DrizzlePushTokenRepository implements PushTokenRepository {
  async upsert(userId: string, token: string): Promise<void> {
    await db
      .insert(pushTokensTable)
      .values({ userId, token })
      .onConflictDoUpdate({ target: pushTokensTable.userId, set: { token } });
  }

  async findByUserId(userId: string): Promise<string | null> {
    const [row] = await db.select().from(pushTokensTable).where(eq(pushTokensTable.userId, userId));
    return row?.token ?? null;
  }

  async findByUserIds(userIds: string[]): Promise<{ userId: string; token: string }[]> {
    if (userIds.length === 0) return [];
    const rows = await db.select().from(pushTokensTable).where(inArray(pushTokensTable.userId, userIds));
    return rows.map((row) => ({ userId: row.userId, token: row.token }));
  }
}
