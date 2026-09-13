import { NextResponse } from "next/server";
import { z } from "zod";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { StripePaymentGateway } from "@/infra/stripe-payment-gateway";

const bodySchema = z.object({ orderId: z.string().uuid() });

export async function POST(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const orders = new DrizzleOrderRepository();
  const order = await orders.findById(parsed.data.orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  try {
    const gateway = new StripePaymentGateway();
    const intent = await gateway.createPaymentIntent(order.totalCents, "aud", { orderId: order.id });
    await orders.attachPaymentIntent(order.id, intent.id);
    return NextResponse.json({ clientSecret: intent.clientSecret });
  } catch {
    return NextResponse.json({ error: "Card payments are not available yet." }, { status: 503 });
  }
}
