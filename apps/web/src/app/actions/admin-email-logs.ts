"use server";

import type { EmailLog } from "@workspace/domain/notifications";
import { DrizzleEmailLogRepository } from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";

export async function listEmailLogsAction(): Promise<EmailLog[]> {
  await requireAdmin();
  return new DrizzleEmailLogRepository().listAll();
}
