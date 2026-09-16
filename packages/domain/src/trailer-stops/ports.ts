import type { TrailerStop, TrailerStopStatus } from "./entities";

export interface TrailerStopRepository {
  listActive(): Promise<TrailerStop[]>;
  create(stop: Omit<TrailerStop, "id">): Promise<TrailerStop>;
  findById(id: string): Promise<TrailerStop | null>;
  updateStatus(id: string, status: TrailerStopStatus): Promise<void>;
}
