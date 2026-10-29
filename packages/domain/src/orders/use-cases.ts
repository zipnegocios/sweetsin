import type { ProductRepository } from "../products/ports";
import type { OrderRepository, NewOrderInput, OrderFilters, DeliveryEvidence, TransitionContext } from "./ports";
import type { Order, OrderItem, FulfillmentStatus } from "./entities";
import { getDiscountedUnitPriceCents } from "../pricing/volume-discount";
import type { StockRepository } from "../stock/ports";
import type { TrailerStopRepository } from "../trailer-stops/ports";
import type { StaffNotificationPort } from "../notifications";
import type { CapacityRepository } from "../capacity/ports";
import { CapacityRejectedError } from "../capacity/errors";
import { evaluateDeliveryOrder } from "../capacity/evaluate";
import type { UserRepository } from "../users/ports";
import { listActiveStaff } from "../users/use-cases";
import type { AppSettings, SettingsRepository } from "../settings";
import { DeliveryRejectedError } from "../delivery-jornadas/errors";
import { findDeliveryStop } from "../delivery-jornadas/use-cases";

export async function createOrder(
  deps: {
    products: ProductRepository;
    orders: OrderRepository;
    stops?: TrailerStopRepository;
    stock?: StockRepository;
    capacity?: CapacityRepository;
    settings?: SettingsRepository;
  },
  input: NewOrderInput,
  /** `enforceAvailability: false` (Settings.autoSoldOutEnabled apagado) no limita la cantidad al stock. */
  options: { enforceAvailability?: boolean } = {},
): Promise<Order> {
  if (input.items.length === 0) {
    throw new Error("Order must have at least one item");
  }
  const enforceAvailability = options.enforceAvailability ?? true;
  // Con el control de stock a domicilio encendido, la parada de una entrega la resuelve el servidor
  // (más abajo); el stopId del cliente se ignora. Apagado, todo sigue como antes.
  const deliveryStockMode =
    input.fulfillmentType === "self_delivery" && deps.settings ? await deliveryStockControlMode(deps.settings) : null;
  if (input.stopId !== null && !deliveryStockMode) {
    await assertStopCanFulfill(deps, input.stopId, input, enforceAvailability);
  }

  const items: OrderItem[] = [];
  let subtotalCents = 0;
  let discountCents = 0;

  for (const line of input.items) {
    const product = await deps.products.findById(line.productId);
    if (!product) throw new Error(`Product not found: ${line.productId}`);
    if (!product.available) throw new Error("Product not available");

    const unitPriceCents = product.priceCents;
    const discountedUnitCents = getDiscountedUnitPriceCents(unitPriceCents, line.quantity, product.category);
    const lineDiscountCents = (unitPriceCents - discountedUnitCents) * line.quantity;

    items.push({
      productId: product.id,
      quantity: line.quantity,
      unitPriceCents,
      lineDiscountCents,
    });

    subtotalCents += unitPriceCents * line.quantity;
    discountCents += lineDiscountCents;
  }

  // La hora pedida solo se guarda si el motor la evaluó (encendido); si no, no tiene significado.
  let scheduledFor: Date | null = null;
  if (input.fulfillmentType === "self_delivery" && deps.capacity) {
    if (await assertDeliveryCapacity(deps.capacity, input)) scheduledFor = input.scheduledFor ?? null;
  }

  // Orden de evaluación: producto disponible → capacidad → jornada/parada → stock.
  const stopId = deliveryStockMode
    ? await resolveDeliveryStop(deps, deliveryStockMode, input)
    : input.stopId;

  const totalCents = subtotalCents - discountCents + input.deliveryFeeCents;

  return deps.orders.create({
    customerId: input.customerId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    fulfillmentType: input.fulfillmentType,
    deliveryAddress: input.deliveryAddress,
    deliveryNotes: input.deliveryNotes,
    stopId,
    paymentStatus: "pending",
    fulfillmentStatus: "pending",
    subtotalCents,
    discountCents,
    deliveryFeeCents: input.deliveryFeeCents,
    totalCents,
    channel: input.channel,
    stripePaymentIntentId: null,
    assignedDeliveryUserId: null,
    scheduledFor,
    items,
  });
}

