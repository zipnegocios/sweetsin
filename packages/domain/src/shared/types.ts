export type Cents = number;

// Los descuentos por volumen multiplican price_cents por un porcentaje,
// lo que produce centavos fraccionarios — se redondea siempre igual para
// que la suma de line items nunca descuadre con el total.
export function roundCents(value: number): Cents {
  return Math.round(value);
}
