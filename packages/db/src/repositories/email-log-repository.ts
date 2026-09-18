import type { EmailLog, EmailLogRepository } from "@workspace/domain/notifications";
import { db } from "../index";
import { emailLogsTable } from "../schema";

export class DrizzleEmailLogRepository implements EmailLogRepository {
  async create(entry: Omit<EmailLog, "id" | "createdAt">): Promise<EmailLog> {
    const [inserted] = await db.insert(emailLogsTable).values(entry).returning();
    return inserted as EmailLog;
  }

  async listAll(): Promise<EmailLog[]> {
    return (await db.select().from(emailLogsTable)) as EmailLog[];
  }
}
