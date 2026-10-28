import { DrizzleTrailerStopRepository } from "@workspace/db/repositories";
import { NextResponse } from "next/server";
import { isUuid, notFoundResponse } from "./domain-error-response";

// Valida que el id sea UUID y que la parada exista; devuelve la respuesta 404 si no.
export async function stopNotFound(stopId: string): Promise<Response | null> {
  if (!isUuid(stopId)) return notFoundResponse();
  return (await new DrizzleTrailerStopRepository().findById(stopId)) ? null : notFoundResponse();
}

// Igual que stopNotFound, pero además rechaza (409) editar el stock de una parada completada.
export async function stopNotEditable(stopId: string): Promise<Response | null> {
  if (!isUuid(stopId)) return notFoundResponse();
  const stop = await new DrizzleTrailerStopRepository().findById(stopId);
  if (!stop) return notFoundResponse();
  return stop.status === "completed"
    ? NextResponse.json({ error: "Completed stops cannot be edited" }, { status: 409 })
    : null;
}
