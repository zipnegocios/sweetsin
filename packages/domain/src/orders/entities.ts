export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type FulfillmentStatus =
  | "pending"
  | "received"
  | "in_prep"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type FulfillmentType = "pickup" | "self_delivery";
export type OrderChannel = "web" | "whatsapp";

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPriceCents: number;
  lineDiscountCents: number;
}

export interface Order {
  id: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  deliveryAddress: string | null;
  stopId: string | null;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  subtotalCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  channel: OrderChannel;
  stripePaymentIntentId: string | null;
  assignedDeliveryUserId: string | null;
  items: OrderItem[];
}
