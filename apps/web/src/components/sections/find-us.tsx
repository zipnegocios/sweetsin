import { listActiveTrailerStops } from "@workspace/domain/trailer-stops";
import { DrizzleTrailerStopRepository } from "@workspace/db/repositories";
import { FindUsClient } from "./find-us-client";

export async function FindUs() {
  const stops = await listActiveTrailerStops(new DrizzleTrailerStopRepository());
  return <FindUsClient stops={stops} />;
}
