import { eq, and, or, gte, lte, ilike, asc, desc, isNull, notInArray, count, inArray } from "drizzle-orm";
import type {
  Order,
  OrderRepository,
  OrderFilters,
  DeliveryEvidence,
  FulfillmentStatus,
  TransitionContext,
} from "@workspace/domain/orders";
import { db } from "../index";
import { ordersTable, orderItemsTable, orderStatusEventsTable } from "../schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const MAX_BACKDATE_MS = 24 * 60 * 60 * 1000;

/** La hora informada por el cliente se respeta solo si no es futura ni anterior a 24 h. */
function resolveOccurredAt(occurredAt: Date | undefined, now: Date): Date {
  if (!occurredAt || Number.isNaN(occurredAt.getTime())) return now;
  const t = occurredAt.getTime();
  return t > now.getTime() || t < now.getTime() - MAX_BACKDATE_MS ? now : occurredAt;
}

/** Inserta el evento en la misma transacción que el UPDATE, solo si se pide registrar y el estado cambió. */
async function recordTransition(
  tx: Tx,
  orderId: string,
  kind: "fulfillment" | "payment",
  fromStatus: string | null,
  toStatus: string,
  ctx: TransitionContext | undefined,
): Promise<void> {
  if (!ctx?.record || fromStatus === toStatus) return;
  const now = new Date();
  await tx.insert(orderStatusEventsTable).values({
    orderId,
    kind,
    fromStatus,
    toStatus,
    occurredAt: resolveOccurredAt(ctx.occurredAt, now),
    recordedAt: now,
    actorUserId: ctx.actorUserId,
    source: ctx.source,
  });
}

/** Bloquea la fila del pedido y devuelve sus estados actuales (para saber si la transición cambia algo). */
async function lockOrder(tx: Tx, orderId: string) {
  const [row] = await tx
    .select({ paymentStatus: ordersTable.paymentStatus, fulfillmentStatus: ordersTable.fulfillmentStatus })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .for("update");
  return row;
}

const isOpen = () => notInArray(ordersTable.fulfillmentStatus, ["delivered", "cancelled"]);

