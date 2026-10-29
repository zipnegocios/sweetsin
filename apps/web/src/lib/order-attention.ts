// Motivo de "requiere atención" guardado por el dominio: "insufficient_stock:<productId>" o "stop_cancelled".
export type AttentionReason =
  | { kind: "insufficient_stock"; productId: string }
  | { kind: "stop_cancelled" }
  | { kind: "order_cancelled" }
  | { kind: "other"; raw: string };

const INSUFFICIENT = "insufficient_stock:";

export function parseAttentionReason(reason: string): AttentionReason {
  if (reason.startsWith(INSUFFICIENT) && reason.length > INSUFFICIENT.length) {
    return { kind: "insufficient_stock", productId: reason.slice(INSUFFICIENT.length) };
  }
  if (reason === "stop_cancelled") return { kind: "stop_cancelled" };
  if (reason === "order_cancelled") return { kind: "order_cancelled" };
  return { kind: "other", raw: reason };
}

/** Reintentar/resolver solo aplican a pedidos vivos; un pago sobre un pedido cancelado se reembolsa a mano. */
export function hasAttentionActions(reason: string | null | undefined): boolean {
  return Boolean(reason) && parseAttentionReason(reason as string).kind !== "order_cancelled";
}
