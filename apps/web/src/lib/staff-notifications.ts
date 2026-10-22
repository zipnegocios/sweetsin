import type { StaffNotificationPort } from "@workspace/domain/notifications";
import { DrizzlePushTokenRepository, DrizzlePushLogRepository } from "@workspace/db/repositories";
import { ExpoNotificationAdapter } from "@workspace/notifications";

export function createStaffNotifications(): StaffNotificationPort {
  return new ExpoNotificationAdapter(new DrizzlePushTokenRepository(), new DrizzlePushLogRepository());
}
