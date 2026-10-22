import type { DeliveryLocation } from "./entities";

export interface DeliveryLocationRepository {
  upsert(location: DeliveryLocation): Promise<void>;
  findLatest(userId: string): Promise<DeliveryLocation | null>;
  remove(userId: string): Promise<void>;
}
