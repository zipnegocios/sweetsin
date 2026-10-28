import { DrizzleTrailerStopRepository } from "@workspace/db/repositories";
import { isUuid, notFoundResponse } from "./domain-error-response";

// Valida que el id sea UUID y que la parada exista; devuelve la respuesta 404 si no.
export async function stopNotFound(stopId: string): Promise<Response | null> {
  if (!isUuid(stopId)) return notFoundResponse();
  return (await new DrizzleTrailerStopRepository().findById(stopId)) ? null : notFoundResponse();
}
