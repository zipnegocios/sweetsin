const ENUMS: Record<string, string[]> = {
  fulfillmentType: ["pickup", "self_delivery"],
  channel: ["web", "whatsapp"],
  paymentStatus: ["pending", "paid", "failed", "refunded"],
};
const NUMBERS = ["subtotalCents", "discountCents", "deliveryFeeCents", "totalCents"];

const isItem = (i: unknown) =>
  typeof i === "object" && i !== null && typeof (i as any).name === "string" && typeof (i as any).quantity === "number";

/** Quita los campos de detalle con tipo incorrecto: se ignoran, la fila se conserva. */
function dropInvalidDetail(row: Record<string, unknown>): void {
  for (const [k, allowed] of Object.entries(ENUMS)) if (k in row && !allowed.includes(row[k] as string)) delete row[k];
  for (const k of NUMBERS) if (k in row && typeof row[k] !== "number") delete row[k];
  if ("items" in row && !(Array.isArray(row.items) && row.items.every(isItem))) delete row.items;
  if ("deliveryNotes" in row && row.deliveryNotes !== null && typeof row.deliveryNotes !== "string") delete row.deliveryNotes;
}

/** Parsea cada fila de la caché; una fila corrupta o sin id se omite en vez de romper el fallback offline. */
export function parseAssignedRows<T>(rows: { payload: string }[]): T[] {
  const parsed: T[] = [];
  for (const r of rows) {
    try {
      const row = JSON.parse(r.payload);
      if (typeof row !== "object" || row === null || Array.isArray(row) || typeof row.id !== "string") continue;
      dropInvalidDetail(row);
      parsed.push(row as T);
    } catch {
      // fila corrupta: se omite
    }
  }
  return parsed;
}
