/** Un evento de transición de un pedido, tal como lo consume el reporte de tiempos. */
export interface TimingEvent {
  kind: "fulfillment" | "payment";
  fromStatus: string | null;
  toStatus: string;
  occurredAt: Date;
  actorUserId: string | null;
}

/** Un pedido del rango con sus unidades y su historial de transiciones (ordenado por `occurredAt`). */
export interface TimingOrderRow {
  orderId: string;
  stopId: string | null;
  fulfillmentType: "pickup" | "self_delivery";
  channel: "web" | "whatsapp";
  totalCents: number;
  units: number;
  coffeeUnits: number;
  sweetUnits: number;
  createdAt: Date;
  cancelled: boolean;
  events: TimingEvent[];
}

export interface OrderTimingRepository {
  /** Pedidos con `createdAt` en [from, to], opcionalmente de una sola parada. */
  listForReport(filter: { from: Date; to: Date; stopId?: string }): Promise<TimingOrderRow[]>;
}
