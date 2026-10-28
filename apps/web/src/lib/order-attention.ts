// Motivo de "requiere atención" guardado por el dominio: "insufficient_stock:<productId>" o "stop_cancelled".
export type AttentionReason =
  | { kind: "insufficient_stock"; productId: string }
  | { kind: "stop_cancelled" }
  | { kind: "other"; raw: string };

const INSUFFICIENT = "insufficient_stock:";

export function parseAttentionReason(reason: string): AttentionReason {
  if (reason.startsWith(INSUFFICIENT) && reason.length > INSUFFICIENT.length) {
    return { kind: "insufficient_stock", productId: reason.slice(INSUFFICIENT.length) };
  }
  if (reason === "stop_cancelled") return { kind: "stop_cancelled" };
  return { kind: "other", raw: reason };
}
