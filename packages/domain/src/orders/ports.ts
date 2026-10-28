import type { Order, OrderChannel, FulfillmentType, FulfillmentStatus, PaymentStatus } from "./entities";

export interface NewOrderInput {
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  stopId: string | null;
  deliveryFeeCents: number;
  channel: OrderChannel;
  items: { productId: string; quantity: number }[];
}

export interface OrderFilters {
  fulfillmentStatus?: FulfillmentStatus;
  paymentStatus?: PaymentStatus;
  channel?: OrderChannel;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: "createdAt" | "totalCents";
  sortDir?: "asc" | "desc";
}

export interface DeliveryEvidence {
  key: string;
  capturedAt: Date;
  lat: number;
  lng: number;
}

export interface DeliveryEvidenceStorage {
  createUploadUrl(key: string, contentType: "image/jpeg"): Promise<string>;
}

/** Quién y desde dónde provoca una transición; `record: false` evita registrar el evento. */
export interface TransitionContext {
  actorUserId: string | null;
  source: "web" | "mobile" | "webhook" | "system";
  occurredAt?: Date;
  record: boolean;
}

export interface OrderRepository {
  create(order: Omit<Order, "id">): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  attachPaymentIntent(orderId: string, stripePaymentIntentId: string): Promise<void>;
  markAsPaid(orderId: string, ctx?: TransitionContext): Promise<void>;
  listAll(filters: OrderFilters): Promise<Order[]>;
  listByCustomerId(customerId: string): Promise<Order[]>;
  updateFulfillmentStatus(orderId: string, status: FulfillmentStatus, ctx?: TransitionContext): Promise<void>;
  updatePaymentStatus(orderId: string, status: PaymentStatus): Promise<void>;
  findQueueForDespachador(): Promise<Order[]>;
  findAssignedToDelivery(deliveryUserId: string): Promise<Order[]>;
  assignDelivery(orderId: string, deliveryUserId: string, ctx?: TransitionContext): Promise<void>;
  recordDeliveryEvidence(orderId: string, evidence: DeliveryEvidence): Promise<void>;
  setAttention(orderId: string, reason: string | null): Promise<void>;
  /** Cancela los pedidos sin pagar de la parada; devuelve cuántos. */
  cancelPendingOrdersForStop(stopId: string, ctx?: TransitionContext): Promise<number>;
  countPaidUndeliveredForStop(stopId: string): Promise<number>;
  /** Pedidos de la parada, pagados o no, que no están `delivered` ni `cancelled`. */
  countUndeliveredForStop(stopId: string): Promise<number>;
}
