"use server";

import { z } from "zod";
import { createOrder } from "@workspace/domain/orders";
import { CapacityRejectedError, type CapacityReason } from "@workspace/domain/capacity";
import {
  DeliveryRejectedError,
  findDeliveryStop,
  type DeliveryRejectionReason,
} from "@workspace/domain/delivery-jornadas";
import {
  DrizzleOrderRepository,
  DrizzleProductRepository,
  DrizzleSettingsRepository,
  DrizzleEmailLogRepository,
  DrizzleStockRepository,
  DrizzleCapacityRepository,
  DrizzleTrailerStopRepository,
} from "@workspace/db/repositories";
import { SmtpNotificationAdapter, SmtpNotConfiguredError } from "@workspace/notifications";
import { auth } from "@/auth";
import { eligiblePickupStops } from "@/lib/pickup-stops";
import { BUSINESS_WHATSAPP } from "@/lib/business-contact";

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
    items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(10_000) })).min(1),
    locale: z.enum(["en", "es"]),
    /** Hora pedida (ISO); solo para entrega a domicilio. */
    scheduledFor: z.string().datetime().optional(),
  })
  .refine((d) => d.fulfillmentType === "self_delivery" || !d.scheduledFor, {
    path: ["scheduledFor"],
    message: "Only delivery orders can be scheduled",
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
  /** ISO 8601; solo con `self_delivery`. */
  scheduledFor?: string;
}

/** Razón de rechazo del motor de capacidad, lista para serializar al cliente. */
export interface CapacityRejectionReason {
  code: CapacityReason["code"];
  productId?: string;
  /** Nombre del producto en el idioma del pedido. */
  productName?: string;
  allowedQty?: number;
  /** ISO 8601. */
  earliestAt?: string;
  maxTrips?: number;
  neededTrips?: number;
}

export type PlaceOrderResult =
  | { ok: true; orderId: string; totalCents: number }
  /** La parada ya no acepta pedidos (no existe, terminó, se canceló o cerró). */
  | { ok: false; error: "stopUnavailable" }
  /** El stock cambió: disponible ahora por producto pedido con fila en la parada (ausente = no se vende ahí). */
  | { ok: false; error: "stockChanged"; available: { productId: string; available: number }[] }
  /** El motor de capacidad rechazó la entrega a domicilio; el carrito no se toca. */
  | { ok: false; error: "capacityRejected"; reasons: CapacityRejectionReason[]; whatsappUrl: string }
  /** Control de stock a domicilio encendido y sin jornada (o parada) abierta; el carrito no se toca. */
  | { ok: false; error: "deliveryRejected"; reasons: DeliveryRejectionReason[]; whatsappUrl: string };

const WHATSAPP_URL = `https://wa.me/${BUSINESS_WHATSAPP}`;

const STOP_UNAVAILABLE_ERRORS = ["Only pickup orders can target a stop", "Stop not found", "Stop not available"];
const STOCK_CHANGED_ERRORS = [
  "Product not available at this stop",
  "Quantity exceeds availability",
  "Product not available",
];

export async function placeOrderAction(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.parse(input);
  const stopId = parsed.fulfillmentType === "pickup" ? parsed.stopId ?? null : null;

  const settingsRepo = new DrizzleSettingsRepository();
  const settings = await settingsRepo.get();
  const deliveryFeeCents = parsed.fulfillmentType === "self_delivery" ? settings.deliveryFeeCents : 0;
  const stock = new DrizzleStockRepository();
  const stops = new DrizzleTrailerStopRepository();

  // Retiro sin parada solo cuando no hay ninguna elegible (mismo criterio que el sitio público).
  if (parsed.fulfillmentType === "pickup" && !stopId && eligiblePickupStops(await stops.listAll(), new Date()).length > 0) {
    return { ok: false, error: "stopUnavailable" };
  }

  const products = new DrizzleProductRepository();
  let order;
  try {
    order = await createOrder(
      {
        products,
        orders: new DrizzleOrderRepository(),
        stops,
        stock,
        capacity: new DrizzleCapacityRepository(),
        settings: settingsRepo,
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
        scheduledFor: parsed.scheduledFor ? new Date(parsed.scheduledFor) : null,
      },
      // "Agotado" apagado: la parada y su fila de stock se validan igual, la cantidad no se limita.
      { enforceAvailability: settings.autoSoldOutEnabled },
    );
  } catch (err) {
    if (err instanceof CapacityRejectedError) {
      return {
        ok: false,
        error: "capacityRejected",
        reasons: await toRejectionReasons(err.reasons, products, parsed.locale),
        whatsappUrl: WHATSAPP_URL,
      };
    }
    if (err instanceof DeliveryRejectedError) {
      return { ok: false, error: "deliveryRejected", reasons: err.reasons, whatsappUrl: WHATSAPP_URL };
    }
    const message = err instanceof Error ? err.message : "";
    if (stopId && STOP_UNAVAILABLE_ERRORS.includes(message)) return { ok: false, error: "stopUnavailable" };
    // Con el control a domicilio encendido, el dominio ligó la entrega a la jornada (o parada) activa:
    // se vuelve a resolver aquí porque el error no trae su id.
    const deliveryStock =
      parsed.fulfillmentType === "self_delivery" && settings.deliveryStockControlEnabled && STOCK_CHANGED_ERRORS.includes(message);
    const conflictStopId = deliveryStock ? (await findDeliveryStop(stops, settings.deliveryStockMode))?.id ?? null : stopId;
    if (deliveryStock && !conflictStopId) {
      // La jornada se cerró entre la validación y esta lectura.
      return { ok: false, error: "deliveryRejected", reasons: [{ code: "no_open_jornada" }], whatsappUrl: WHATSAPP_URL };
    }
    if (message === "Product not available" && !conflictStopId) return { ok: false, error: "stockChanged", available: [] };
    if (conflictStopId && STOCK_CHANGED_ERRORS.includes(message)) {
      // El dominio no dice qué línea falló: se devuelve el disponible actual de cada producto pedido
      // que tiene fila en la parada (los que no aparecen ya no se venden ahí).
      const rows = await stock.listByStop(conflictStopId);
      return {
        ok: false,
        error: "stockChanged",
        available: rows
          .filter((r) => parsed.items.some((item) => item.productId === r.productId))
          .map((r) => ({ productId: r.productId, available: r.currentStock })),
      };
    }
    throw err;
  }

  await notifyOrderConfirmation(order, parsed.locale);

  return { ok: true, orderId: order.id, totalCents: order.totalCents };
}

async function toRejectionReasons(
  reasons: CapacityReason[],
  products: { findById(id: string): Promise<{ nameEn: string; nameEs: string } | null> },
  locale: "en" | "es",
): Promise<CapacityRejectionReason[]> {
  // Una lectura por producto (varias razones pueden nombrar el mismo) y, si falla, la razón
  // sale sin nombre: un rechazo nunca debe convertirse en un 500 por no poder leer el catálogo.
  const names = new Map<string, Promise<string | undefined>>();
  const nameOf = (id: string) => {
    if (!names.has(id)) {
      names.set(
        id,
        products
          .findById(id)
          .then((p) => (p ? (locale === "es" ? p.nameEs : p.nameEn) : undefined))
          .catch(() => undefined),
      );
    }
    return names.get(id)!;
  };
  return Promise.all(
    reasons.map(async ({ earliestAt, productId, ...rest }) => {
      const productName = productId ? await nameOf(productId) : undefined;
      return {
        ...rest,
        ...(productId ? { productId } : {}),
        ...(productName ? { productName } : {}),
        ...(earliestAt ? { earliestAt: earliestAt.toISOString() } : {}),
      };
    }),
  );
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
