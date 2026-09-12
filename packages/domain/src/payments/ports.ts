export interface PaymentGateway {
  createPaymentIntent(amountCents: number, currency: string): Promise<{ id: string; clientSecret: string }>;
}
