import { eq, and, or, gte, lte, ilike, asc, desc } from "drizzle-orm";
import type { Order, OrderRepository, OrderFilters } from "@workspace/domain/orders";
import { db } from "../index";
import { ordersTable, orderItemsTable } from "../schema";

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
          stopId: order.stopId,
          paymentStatus: order.paymentStatus,
          fulfillmentStatus: order.fulfillmentStatus,
          subtotalCents: order.subtotalCents,
          discountCents: order.discountCents,
          deliveryFeeCents: order.deliveryFeeCents,
          totalCents: order.totalCents,
          channel: order.channel,
          stripePaymentIntentId: order.stripePaymentIntentId,
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

  async markAsPaid(orderId: string): Promise<void> {
    await db.update(ordersTable).set({ paymentStatus: "paid" }).where(eq(ordersTable.id, orderId));
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

  async updateFulfillmentStatus(orderId: string, status: Order["fulfillmentStatus"]): Promise<void> {
    await db.update(ordersTable).set({ fulfillmentStatus: status }).where(eq(ordersTable.id, orderId));
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

  async assignDelivery(orderId: string, deliveryUserId: string): Promise<void> {
    await db
      .update(ordersTable)
      .set({ assignedDeliveryUserId: deliveryUserId, fulfillmentStatus: "out_for_delivery" })
      .where(eq(ordersTable.id, orderId));
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
