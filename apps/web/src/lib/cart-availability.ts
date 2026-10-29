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

export type Fulfillment = "pickup" | "self_delivery";

/** Stock público de la entrega a domicilio (solo ids y cantidades). */
export interface DeliveryAvailability {
  /** Control de stock a domicilio encendido. */
  enabled: boolean;
  /** Hay jornada (o parada, en modo compartido) abierta. */
  open: boolean;
  stock: Record<string, number>;
}

/** Interruptor apagado: la entrega no se limita, el checkout queda como antes. */
export const EMPTY_DELIVERY_AVAILABILITY: DeliveryAvailability = { enabled: false, open: false, stock: {} };

/**
 * Stock que limita una entrega: solo con jornada abierta. Sin jornada no se recorta el carrito
 * (el servidor rechaza el pedido y el cliente ve la salida por WhatsApp).
 */
export function deliveryAvailabilityList(delivery: DeliveryAvailability): ProductAvailability[] | null {
  if (!delivery.enabled || !delivery.open) return null;
  return Object.entries(delivery.stock).map(([productId, available]) => ({ productId, available }));
}

/**
 * Stock de entrega tras un `stockChanged` del servidor: fusiona lo que devolvió con lo conocido
 * (mismo criterio que el retiro). Si el cliente creía que no había jornada (se abrió después de
 * cargar la página), pasa a abierta con solo lo devuelto. Sin filas devueltas (p. ej. producto
 * desactivado, o control apagado) no es un conflicto de la jornada: devuelve el mismo estado, intacto.
 */
export function deliveryAfterStockConflict(
  delivery: DeliveryAvailability,
  orderedIds: string[],
  available: ProductAvailability[],
): DeliveryAvailability {
  if (available.length === 0) return delivery;
  const known = deliveryAvailabilityList(delivery) ?? [];
  const merged = [...known.filter((a) => !orderedIds.includes(a.productId)), ...available];
  return { enabled: true, open: true, stock: Object.fromEntries(merged.map((a) => [a.productId, a.available])) };
}

/** El servidor rechazó la entrega por falta de jornada: deja de limitar el carrito con un stock viejo. */
export function deliveryAfterRejection(delivery: DeliveryAvailability): DeliveryAvailability {
  return { ...delivery, open: false };
}

/**
 * Disponibilidad que limita el carrito según el tipo de entrega: la parada solo
 * aplica al retiro y la jornada (si hay control a domicilio) a la entrega. Sin tipo
 * elegido todavía (`null`), elegir parada implica retiro.
 */
export function stopAvailabilityFor(
  fulfillment: Fulfillment | null,
  availability: ProductAvailability[] | null,
  deliveryAvailability: ProductAvailability[] | null = null,
): ProductAvailability[] | null {
  return fulfillment === "self_delivery" ? deliveryAvailability : availability;
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
    // Una línea con cantidad inválida (0, negativa, no entera; p. ej. localStorage corrupto) se quita.
    const valid = Number.isInteger(line.quantity) && line.quantity > 0;
    const limit = valid ? limitFor(line.productId, availability, enforceStock) : 0;
    if (valid && line.quantity <= limit) {
      trimmed.push(line);
      continue;
    }
    changes.push({ productId: line.productId, from: line.quantity, to: limit });
    if (limit > 0) trimmed.push({ ...line, quantity: limit });
  }
  return { lines: changes.length === 0 ? lines : trimmed, changes };
}
