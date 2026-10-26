import { NextResponse } from "next/server";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import type { Order } from "@workspace/domain/orders";
import { authorizeMobile } from "../../_lib/authorize-mobile";

// Solo lo que muestra la pantalla del despachador: nada de teléfono, email, Stripe ni detalle de ítems.
function toQueueOrder(o: Order) {
  return {
    id: o.id,
    customerName: o.customerName,
    fulfillmentType: o.fulfillmentType,
    fulfillmentStatus: o.fulfillmentStatus,
    deliveryAddress: o.deliveryAddress,
    totalCents: o.totalCents,
    itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

export async function GET(req: Request): Promise<Response> {
  const session = await authorizeMobile(req, "despachador");
  if (session instanceof Response) return session;
  const orders = await new DrizzleOrderRepository().findQueueForDespachador();
  return NextResponse.json({ orders: orders.map(toQueueOrder) });
}
