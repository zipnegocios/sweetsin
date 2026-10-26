import type { ProductRepository } from "../products/ports";
import type { OrderRepository, NewOrderInput, OrderFilters, DeliveryEvidence } from "./ports";
import type { Order, OrderItem, FulfillmentStatus } from "./entities";
import { getDiscountedUnitPriceCents } from "../pricing/volume-discount";
import type { StockRepository } from "../stock/ports";
import { decrementStockOnSale } from "../stock/use-cases";
import type { StaffNotificationPort } from "../notifications";
import type { UserRepository } from "../users/ports";
import { listActiveStaff } from "../users/use-cases";

export async function createOrder(
  deps: { products: ProductRepository; orders: OrderRepository },
  input: NewOrderInput,
): Promise<Order> {
  if (input.items.length === 0) {
    throw new Error("Order must have at least one item");
  }

  const items: OrderItem[] = [];
  let subtotalCents = 0;
  let discountCents = 0;

  for (const line of input.items) {
    const product = await deps.products.findById(line.productId);
    if (!product) throw new Error(`Product not found: ${line.productId}`);

    const unitPriceCents = product.priceCents;
    const discountedUnitCents = getDiscountedUnitPriceCents(unitPriceCents, line.quantity, product.category);
    const lineDiscountCents = (unitPriceCents - discountedUnitCents) * line.quantity;

    items.push({
      productId: product.id,
      quantity: line.quantity,
      unitPriceCents,
      lineDiscountCents,
    });

    subtotalCents += unitPriceCents * line.quantity;
    discountCents += lineDiscountCents;
  }

  const totalCents = subtotalCents - discountCents + input.deliveryFeeCents;

  return deps.orders.create({
    customerId: input.customerId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    fulfillmentType: input.fulfillmentType,
    deliveryAddress: input.deliveryAddress,
    deliveryNotes: input.deliveryNotes,
    stopId: input.stopId,
    paymentStatus: "pending",
    fulfillmentStatus: "pending",
    subtotalCents,
    discountCents,
    deliveryFeeCents: input.deliveryFeeCents,
    totalCents,
    channel: input.channel,
    stripePaymentIntentId: null,
    assignedDeliveryUserId: null,
    items,
  });
}

export async function confirmOrderPayment(
  deps: {
    orders: OrderRepository;
    stock: StockRepository;
    users?: UserRepository;
    notifications?: StaffNotificationPort;
  },
  orderId: string,
): Promise<void> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.paymentStatus === "paid") return; // Stripe puede reenviar el mismo evento de webhook más de una vez.

  await deps.orders.markAsPaid(orderId);

  if (order.stopId) {
    for (const item of order.items) {
      await decrementStockOnSale(deps.stock, order.stopId, item.productId, item.quantity);
    }
  }

  if (order.fulfillmentStatus !== "pending") return;
  await deps.orders.updateFulfillmentStatus(orderId, "received");

  if (deps.users && deps.notifications) {
    try {
      const staff = await listActiveStaff(deps.users, "despachador");
      await deps.notifications.notifyNewOrderInQueue(
        staff.map((u) => u.id),
        { id: order.id, customerName: order.customerName },
      );
    } catch {
      // Un fallo de push nunca bloquea la confirmacion del pago.
    }
  }
}

export async function listOrders(repo: OrderRepository, filters: OrderFilters): Promise<Order[]> {
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    throw new Error("dateFrom must not be after dateTo");
  }
  return repo.listAll(filters);
}

export async function markOrderInPrep(deps: { orders: OrderRepository }, orderId: string): Promise<Order> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.fulfillmentStatus !== "received") {
    throw new Error(`Cannot move to in_prep from status: ${order.fulfillmentStatus}`);
  }
  await deps.orders.updateFulfillmentStatus(orderId, "in_prep");
  return { ...order, fulfillmentStatus: "in_prep" };
}

export async function markOrderReady(deps: { orders: OrderRepository }, orderId: string): Promise<Order> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.fulfillmentStatus !== "in_prep") {
    throw new Error(`Cannot move to ready_for_pickup from status: ${order.fulfillmentStatus}`);
  }
  await deps.orders.updateFulfillmentStatus(orderId, "ready_for_pickup");
  return { ...order, fulfillmentStatus: "ready_for_pickup" };
}

