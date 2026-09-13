import { eq } from "drizzle-orm";
import type { Order, OrderRepository } from "@workspace/domain/orders";
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
}
