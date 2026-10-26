import { NextResponse } from "next/server";
import { DrizzleOrderRepository, DrizzleProductRepository, DrizzleSettingsRepository } from "@workspace/db/repositories";
import { authorizeMobile } from "../../_lib/authorize-mobile";

export async function GET(req: Request): Promise<Response> {
  const session = await authorizeMobile(req, "delivery");
  if (session instanceof Response) return session;
  const assigned = await new DrizzleOrderRepository().findAssignedToDelivery(session.userId);
  const { deliveryEvidenceRequired } = await new DrizzleSettingsRepository().get();
  const productIds = [...new Set(assigned.flatMap((o) => o.items.map((i) => i.productId)))];
  const names = new Map(
    (await new DrizzleProductRepository().findByIds(productIds)).map((p) => [p.id, p.nameEn]),
  );
  // Solo lo que muestra la app (y guarda en su caché local): nada de email, Stripe ni ids de producto.
  const orders = assigned.map((o) => ({
    id: o.id,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    deliveryAddress: o.deliveryAddress,
    deliveryEvidenceKey: o.deliveryEvidenceKey ?? null,
    fulfillmentType: o.fulfillmentType,
    items: o.items.map((i) => ({ name: names.get(i.productId) ?? "?", quantity: i.quantity })),
    subtotalCents: o.subtotalCents,
    discountCents: o.discountCents,
    deliveryFeeCents: o.deliveryFeeCents,
    totalCents: o.totalCents,
    channel: o.channel,
    paymentStatus: o.paymentStatus,
    deliveryNotes: o.deliveryNotes ?? null,
  }));
  return NextResponse.json({ orders, deliveryEvidenceRequired });
}
