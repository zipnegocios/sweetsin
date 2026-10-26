"use server";

import { z } from "zod";
import { createOrder } from "@workspace/domain/orders";
import { DrizzleOrderRepository, DrizzleProductRepository, DrizzleSettingsRepository, DrizzleEmailLogRepository } from "@workspace/db/repositories";
import { SmtpNotificationAdapter, SmtpNotConfiguredError } from "@workspace/notifications";
import { auth } from "@/auth";

const checkoutSchema = z.object({
  fulfillmentType: z.enum(["pickup", "self_delivery"]),
  deliveryAddress: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.string().trim().email(),
  channel: z.enum(["web", "whatsapp"]),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1) })).min(1),
  locale: z.enum(["en", "es"]),
});

export interface PlaceOrderInput {
  fulfillmentType: "pickup" | "self_delivery";
  deliveryAddress?: string;
  name: string;
  phone: string;
  email: string;
  channel: "web" | "whatsapp";
  items: { productId: string; quantity: number }[];
  locale: "en" | "es";
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

  await notifyOrderConfirmation(order, parsed.locale);

  return { orderId: order.id, totalCents: order.totalCents };
}

async function notifyOrderConfirmation(
  order: { id: string; customerEmail: string; totalCents: number },
  pageLocale: "en" | "es",
): Promise<void> {
  const emailLogs = new DrizzleEmailLogRepository();
  let locale: "en" | "es" = pageLocale;

  try {
    const session = await auth();
    locale = session?.user.preferredLocale ?? pageLocale;
    await new SmtpNotificationAdapter().sendOrderConfirmation(order, locale);
    await emailLogs.create({ to: order.customerEmail, type: "order_confirmation", locale, status: "sent", errorMessage: null });
  } catch (err) {
    try {
      await emailLogs.create({
        to: order.customerEmail,
        type: "order_confirmation",
        locale,
        status: err instanceof SmtpNotConfiguredError ? "blocked" : "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    } catch {
      // El log de un fallo de envío es best-effort — si el propio insert
      // falla, no debe romper el checkout por un problema de logging.
    }
  }
}
