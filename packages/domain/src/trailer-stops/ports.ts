import type { TrailerStop, TrailerStopStatus, TrailerStopKind, NewTrailerStop } from "./entities";

export interface TrailerStopRepository {
  listVisible(kind?: TrailerStopKind): Promise<TrailerStop[]>;
  listAll(kind?: TrailerStopKind): Promise<TrailerStop[]>;
  create(stop: NewTrailerStop): Promise<TrailerStop>;
  findById(id: string): Promise<TrailerStop | null>;
  updateStatus(id: string, status: TrailerStopStatus): Promise<void>;
  update(id: string, patch: Partial<Omit<TrailerStop, "id">>): Promise<void>;
  countOrders(id: string): Promise<number>;
  deleteWithStock(id: string): Promise<void>;
}