// El servidor es la autoridad: con el motor apagado no se evalúa nada.
/** Devuelve si el motor evaluó (true) o estaba apagado (false). */
async function assertDeliveryCapacity(capacity: CapacityRepository, input: NewOrderInput): Promise<boolean> {
  const settings = await capacity.getSettings();
  if (!settings.capacityEngineEnabled) return false;
  const [rules, steps] = await Promise.all([capacity.listRules(), capacity.listSteps()]);
  const stepsByProduct = new Map<string, typeof steps>();
  for (const step of steps) stepsByProduct.set(step.productId, [...(stepsByProduct.get(step.productId) ?? []), step]);
  const result = evaluateDeliveryOrder({
    lines: input.items,
    rules: new Map(rules.map((r) => [r.productId, r])),
    steps: stepsByProduct,
    settings,
    now: new Date(),
    scheduledFor: input.scheduledFor ?? null,
  });
  if (!result.ok) throw new CapacityRejectedError(result.reasons);
  return true;
}

// Valida un pedido de retiro contra la parada elegida: tipo, estado, vigencia, fila de stock y (si se exige) cantidad.
// Es una revalidación al crear; el descuento real (todo o nada) ocurre al confirmar el pago.
async function assertStopCanFulfill(
  deps: { stops?: TrailerStopRepository; stock?: StockRepository },
  stopId: string,
  input: NewOrderInput,
  enforceAvailability: boolean,
): Promise<void> {
  if (input.fulfillmentType !== "pickup") throw new Error("Only pickup orders can target a stop");
  if (!deps.stops || !deps.stock) throw new Error("Stop validation requires stops and stock repositories");
  const stop = await deps.stops.findById(stopId);
  if (!stop) throw new Error("Stop not found");
  // Una parada activa acepta pedidos hasta que se cierra, aunque haya pasado su hora de fin;
  // una programada (pre-pedido) solo mientras no terminó. Una jornada de delivery nunca acepta retiros.
  const open =
    stop.kind !== "delivery" &&
    (stop.status === "active" || (stop.status === "scheduled" && stop.endTime.getTime() > Date.now()));
  if (!open) throw new Error("Stop not available");
  await assertStockLines(deps.stock, stopId, input, enforceAvailability);
}

async function assertStockLines(
  stock: StockRepository,
  stopId: string,
  input: NewOrderInput,
  enforceAvailability: boolean,
): Promise<void> {
  // Las líneas repetidas de un producto se suman antes de comparar (igual que el motor de capacidad).
  const totals = new Map<string, number>();
  for (const line of input.items) totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.quantity);
  for (const [productId, quantity] of totals) {
    const row = await stock.findByStopAndProduct(stopId, productId);
    if (!row) throw new Error("Product not available at this stop");
    if (enforceAvailability && quantity > row.currentStock) throw new Error("Quantity exceeds availability");
  }
}

/** Modo del control de stock a domicilio, o null si está apagado. */
async function deliveryStockControlMode(settings: SettingsRepository): Promise<AppSettings["deliveryStockMode"] | null> {
  const s = await settings.get();
  return s.deliveryStockControlEnabled ? s.deliveryStockMode : null;
}

// Resuelve la parada con findDeliveryStop, devuelve su id para ligar el pedido y valida las líneas
// contra su stock (revalidación; el descuento todo o nada ocurre al confirmar el pago, igual que el retiro).
// La cantidad se valida siempre contra el stock (spec §7.3), aunque `enforceAvailability` esté apagado:
// la jornada existe justamente para no prometer a domicilio más de lo alistado.
async function resolveDeliveryStop(
  deps: { stops?: TrailerStopRepository; stock?: StockRepository },
  mode: AppSettings["deliveryStockMode"],
  input: NewOrderInput,
): Promise<string> {
  if (!deps.stops || !deps.stock) throw new Error("Delivery stock control requires stops and stock repositories");
  const stop = await findDeliveryStop(deps.stops, mode);
  if (!stop) throw new DeliveryRejectedError([{ code: "no_open_jornada" }]);
  await assertStockLines(deps.stock, stop.id, input, true);
  return stop.id;
}

function stockLines(order: Order): { productId: string; quantity: number }[] {
  return order.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
}

