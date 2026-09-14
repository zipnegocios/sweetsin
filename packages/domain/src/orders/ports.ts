import type { Order, OrderChannel, FulfillmentType, FulfillmentStatus, PaymentStatus } from "./entities";

export interface NewOrderInput {
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  deliveryAddress: string | null;
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

export interface OrderRepository {
  create(order: Omit<Order, "id">): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  attachPaymentIntent(orderId: string, stripePaymentIntentId: string): Promise<void>;
  markAsPaid(orderId: string): Promise<void>;
  listAll(filters: OrderFilters): Promise<Order[]>;
  listByCustomerId(customerId: string): Promise<Order[]>;
  updateFulfillmentStatus(orderId: string, status: FulfillmentStatus): Promise<void>;
  updatePaymentStatus(orderId: string, status: PaymentStatus): Promise<void>;
}
