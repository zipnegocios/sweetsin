export interface PaymentGateway {
  createPaymentIntent(
    amountCents: number,
    currency: string,
    metadata: Record<string, string>,
  ): Promise<{ id: string; clientSecret: string }>;
}
