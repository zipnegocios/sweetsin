// Lógica pura del carrito frente al stock de una parada de retiro (sin React ni DB).

export interface ProductAvailability {
  productId: string;
  available: number;
}

export interface CartLineLike {
  productId: string;
  quantity: number;
}

/** Línea que cambió al recortar; `to: 0` significa que se quitó del carrito. */
export interface CartTrimChange {
  productId: string;
  from: number;
  to: number;
}

/**
 * Cantidad máxima pedible de un producto. Sin parada (`null`) no hay límite.
 * Un producto sin fila de stock en la parada no se puede pedir ahí. Con
 * `enforceStock` apagado (`autoSoldOutEnabled: false`) no se limita por cantidad.
 */
export function limitFor(
  productId: string,
  availability: ProductAvailability[] | null,
  enforceStock: boolean,
): number {
  if (!availability) return Infinity;
  const row = availability.find((a) => a.productId === productId);
  if (!row) return 0;
  return enforceStock ? Math.max(0, row.available) : Infinity;
}

export function trimCartToAvailability<T extends CartLineLike>(
  lines: T[],
  availability: ProductAvailability[] | null,
  enforceStock: boolean,
): { lines: T[]; changes: CartTrimChange[] } {
  const changes: CartTrimChange[] = [];
  const trimmed: T[] = [];
  for (const line of lines) {
    const limit = limitFor(line.productId, availability, enforceStock);
    if (line.quantity <= limit) {
      trimmed.push(line);
      continue;
    }
    changes.push({ productId: line.productId, from: line.quantity, to: limit });
    if (limit > 0) trimmed.push({ ...line, quantity: limit });
  }
  return { lines: changes.length === 0 ? lines : trimmed, changes };
}
