import type { ProductRepository } from "../products/ports";
import type { OrderRepository, NewOrderInput, OrderFilters } from "./ports";
import type { Order, OrderItem } from "./entities";
import { getDiscountedUnitPriceCents } from "../pricing/volume-discount";
import type { StockRepository } from "../stock/ports";
import { decrementStockOnSale } from "../stock/use-cases";

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
    stopId: input.stopId,
    paymentStatus: "pending",
    fulfillmentStatus: "pending",
    subtotalCents,
    discountCents,
    deliveryFeeCents: input.deliveryFeeCents,
    totalCents,
    channel: input.channel,
    stripePaymentIntentId: null,
    items,
  });
}

export async function confirmOrderPayment(
  deps: { orders: OrderRepository; stock: StockRepository },
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
  deps: { orders: OrderRepository },
  orderId: string,
  deliveryUserId: string,
): Promise<Order> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.fulfillmentStatus !== "ready_for_pickup") {
    throw new Error(`Cannot assign delivery from status: ${order.fulfillmentStatus}`);
  }
  await deps.orders.assignDelivery(orderId, deliveryUserId);
  return { ...order, assignedDeliveryUserId: deliveryUserId, fulfillmentStatus: "out_for_delivery" };
}

export async function markOrderDelivered(
  deps: { orders: OrderRepository },
  orderId: string,
  actingUserId: string,
): Promise<Order> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.fulfillmentStatus !== "out_for_delivery") {
    throw new Error(`Cannot mark delivered from status: ${order.fulfillmentStatus}`);
  }
  if (order.assignedDeliveryUserId !== actingUserId) {
    throw new Error("Only the assigned delivery user can mark this order as delivered");
  }
  await deps.orders.updateFulfillmentStatus(orderId, "delivered");
  return { ...order, fulfillmentStatus: "delivered" };
}
