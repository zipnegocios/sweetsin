import type { CapacityReason } from "./evaluate";

/** El motor de capacidad rechazó un pedido de entrega; `reasons` es lo que debe mostrarse al cliente. */
export class CapacityRejectedError extends Error {
  readonly name = "CapacityRejectedError";
  constructor(readonly reasons: CapacityReason[]) {
    super("Capacity rejected");
  }
}