export class DrizzleOrderRepository implements OrderRepository {
  async create(order: Omit<Order, "id">): Promise<Order> {
    return db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(ordersTable)
        .values({
          customerId: order.customerId,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          fulfillmentType: order.fulfillmentType,
          deliveryAddress: order.deliveryAddress,
          deliveryNotes: order.deliveryNotes ?? null,
          stopId: order.stopId,
          paymentStatus: order.paymentStatus,
          fulfillmentStatus: order.fulfillmentStatus,
          subtotalCents: order.subtotalCents,
          discountCents: order.discountCents,
          deliveryFeeCents: order.deliveryFeeCents,
          totalCents: order.totalCents,
          channel: order.channel,
          stripePaymentIntentId: order.stripePaymentIntentId,
          scheduledFor: order.scheduledFor ?? null,
        })
        .returning();

      if (order.items.length > 0) {
        await tx.insert(orderItemsTable).values(
          order.items.map((item) => ({
            orderId: inserted.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            lineDiscountCents: item.lineDiscountCents,
          })),
        );
      }

      return { ...inserted, items: order.items };
    });
  }

  async findById(id: string): Promise<Order | null> {
    const [row] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!row) return null;

    const itemRows = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));

    return {
      ...row,
      items: itemRows.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        lineDiscountCents: item.lineDiscountCents,
      })),
    };
  }

  async attachPaymentIntent(orderId: string, stripePaymentIntentId: string): Promise<void> {
    await db.update(ordersTable).set({ stripePaymentIntentId }).where(eq(ordersTable.id, orderId));
  }

  async markAsPaid(orderId: string, ctx?: TransitionContext, attentionReason?: string | null): Promise<void> {
    await db.transaction(async (tx) => {
      const current = await lockOrder(tx, orderId);
      if (!current) return;
      await tx
        .update(ordersTable)
        .set(attentionReason === undefined ? { paymentStatus: "paid" } : { paymentStatus: "paid", attentionReason })
        .where(eq(ordersTable.id, orderId));
      await recordTransition(tx, orderId, "payment", current.paymentStatus, "paid", ctx);
    });
  }

  async listAll(filters: OrderFilters): Promise<Order[]> {
    const conditions = [];
    if (filters.fulfillmentStatus) conditions.push(eq(ordersTable.fulfillmentStatus, filters.fulfillmentStatus));
    if (filters.paymentStatus) conditions.push(eq(ordersTable.paymentStatus, filters.paymentStatus));
    if (filters.channel) conditions.push(eq(ordersTable.channel, filters.channel));
    if (filters.dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(filters.dateFrom)));
    if (filters.dateTo) conditions.push(lte(ordersTable.createdAt, new Date(filters.dateTo)));
    if (filters.search) {
      conditions.push(
        or(
          ilike(ordersTable.customerName, `%${filters.search}%`),
          ilike(ordersTable.customerEmail, `%${filters.search}%`),
        ),
      );
    }

    const sortColumn = filters.sortBy === "totalCents" ? ordersTable.totalCents : ordersTable.createdAt;
    const sortFn = filters.sortDir === "asc" ? asc : desc;

    const rows = await db
      .select()
      .from(ordersTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sortFn(sortColumn));

    return Promise.all(rows.map((row) => this.attachItems(row)));
  }

  async listByCustomerId(customerId: string): Promise<Order[]> {
    const rows = await db.select().from(ordersTable).where(eq(ordersTable.customerId, customerId));
    return Promise.all(rows.map((row) => this.attachItems(row)));
  }

  async updateFulfillmentStatus(orderId: string, status: FulfillmentStatus, ctx?: TransitionContext): Promise<void> {
    await db.transaction(async (tx) => {
      const current = await lockOrder(tx, orderId);
      if (!current) return;
      await tx.update(ordersTable).set({ fulfillmentStatus: status }).where(eq(ordersTable.id, orderId));
      await recordTransition(tx, orderId, "fulfillment", current.fulfillmentStatus, status, ctx);
    });
  }

  async updatePaymentStatus(orderId: string, status: Order["paymentStatus"]): Promise<void> {
    await db.update(ordersTable).set({ paymentStatus: status }).where(eq(ordersTable.id, orderId));
  }

  async findQueueForDespachador(): Promise<Order[]> {
    const rows = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.paymentStatus, "paid"),
          isNull(ordersTable.attentionReason),
          or(
            eq(ordersTable.fulfillmentStatus, "received"),
            eq(ordersTable.fulfillmentStatus, "in_prep"),
            eq(ordersTable.fulfillmentStatus, "ready_for_pickup"),
          ),
        ),
      )
      .orderBy(asc(ordersTable.createdAt));
    return Promise.all(rows.map((row) => this.attachItems(row)));
  }

  async findAssignedToDelivery(deliveryUserId: string): Promise<Order[]> {
    const rows = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.assignedDeliveryUserId, deliveryUserId),
          eq(ordersTable.fulfillmentStatus, "out_for_delivery"),
        ),
      )
      .orderBy(asc(ordersTable.createdAt));
    return Promise.all(rows.map((row) => this.attachItems(row)));
  }

  async assignDelivery(orderId: string, deliveryUserId: string, ctx?: TransitionContext): Promise<void> {
    await db.transaction(async (tx) => {
      const current = await lockOrder(tx, orderId);
      if (!current) return;
      await tx
        .update(ordersTable)
        .set({ assignedDeliveryUserId: deliveryUserId, fulfillmentStatus: "out_for_delivery" })
        .where(eq(ordersTable.id, orderId));
      // El actor es quien asigna (ctx.actorUserId), no el repartidor asignado.
      await recordTransition(tx, orderId, "fulfillment", current.fulfillmentStatus, "out_for_delivery", ctx);
    });
  }

  async recordDeliveryEvidence(orderId: string, evidence: DeliveryEvidence): Promise<void> {
    await db
      .update(ordersTable)
      .set({
        deliveryEvidenceKey: evidence.key,
        deliveryEvidenceCapturedAt: evidence.capturedAt,
        deliveryEvidenceLat: evidence.lat,
        deliveryEvidenceLng: evidence.lng,
      })
      .where(eq(ordersTable.id, orderId));
  }

  async resolveAttention(orderId: string, ctx?: TransitionContext): Promise<void> {
    await db.transaction(async (tx) => {
      const current = await lockOrder(tx, orderId);
      if (!current) return;
      // Entre la lectura del dominio y este bloqueo el pedido pudo cancelarse: no se resucita.
      if (current.fulfillmentStatus !== "pending") {
        throw new Error(`Cannot resolve attention from status: ${current.fulfillmentStatus}`);
      }
      await tx
        .update(ordersTable)
        .set({ attentionReason: null, fulfillmentStatus: "received" })
        .where(eq(ordersTable.id, orderId));
      await recordTransition(tx, orderId, "fulfillment", current.fulfillmentStatus, "received", ctx);
    });
  }

  async cancelPendingOrdersForStop(stopId: string, ctx?: TransitionContext): Promise<number> {
    return db.transaction(async (tx) => {
      const pending = await tx
        .select({ id: ordersTable.id, fulfillmentStatus: ordersTable.fulfillmentStatus })
        .from(ordersTable)
        .where(and(eq(ordersTable.stopId, stopId), eq(ordersTable.paymentStatus, "pending"), isOpen()))
        .orderBy(asc(ordersTable.id))
        .for("update");
      if (pending.length === 0) return 0;
      await tx
        .update(ordersTable)
        .set({ fulfillmentStatus: "cancelled" })
        .where(inArray(ordersTable.id, pending.map((o) => o.id)));
      for (const o of pending) {
        await recordTransition(tx, o.id, "fulfillment", o.fulfillmentStatus, "cancelled", ctx);
      }
      return pending.length;
    });
  }

  async countPaidUndeliveredForStop(stopId: string): Promise<number> {
    const [row] = await db
      .select({ n: count() })
      .from(ordersTable)
      .where(and(eq(ordersTable.stopId, stopId), eq(ordersTable.paymentStatus, "paid"), isOpen()));
    return row.n;
  }

  async countUndeliveredForStop(stopId: string): Promise<number> {
    const [row] = await db
      .select({ n: count() })
      .from(ordersTable)
      .where(and(eq(ordersTable.stopId, stopId), isOpen()));
    return row.n;
  }

  private async attachItems(row: typeof ordersTable.$inferSelect): Promise<Order> {
    const itemRows = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, row.id));
    return {
      ...row,
      items: itemRows.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        lineDiscountCents: item.lineDiscountCents,
      })),
    };
  }
}