export async function assignDeliveryToOrder(
  deps: { orders: OrderRepository; users: UserRepository; notifications?: StaffNotificationPort },
  orderId: string,
  deliveryUserId: string,
): Promise<Order> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.fulfillmentStatus !== "ready_for_pickup") {
    throw new Error(`Cannot assign delivery from status: ${order.fulfillmentStatus}`);
  }
  const deliveryUser = await deps.users.findById(deliveryUserId);
  if (!deliveryUser || deliveryUser.role !== "delivery" || !deliveryUser.isActive) {
    throw new Error(`Invalid delivery user: ${deliveryUserId}`);
  }
  await deps.orders.assignDelivery(orderId, deliveryUserId);
  const updated: Order = { ...order, assignedDeliveryUserId: deliveryUserId, fulfillmentStatus: "out_for_delivery" };

  if (deps.notifications) {
    try {
      await deps.notifications.notifyDeliveryAssigned(deliveryUserId, updated);
    } catch {
      // Un fallo de push nunca bloquea la asignacion — el intento ya quedo
      // registrado por el propio adaptador en push_logs.
    }
  }

  return updated;
}

export async function markOrderDelivered(
  deps: { orders: OrderRepository },
  orderId: string,
  actingUserId: string,
): Promise<Order> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  // Idempotente: un reintento offline del mismo delivery sobre una orden ya entregada es un no-op.
  if (order.fulfillmentStatus === "delivered" && order.assignedDeliveryUserId === actingUserId) {
    return order;
  }
  if (order.fulfillmentStatus !== "out_for_delivery") {
    throw new Error(`Cannot mark delivered from status: ${order.fulfillmentStatus}`);
  }
  if (order.assignedDeliveryUserId !== actingUserId) {
    throw new Error("Only the assigned delivery user can mark this order as delivered");
  }
  await deps.orders.updateFulfillmentStatus(orderId, "delivered");
  return { ...order, fulfillmentStatus: "delivered" };
}

export async function recordDeliveryEvidence(
  deps: { orders: OrderRepository },
  orderId: string,
  actingUserId: string,
  evidence: DeliveryEvidence,
): Promise<void> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.assignedDeliveryUserId !== actingUserId) {
    throw new Error("Only the assigned delivery user can record evidence for this order");
  }
  if (order.fulfillmentStatus !== "out_for_delivery" && order.fulfillmentStatus !== "delivered") {
    throw new Error(`Cannot record delivery evidence from status: ${order.fulfillmentStatus}`);
  }
  if (!(evidence.lat >= -90 && evidence.lat <= 90)) throw new Error("Latitude out of range");
  if (!(evidence.lng >= -180 && evidence.lng <= 180)) throw new Error("Longitude out of range");
  if (!evidence.key) throw new Error("Evidence key is required");
  await deps.orders.recordDeliveryEvidence(orderId, evidence);
}

const ALLOWED_TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  pending: ["received", "cancelled"],
  received: ["in_prep", "cancelled"],
  in_prep: ["ready_for_pickup", "cancelled"],
  ready_for_pickup: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export async function changeOrderFulfillmentStatus(
  deps: { orders: OrderRepository; users: UserRepository; notifications?: StaffNotificationPort },
  orderId: string,
  target: FulfillmentStatus,
  options?: { deliveryUserId?: string },
): Promise<Order> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.fulfillmentStatus === target) return order;
  if (!ALLOWED_TRANSITIONS[order.fulfillmentStatus].includes(target)) {
    throw new Error(`Invalid transition: ${order.fulfillmentStatus} → ${target}`);
  }

  switch (target) {
    case "in_prep":
      return markOrderInPrep(deps, orderId);
    case "ready_for_pickup":
      return markOrderReady(deps, orderId);
    case "out_for_delivery":
      if (!options?.deliveryUserId) throw new Error("A delivery user is required for out_for_delivery");
      return assignDeliveryToOrder(deps, orderId, options.deliveryUserId);
    case "delivered":
      if (!order.assignedDeliveryUserId) throw new Error("Order has no assigned delivery user");
      return markOrderDelivered(deps, orderId, order.assignedDeliveryUserId);
    default:
      await deps.orders.updateFulfillmentStatus(orderId, target);
      return { ...order, fulfillmentStatus: target };
  }
}
