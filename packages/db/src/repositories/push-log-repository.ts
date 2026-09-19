import { desc } from "drizzle-orm";
import type { PushLog, PushLogRepository } from "@workspace/domain/notifications";
import { db } from "../index";
import { pushLogsTable } from "../schema";

export class DrizzlePushLogRepository implements PushLogRepository {
  async create(entry: Omit<PushLog, "id" | "createdAt">): Promise<PushLog> {
    const [inserted] = await db.insert(pushLogsTable).values(entry).returning();
    return inserted as PushLog;
  }

  async listAll(): Promise<PushLog[]> {
    return (await db.select().from(pushLogsTable).orderBy(desc(pushLogsTable.createdAt))) as PushLog[];
  }
}
