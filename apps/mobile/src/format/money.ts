/** Centavos AUD como "$12.50" ("-$2.00" si es negativo). */
export function formatCents(cents: number): string {
  return `${cents < 0 ? "-" : ""}$${(Math.abs(cents) / 100).toFixed(2)}`;
}
