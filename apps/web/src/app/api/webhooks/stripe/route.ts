import { NextResponse } from "next/server";
import Stripe from "stripe";
import { confirmOrderPayment } from "@workspace/domain/orders";
import { DrizzleOrderRepository, DrizzleStockRepository } from "@workspace/db/repositories";

export async function POST(request: Request): Promise<Response> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!webhookSecret || !secretKey) {
    return NextResponse.json({ error: "Stripe webhook is not connected yet." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(secretKey);
    event = stripe.webhooks.constructEvent(rawBody, signature ?? "", webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata.orderId;
    if (orderId) {
      await confirmOrderPayment(
        { orders: new DrizzleOrderRepository(), stock: new DrizzleStockRepository() },
        orderId,
      );
    }
  }

  return NextResponse.json({ received: true });
}
