import { NextResponse } from "next/server";
import { isStopConflictMessage } from "@workspace/domain/trailer-stops";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Un id que no es UUID nunca existe: 404 sin tocar dominio ni DB.
export function notFoundResponse(): Response {
  return NextResponse.json({ error: "Stop not found" }, { status: 404 });
}
export const isUuid = (id: string): boolean => UUID.test(id);

// "Stop not found" -> 404; reglas de negocio conocidas -> 409; el resto -> 500 sin filtrar detalles.
export function domainErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  if (message === "Stop not found") return notFoundResponse();
  if (isStopConflictMessage(message)) return NextResponse.json({ error: message }, { status: 409 });
  console.error(error);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
