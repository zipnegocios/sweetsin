import type { OrderRepository } from "../orders/ports";
import type { LatLng, RouteInfo } from "./entities";
import type { RoutePlanner } from "./ports";

export async function getRouteForOrder(
  deps: { orders: OrderRepository; planner: RoutePlanner },
  orderId: string,
  actor: { userId: string; role: "delivery" },
  origin: LatLng,
): Promise<RouteInfo> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.assignedDeliveryUserId !== actor.userId) {
    throw new Error("Only the assigned delivery user can get the route for this order");
  }
  if (order.fulfillmentStatus !== "out_for_delivery") {
    throw new Error(`Cannot get a route from status: ${order.fulfillmentStatus}`);
  }
  if (!order.deliveryAddress) throw new Error("Order has no delivery address");
  if (!(origin.lat >= -90 && origin.lat <= 90)) throw new Error("Latitude out of range");
  if (!(origin.lng >= -180 && origin.lng <= 180)) throw new Error("Longitude out of range");
  return deps.planner.computeRoute(origin, order.deliveryAddress);
}
