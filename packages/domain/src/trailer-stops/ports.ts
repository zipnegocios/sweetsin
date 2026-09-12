import type { TrailerStop } from "./entities";

export interface TrailerStopRepository {
  listActive(): Promise<TrailerStop[]>;
}
