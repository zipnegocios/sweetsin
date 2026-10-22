import type { OrderRepository } from "../orders/ports";
import type { LatLng, RouteInfo } from "./entities";
import type { RoutePlanner } from "./ports";

/** Violacion de una regla de negocio de la ruta: el mensaje es texto propio, seguro de mostrar. */
export class DomainRuleError extends Error {}

export class OrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order not found: ${orderId}`);
  }
}

export async function getRouteForOrder(
  deps: { orders: OrderRepository; planner: RoutePlanner },
  orderId: string,
  actor: { userId: string; role: "delivery" },
  origin: LatLng,
): Promise<RouteInfo> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new OrderNotFoundError(orderId);
  if (order.assignedDeliveryUserId !== actor.userId) {
    throw new DomainRuleError("Only the assigned delivery user can get the route for this order");
  }
  if (order.fulfillmentStatus !== "out_for_delivery") {
    throw new DomainRuleError(`Cannot get a route from status: ${order.fulfillmentStatus}`);
  }
  if (!order.deliveryAddress) throw new DomainRuleError("Order has no delivery address");
  if (!(origin.lat >= -90 && origin.lat <= 90)) throw new DomainRuleError("Latitude out of range");
  if (!(origin.lng >= -180 && origin.lng <= 180)) throw new DomainRuleError("Longitude out of range");
  return deps.planner.computeRoute(origin, order.deliveryAddress);
}
