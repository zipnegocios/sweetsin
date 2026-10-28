export type StopOperationErrorKey =
  | "opErrorGeneric"
  | "opErrorAnotherActive"
  | "opErrorNotScheduled"
  | "opErrorNotActiveClose"
  | "opErrorUndelivered"
  | "opErrorStopNotActive"
  | "opErrorStopNotFound"
  | "opErrorWasteExceeds"
  | "opErrorQuantity"
  | "opErrorLiveStockDisabled"
  | "opErrorStockInsufficient"
  | "opErrorRequiresAttention"
  | "opErrorNoAttention"
  | "opErrorNoStop"
  | "opErrorOnlyPickupHandover"
  | "opErrorInvalidTransition";

export interface StopOperationError {
  key: StopOperationErrorKey;
  values?: Record<string, string>;
}

const KEYS: Record<string, StopOperationErrorKey> = {
  "Only scheduled stops can be opened": "opErrorNotScheduled",
  "Only active stops can be closed": "opErrorNotActiveClose",
  "Stop has undelivered orders": "opErrorUndelivered",
  "Stop is not active": "opErrorStopNotActive",
  "Stop not found": "opErrorStopNotFound",
  "Waste exceeds current stock": "opErrorWasteExceeds",
  "Quantity must be a positive integer": "opErrorQuantity",
  "Live stock is disabled": "opErrorLiveStockDisabled",
  "Stock still insufficient": "opErrorStockInsufficient",
  "Order requires attention": "opErrorRequiresAttention",
  "Order does not require attention": "opErrorNoAttention",
  "Order has no stop": "opErrorNoStop",
  "Only pickup orders can be handed over": "opErrorOnlyPickupHandover",
};

const ANOTHER_ACTIVE = "Another stop is active: ";
const TRANSITION_PREFIXES = ["Invalid transition: ", "Cannot resolve attention from status: "];

/** Clave i18n (namespace admin) para el error de abrir/cerrar paradas, stock en vivo y atención de pedidos. */
export function stopOperationError(error: string): StopOperationError {
  if (error.startsWith(ANOTHER_ACTIVE)) {
    return { key: "opErrorAnotherActive", values: { location: error.slice(ANOTHER_ACTIVE.length) } };
  }
  if (TRANSITION_PREFIXES.some((p) => error.startsWith(p))) return { key: "opErrorInvalidTransition" };
  return { key: KEYS[error] ?? "opErrorGeneric" };
}
