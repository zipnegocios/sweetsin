import Stripe from "stripe";
import type { PaymentGateway } from "@workspace/domain/payments";

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY must be set. Card payments are not connected yet.");
  }
  return new Stripe(secretKey);
}

export class StripePaymentGateway implements PaymentGateway {
  async createPaymentIntent(
    amountCents: number,
    currency: string,
    metadata: Record<string, string>,
  ): Promise<{ id: string; clientSecret: string }> {
    const stripe = getStripeClient();
    const intent = await stripe.paymentIntents.create({ amount: amountCents, currency, metadata });

    if (!intent.client_secret) {
      throw new Error("Stripe did not return a client secret for the payment intent.");
    }
    return { id: intent.id, clientSecret: intent.client_secret };
  }
}