export async function confirmOrderPayment(
  deps: {
    orders: OrderRepository;
    stock: StockRepository;
    stops?: TrailerStopRepository;
    users?: UserRepository;
    notifications?: StaffNotificationPort;
  },
  orderId: string,
  ctx?: TransitionContext,
): Promise<void> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.paymentStatus === "paid") return; // Stripe puede reenviar el mismo evento de webhook más de una vez.
  // Pago tardío de un pedido ya cancelado: se registra, sin descontar stock ni encolar; queda para reembolso manual.
  if (order.fulfillmentStatus === "cancelled") return deps.orders.markAsPaid(orderId, ctx, "order_cancelled");

  if (order.stopId) {
    // Sin el repositorio de paradas no se puede aplicar la regla de parada cancelada: error de cableado.
    if (!deps.stops) throw new Error("Stops repository is required to confirm a stop order");
    // Pagado pero fuera de la cola, sin notificar: el admin decide (reintentar, cancelar o resolver).
    // Pago y motivo van en una sola escritura: un fallo a mitad no deja un pagado invisible.
    const holdForAttention = (reason: string) => deps.orders.markAsPaid(orderId, ctx, reason);
    const stop = await deps.stops.findById(order.stopId);
    if (stop?.status === "cancelled") return holdForAttention("stop_cancelled");
    // Todo o nada, antes de pasar a received: si una línea no alcanza no se descuenta ninguna.
    const result = await deps.stock.decrementForOrder(order.stopId, orderId, stockLines(order));
    if (!result.ok) return holdForAttention(`insufficient_stock:${result.productId}`);
  }

  await deps.orders.markAsPaid(orderId, ctx);

  if (order.fulfillmentStatus !== "pending") return;
  await deps.orders.updateFulfillmentStatus(orderId, "received", ctx);

  if (deps.users && deps.notifications) {
    try {
      const staff = await listActiveStaff(deps.users, "despachador");
      await deps.notifications.notifyNewOrderInQueue(
        staff.map((u) => u.id),
        { id: order.id, customerName: order.customerName },
      );
    } catch {
      // Un fallo de push nunca bloquea la confirmacion del pago.
    }
  }
}

async function requireAttentionOrder(orders: OrderRepository, orderId: string): Promise<Order> {
  const order = await orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (!order.attentionReason) throw new Error("Order does not require attention");
  if (order.fulfillmentStatus !== "pending") {
    throw new Error(`Cannot resolve attention from status: ${order.fulfillmentStatus}`);
  }
  return order;
}

/** Reintenta el descuento todo o nada de un pedido en atención (p. ej. tras reponer stock). */
export async function retryOrderStock(
  deps: { orders: OrderRepository; stock: StockRepository; stops: TrailerStopRepository },
  orderId: string,
  ctx?: TransitionContext,
): Promise<Order> {
  const order = await requireAttentionOrder(deps.orders, orderId);
  if (!order.stopId) throw new Error("Order has no stop");
  if ((await deps.stops.findById(order.stopId))?.status === "cancelled") throw new Error("Stop is cancelled");
  const result = await deps.stock.decrementForOrder(order.stopId, orderId, stockLines(order));
  if (!result.ok) throw new Error("Stock still insufficient");
  await deps.orders.resolveAttention(orderId, ctx);
  return { ...order, attentionReason: null, fulfillmentStatus: "received" };
}

/** El admin marca resuelto un pedido en atención: entra a la cola sin tocar stock. */
export async function resolveOrderAttention(
  deps: { orders: OrderRepository },
  orderId: string,
  ctx?: TransitionContext,
): Promise<Order> {
  const order = await requireAttentionOrder(deps.orders, orderId);
  await deps.orders.resolveAttention(orderId, ctx);
  return { ...order, attentionReason: null, fulfillmentStatus: "received" };
}

export async function listOrders(repo: OrderRepository, filters: OrderFilters): Promise<Order[]> {
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    throw new Error("dateFrom must not be after dateTo");
  }
  return repo.listAll(filters);
}

