"use server";

import { z } from "zod";
import { createOrder } from "@workspace/domain/orders";
import {
  DrizzleOrderRepository,
  DrizzleProductRepository,
  DrizzleSettingsRepository,
  DrizzleEmailLogRepository,
  DrizzleStockRepository,
  DrizzleTrailerStopRepository,
} from "@workspace/db/repositories";
import { SmtpNotificationAdapter, SmtpNotConfiguredError } from "@workspace/notifications";
import { auth } from "@/auth";

const checkoutSchema = z
  .object({
    fulfillmentType: z.enum(["pickup", "self_delivery"]),
    deliveryAddress: z.string().trim().min(1).optional(),
    deliveryNotes: z.string().trim().max(500).optional(),
    stopId: z.string().uuid().nullish(),
    name: z.string().trim().min(1),
    phone: z.string().trim().min(1),
    email: z.string().trim().email(),
    channel: z.enum(["web", "whatsapp"]),
    items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1) })).min(1),
    locale: z.enum(["en", "es"]),
  })
  .refine((d) => d.fulfillmentType === "pickup" || !d.stopId, {
    path: ["stopId"],
    message: "Only pickup orders can target a stop",
  });

export interface PlaceOrderInput {
  fulfillmentType: "pickup" | "self_delivery";
  deliveryAddress?: string;
  deliveryNotes?: string;
  /** Parada de retiro elegida; solo con `pickup`. */
  stopId?: string | null;
  name: string;
  phone: string;
  email: string;
  channel: "web" | "whatsapp";
  items: { productId: string; quantity: number }[];
  locale: "en" | "es";
}

export type PlaceOrderResult =
  | { ok: true; orderId: string; totalCents: number }
  /** La parada ya no acepta pedidos (no existe, terminó, se canceló o cerró). */
  | { ok: false; error: "stopUnavailable" }
  /** El stock cambió: máximo disponible ahora por producto pedido (0 = no se vende en esa parada). */
  | { ok: false; error: "stockChanged"; available: { productId: string; available: number }[] };

const STOP_UNAVAILABLE_ERRORS = ["Only pickup orders can target a stop", "Stop not found", "Stop not available"];
const STOCK_CHANGED_ERRORS = ["Product not available at this stop", "Quantity exceeds availability"];

export async function placeOrderAction(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.parse(input);
  const stopId = parsed.fulfillmentType === "pickup" ? parsed.stopId ?? null : null;

  const settings = await new DrizzleSettingsRepository().get();
  const deliveryFeeCents = parsed.fulfillmentType === "self_delivery" ? settings.deliveryFeeCents : 0;
  const stock = new DrizzleStockRepository();

  let order;
  try {
    order = await createOrder(
      {
        products: new DrizzleProductRepository(),
        orders: new DrizzleOrderRepository(),
        stops: new DrizzleTrailerStopRepository(),
        stock,
      },
      {
        customerId: null,
        customerName: parsed.name,
        customerEmail: parsed.email,
        customerPhone: parsed.phone,
        fulfillmentType: parsed.fulfillmentType,
        deliveryAddress: parsed.deliveryAddress ?? null,
        deliveryNotes: parsed.fulfillmentType === "self_delivery" ? parsed.deliveryNotes || null : null,
        stopId,
        deliveryFeeCents,
        channel: parsed.channel,
        items: parsed.items,
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (stopId && STOP_UNAVAILABLE_ERRORS.includes(message)) return { ok: false, error: "stopUnavailable" };
    if (stopId && STOCK_CHANGED_ERRORS.includes(message)) {
      // El dominio no dice qué línea falló: se devuelve el disponible actual de cada producto pedido.
      const rows = await stock.listByStop(stopId);
      return {
        ok: false,
        error: "stockChanged",
        available: parsed.items.map((item) => ({
          productId: item.productId,
          available: rows.find((r) => r.productId === item.productId)?.currentStock ?? 0,
        })),
      };
    }
    throw err;
  }

  await notifyOrderConfirmation(order, parsed.locale);

  return { ok: true, orderId: order.id, totalCents: order.totalCents };
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
