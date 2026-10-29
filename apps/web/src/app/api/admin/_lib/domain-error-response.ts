import { NextResponse } from "next/server";
import { isStopConflictMessage } from "@workspace/domain/trailer-stops";
import { isStockConflictMessage } from "@workspace/domain/stock";
import { isStockTemplateConflictMessage } from "@workspace/domain/stock-templates";
import { isOrderConflictMessage } from "@workspace/domain/orders";
import { LIVE_STOCK_DISABLED, PER_STAFF_DISABLED } from "@/lib/settings-errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Un id que no es UUID nunca existe: 404 sin tocar dominio ni DB.
export function notFoundResponse(what = "Stop not found"): Response {
  return NextResponse.json({ error: what }, { status: 404 });
}
export const isUuid = (id: string): boolean => UUID.test(id);

const NOT_FOUND_MESSAGES = ["Stop not found", "Template not found", "Stock row not found", "Product not found"];

// "* not found" -> 404; reglas de negocio conocidas -> 409; el resto -> 500 sin filtrar detalles.
export function domainErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  if (NOT_FOUND_MESSAGES.includes(message)) return notFoundResponse(message);
  // El dominio agrega el id ("Order not found: <id>"); la respuesta no lo repite.
  if (message.startsWith("Order not found")) return notFoundResponse("Order not found");
  if (
    isStopConflictMessage(message) ||
    isStockConflictMessage(message) ||
    isStockTemplateConflictMessage(message) ||
    isOrderConflictMessage(message) ||
    // Interruptores de Settings apagados.
    message === LIVE_STOCK_DISABLED ||
    message === PER_STAFF_DISABLED
  ) {
    return NextResponse.json({ error: message }, { status: 409 });
  }
  // Violación de FK de Postgres (23503): productId con forma de UUID pero inexistente. drizzle la envuelve en .cause.
  const code = (error as { code?: string; cause?: { code?: string } } | null)?.code ?? (error as { cause?: { code?: string } } | null)?.cause?.code;
  if (code === "23503") return notFoundResponse("Product not found");
  console.error(error);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
