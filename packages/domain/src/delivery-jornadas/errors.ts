export type DeliveryRejectionReason = { code: "no_open_jornada" };

/** El control de stock a domicilio rechazó un pedido de entrega; `reasons` es lo que debe mostrarse al cliente. */
export class DeliveryRejectedError extends Error {
  readonly name = "DeliveryRejectedError";
  constructor(readonly reasons: DeliveryRejectionReason[]) {
    super("Delivery rejected");
  }
}
