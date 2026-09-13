import type { Order, OrderChannel, FulfillmentType } from "./entities";

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

export interface OrderRepository {
  create(order: Omit<Order, "id">): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  attachPaymentIntent(orderId: string, stripePaymentIntentId: string): Promise<void>;
  markAsPaid(orderId: string): Promise<void>;
}