export async function markOrderInPrep(
  deps: { orders: OrderRepository },
  orderId: string,
  ctx?: TransitionContext,
): Promise<Order> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.fulfillmentStatus !== "received") {
    throw new Error(`Cannot move to in_prep from status: ${order.fulfillmentStatus}`);
  }
  await deps.orders.updateFulfillmentStatus(orderId, "in_prep", ctx);
  return { ...order, fulfillmentStatus: "in_prep" };
}

export async function markOrderReady(
  deps: { orders: OrderRepository },
  orderId: string,
  ctx?: TransitionContext,
): Promise<Order> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.fulfillmentStatus !== "in_prep") {
    throw new Error(`Cannot move to ready_for_pickup from status: ${order.fulfillmentStatus}`);
  }
  await deps.orders.updateFulfillmentStatus(orderId, "ready_for_pickup", ctx);
  return { ...order, fulfillmentStatus: "ready_for_pickup" };
}

export async function assignDeliveryToOrder(
  deps: { orders: OrderRepository; users: UserRepository; notifications?: StaffNotificationPort },
  orderId: string,
  deliveryUserId: string,
  ctx?: TransitionContext,
): Promise<Order> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.fulfillmentStatus !== "ready_for_pickup") {
    throw new Error(`Cannot assign delivery from status: ${order.fulfillmentStatus}`);
  }
  const deliveryUser = await deps.users.findById(deliveryUserId);
  if (!deliveryUser || deliveryUser.role !== "delivery" || !deliveryUser.isActive) {
    throw new Error(`Invalid delivery user: ${deliveryUserId}`);
  }
  await deps.orders.assignDelivery(orderId, deliveryUserId, ctx);
  const updated: Order = { ...order, assignedDeliveryUserId: deliveryUserId, fulfillmentStatus: "out_for_delivery" };

  if (deps.notifications) {
    try {
      await deps.notifications.notifyDeliveryAssigned(deliveryUserId, updated);
    } catch {
      // Un fallo de push nunca bloquea la asignacion — el intento ya quedo
      // registrado por el propio adaptador en push_logs.
    }
  }

  return updated;
}

export async function markOrderDelivered(
  deps: { orders: OrderRepository },
  orderId: string,
  actingUserId: string,
  ctx?: TransitionContext,
): Promise<Order> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  // Idempotente: un reintento offline del mismo delivery sobre una orden ya entregada es un no-op.
  if (order.fulfillmentStatus === "delivered" && order.assignedDeliveryUserId === actingUserId) {
    return order;
  }
  if (order.fulfillmentStatus !== "out_for_delivery") {
    throw new Error(`Cannot mark delivered from status: ${order.fulfillmentStatus}`);
  }
  if (order.assignedDeliveryUserId !== actingUserId) {
    throw new Error("Only the assigned delivery user can mark this order as delivered");
  }
  await deps.orders.updateFulfillmentStatus(orderId, "delivered", ctx);
  return { ...order, fulfillmentStatus: "delivered" };
}

/** Entrega en mostrador de un pedido de retiro: no requiere repartidor asignado. */
export async function markPickupDelivered(
  deps: { orders: OrderRepository },
  orderId: string,
  ctx?: TransitionContext,
): Promise<Order> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.fulfillmentType !== "pickup") throw new Error("Only pickup orders can be handed over");
  if (order.fulfillmentStatus !== "ready_for_pickup") {
    throw new Error(`Cannot mark delivered from status: ${order.fulfillmentStatus}`);
  }
  await deps.orders.updateFulfillmentStatus(orderId, "delivered", ctx);
  return { ...order, fulfillmentStatus: "delivered" };
}

export async function recordDeliveryEvidence(
  deps: { orders: OrderRepository },
  orderId: string,
  actingUserId: string,
  evidence: DeliveryEvidence,
): Promise<void> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.assignedDeliveryUserId !== actingUserId) {
    throw new Error("Only the assigned delivery user can record evidence for this order");
  }
  if (order.fulfillmentStatus !== "out_for_delivery" && order.fulfillmentStatus !== "delivered") {
    throw new Error(`Cannot record delivery evidence from status: ${order.fulfillmentStatus}`);
  }
  if (!(evidence.lat >= -90 && evidence.lat <= 90)) throw new Error("Latitude out of range");
  if (!(evidence.lng >= -180 && evidence.lng <= 180)) throw new Error("Longitude out of range");
  if (!evidence.key) throw new Error("Evidence key is required");
  await deps.orders.recordDeliveryEvidence(orderId, evidence);
}

