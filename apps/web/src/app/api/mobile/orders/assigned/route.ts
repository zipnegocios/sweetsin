import { NextResponse } from "next/server";
import { DrizzleOrderRepository, DrizzleSettingsRepository } from "@workspace/db/repositories";
import { authorizeMobile } from "../../_lib/authorize-mobile";

export async function GET(req: Request): Promise<Response> {
  const session = await authorizeMobile(req, "delivery");
  if (session instanceof Response) return session;
  const assigned = await new DrizzleOrderRepository().findAssignedToDelivery(session.userId);
  const { deliveryEvidenceRequired } = await new DrizzleSettingsRepository().get();
  // Solo lo que muestra la app (y guarda en su caché local): nada de email, Stripe, montos ni ítems.
  const orders = assigned.map((o) => ({
    id: o.id,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    deliveryAddress: o.deliveryAddress,
    deliveryEvidenceKey: o.deliveryEvidenceKey ?? null,
  }));
  return NextResponse.json({ orders, deliveryEvidenceRequired });
}
