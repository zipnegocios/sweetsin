import type { TrailerStop } from "@workspace/domain/trailer-stops";
import type { ProductAvailability } from "./cart-availability";

/** Parada ofrecida en el sitio público para retiro, con lo disponible por producto. */
export interface PickupStop {
  stopId: string;
  location: string;
  startTime: Date;
  endTime: Date;
  availability: ProductAvailability[];
}

export interface PickupStopsData {
  autoSoldOutEnabled: boolean;
  stops: PickupStop[];
}

/**
 * Paradas donde se puede retirar — mismo criterio que valida `createOrder`: la activa
 * hasta que se cierra (aunque haya pasado su hora de fin) y las programadas (pre-pedido)
 * que aún no terminaron.
 */
export function eligiblePickupStops(stops: TrailerStop[], now: Date): TrailerStop[] {
  return stops.filter(
    (s) => s.status === "active" || (s.status === "scheduled" && s.endTime.getTime() > now.getTime()),
  );
}
