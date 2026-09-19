export interface StaffNotificationPort {
  notifyNewOrderInQueue(despachadorUserIds: string[], order: { id: string; customerName: string }): Promise<void>;
  notifyDeliveryAssigned(deliveryUserId: string, order: { id: string; deliveryAddress: string | null }): Promise<void>;
}

export interface PushTokenRepository {
  upsert(userId: string, token: string): Promise<void>;
  findByUserId(userId: string): Promise<string | null>;
  findByUserIds(userIds: string[]): Promise<{ userId: string; token: string }[]>;
}

export type PushLogStatus = "sent" | "failed" | "blocked";

export interface PushLog {
  id: string;
  to: string;
  type: "new_order_in_queue" | "delivery_assigned";
  status: PushLogStatus;
  errorMessage: string | null;
  createdAt: Date;
}

export interface PushLogRepository {
  create(entry: Omit<PushLog, "id" | "createdAt">): Promise<PushLog>;
  listAll(): Promise<PushLog[]>;
}