const ALLOWED_TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  pending: ["received", "cancelled"],
  received: ["in_prep", "cancelled"],
  in_prep: ["ready_for_pickup", "cancelled"],
  // `delivered` directo solo para retiro; el delivery a domicilio lo rechaza markOrderDelivered.
  ready_for_pickup: ["out_for_delivery", "delivered", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export async function changeOrderFulfillmentStatus(
  deps: {
    orders: OrderRepository;
    users: UserRepository;
    notifications?: StaffNotificationPort;
    stock?: StockRepository;
  },
  orderId: string,
  target: FulfillmentStatus,
  options?: { deliveryUserId?: string; ctx?: TransitionContext },
): Promise<Order> {
  const ctx = options?.ctx;
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.fulfillmentStatus === target) return order;
  if (!ALLOWED_TRANSITIONS[order.fulfillmentStatus].includes(target)) {
    throw new Error(`Invalid transition: ${order.fulfillmentStatus} → ${target}`);
  }
  // Un pedido en atención solo sale por retryOrderStock, resolveOrderAttention o cancelándolo.
  if (order.attentionReason && target !== "cancelled") throw new Error("Order requires attention");

  switch (target) {
    case "in_prep":
      return markOrderInPrep(deps, orderId, ctx);
    case "ready_for_pickup":
      return markOrderReady(deps, orderId, ctx);
    case "out_for_delivery":
      if (!options?.deliveryUserId) throw new Error("A delivery user is required for out_for_delivery");
      return assignDeliveryToOrder(deps, orderId, options.deliveryUserId, ctx);
    case "delivered":
      if (order.fulfillmentType === "pickup") return markPickupDelivered(deps, orderId, ctx);
      if (!order.assignedDeliveryUserId) throw new Error("Order has no assigned delivery user");
      return markOrderDelivered(deps, orderId, order.assignedDeliveryUserId, ctx);
    case "cancelled":
      // Se revierte antes de cancelar; reverseOrderSale es idempotente (sin ventas no hace nada),
      // así que se llama siempre que haya parada, sin mirar pago ni atención.
      if (order.stopId) {
        // Sin el repositorio de stock la reversa se perdería en silencio: error de cableado.
        if (!deps.stock) throw new Error("Stock repository is required to cancel a paid stop order");
        await deps.stock.reverseOrderSale(orderId);
      }
      await deps.orders.updateFulfillmentStatus(orderId, "cancelled", ctx);
      return { ...order, fulfillmentStatus: "cancelled" };
    default:
      await deps.orders.updateFulfillmentStatus(orderId, target, ctx);
      return { ...order, fulfillmentStatus: target };
  }
}

const ORDER_CONFLICT_MESSAGES = [
  "Only pickup orders can target a stop",
  "Stop not found",
  "Stop not available",
  "Product not available at this stop",
  "Quantity exceeds availability",
  "Only pickup orders can be handed over",
  "Order does not require attention",
  "Order has no stop",
  "Stock still insufficient",
  "Stop is cancelled",
  "Product not available",
  "Order requires attention",
  "A delivery user is required for out_for_delivery",
  "Order has no assigned delivery user",
  "Only the assigned delivery user can mark this order as delivered",
];

// Mensajes de transición que llevan el estado (o el par de estados) al final.
const ORDER_CONFLICT_PREFIXES = [
  "Invalid transition: ",
  "Cannot move to in_prep from status: ",
  "Cannot move to ready_for_pickup from status: ",
  "Cannot assign delivery from status: ",
  "Cannot mark delivered from status: ",
  "Cannot resolve attention from status: ",
  "Invalid delivery user: ",
];

/** Mensajes de reglas de negocio de pedidos que los adaptadores traducen a 409. */
export function isOrderConflictMessage(message: string): boolean {
  return (
    ORDER_CONFLICT_MESSAGES.includes(message) ||
    ORDER_CONFLICT_PREFIXES.some((prefix) => message.startsWith(prefix))
  );
}
