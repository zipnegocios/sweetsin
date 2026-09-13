"use server";

import { z } from "zod";
import { createOrder } from "@workspace/domain/orders";
import { DrizzleOrderRepository, DrizzleProductRepository, DrizzleSettingsRepository } from "@workspace/db/repositories";

const checkoutSchema = z.object({
  fulfillmentType: z.enum(["pickup", "self_delivery"]),
  deliveryAddress: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.string().trim().email(),
  channel: z.enum(["web", "whatsapp"]),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1) })).min(1),
});

export interface PlaceOrderInput {
  fulfillmentType: "pickup" | "self_delivery";
  deliveryAddress?: string;
  name: string;
  phone: string;
  email: string;
  channel: "web" | "whatsapp";
  items: { productId: string; quantity: number }[];
}

export interface PlaceOrderResult {
  orderId: string;
  totalCents: number;
}

export async function placeOrderAction(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.parse(input);

  const settings = await new DrizzleSettingsRepository().get();
  const deliveryFeeCents = parsed.fulfillmentType === "self_delivery" ? settings.deliveryFeeCents : 0;

  const order = await createOrder(
    { products: new DrizzleProductRepository(), orders: new DrizzleOrderRepository() },
    {
      customerId: null,
      customerName: parsed.name,
      customerEmail: parsed.email,
      customerPhone: parsed.phone,
      fulfillmentType: parsed.fulfillmentType,
      deliveryAddress: parsed.deliveryAddress ?? null,
      stopId: null,
      deliveryFeeCents,
      channel: parsed.channel,
      items: parsed.items,
    },
  );

  return { orderId: order.id, totalCents: order.totalCents };
}
