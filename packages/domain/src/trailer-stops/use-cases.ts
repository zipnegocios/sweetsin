import type { TrailerStopRepository } from "./ports";
import type { TrailerStop } from "./entities";

export function listActiveTrailerStops(repo: TrailerStopRepository): Promise<TrailerStop[]> {
  return repo.listActive();
}
