import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Order, TransitionContext } from "@workspace/domain/orders";
import { createOrder } from "@workspace/domain/orders";
import { DrizzleProductRepository } from "./product-repository";
import { DrizzleOrderRepository } from "./order-repository";
import { DrizzleUserRepository } from "./user-repository";
import { DrizzleTrailerStopRepository } from "./trailer-stop-repository";
import { db } from "../index";
import { eq, inArray } from "drizzle-orm";
import { productsTable, ordersTable, orderItemsTable, orderStatusEventsTable, usersTable } from "../schema";

const minimalOrderInput: Omit<Order, "id"> = {
  customerId: null,
  customerName: "Test",
  customerEmail: `test-${Date.now()}@example.com`,
  customerPhone: "+61400000000",
  fulfillmentType: "pickup",
  deliveryAddress: null,
  stopId: null,
  paymentStatus: "pending",
  fulfillmentStatus: "pending",
  subtotalCents: 0,
  discountCents: 0,
  deliveryFeeCents: 0,
  totalCents: 0,
  channel: "web",
  stripePaymentIntentId: null,
  assignedDeliveryUserId: null,
  items: [],
};

describe("DrizzleOrderRepository", () => {
  let productId: string;

  beforeAll(async () => {
    const [product] = await db
      .insert(productsTable)
      .values({
        slug: `test-product-${Date.now()}`,
        category: "sin",
        nameEn: "Test Product",
        nameEs: "Producto de Prueba",
        descriptionEn: "Test",
        descriptionEs: "Prueba",
        priceCents: 1300,
      })
      .returning();
    productId = product.id;
  });

  it("creates an order end-to-end against the real database", async () => {
    const products = new DrizzleProductRepository();
    const orders = new DrizzleOrderRepository();

    const order = await createOrder(
      { products, orders },
      {
        customerId: null,
        customerName: "Jane Doe",
        customerEmail: "jane@example.com",
        customerPhone: "+61400000000",
        fulfillmentType: "pickup",
        deliveryAddress: null,
        deliveryNotes: null,
        stopId: null,
        deliveryFeeCents: 0,
        channel: "web",
        items: [{ productId, quantity: 2 }],
      },
    );

    expect(order.id).toBeTruthy();
    expect(order.totalCents).toBe(2600);
    expect(order.items).toHaveLength(1);

    const found = await orders.findById(order.id);
    expect(found?.totalCents).toBe(2600);
    expect(found?.items).toHaveLength(1);
  });

  it("persiste deliveryNotes y las devuelve al leer la orden", async () => {
    const orders = new DrizzleOrderRepository();
    const order = await createOrder(
      { products: new DrizzleProductRepository(), orders },
      {
        customerId: null,
        customerName: "TEST-notas-entrega",
        customerEmail: `test-notas-entrega-${Date.now()}@example.com`,
        customerPhone: "+61400000000",
        fulfillmentType: "self_delivery",
        deliveryAddress: "1 Test St, Test",
        deliveryNotes: "Portón azul, llamar al llegar",
        stopId: null,
        deliveryFeeCents: 500,
        channel: "web",
        items: [{ productId, quantity: 1 }],
      },
    );

    try {
      const found = await orders.findById(order.id);
      expect(found?.deliveryNotes).toBe("Portón azul, llamar al llegar");
    } finally {
      await db.delete(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
      await db.delete(ordersTable).where(eq(ordersTable.id, order.id));
    }
  });

  it("attaches a payment intent and marks the order as paid", async () => {
    const products = new DrizzleProductRepository();
    const orders = new DrizzleOrderRepository();

    const order = await createOrder(
      { products, orders },
      {
        customerId: null,
        customerName: "Jane Doe",
        customerEmail: "jane@example.com",
        customerPhone: "+61400000000",
        fulfillmentType: "pickup",
        deliveryAddress: null,
        deliveryNotes: null,
        stopId: null,
        deliveryFeeCents: 0,
        channel: "web",
        items: [{ productId, quantity: 1 }],
      },
    );

    await orders.attachPaymentIntent(order.id, "pi_test_123");
    await orders.markAsPaid(order.id);

    const found = await orders.findById(order.id);
    expect(found?.stripePaymentIntentId).toBe("pi_test_123");
    expect(found?.paymentStatus).toBe("paid");
  });

  it("lists orders filtered by fulfillment status and sorted by total", async () => {
    // Dos createOrder + dos listAll contra el Postgres remoto — más
    // round-trips que el resto de los tests, supera el timeout default.
    const products = new DrizzleProductRepository();
    const orders = new DrizzleOrderRepository();

    const orderA = await createOrder(
      { products, orders },
      {
        customerId: null,
        customerName: "List Test A",
        customerEmail: `list-test-a-${Date.now()}@example.com`,
        customerPhone: "+61400000001",
        fulfillmentType: "pickup",
        deliveryAddress: null,
        deliveryNotes: null,
        stopId: null,
        deliveryFeeCents: 0,
        channel: "web",
        items: [{ productId, quantity: 1 }],
      },
    );
    const orderB = await createOrder(
      { products, orders },
      {
        customerId: null,
        customerName: "List Test B",
        customerEmail: `list-test-b-${Date.now()}@example.com`,
        customerPhone: "+61400000002",
        fulfillmentType: "pickup",
        deliveryAddress: null,
        deliveryNotes: null,
        stopId: null,
        deliveryFeeCents: 0,
        channel: "whatsapp",
        items: [{ productId, quantity: 3 }],
      },
    );

    const webOnly = await orders.listAll({ channel: "web" });
    expect(webOnly.some((o) => o.id === orderA.id)).toBe(true);
    expect(webOnly.some((o) => o.id === orderB.id)).toBe(false);

    const bySearch = await orders.listAll({ search: "List Test B" });
    expect(bySearch.map((o) => o.id)).toContain(orderB.id);
    expect(bySearch.map((o) => o.id)).not.toContain(orderA.id);
  }, 15000);

  it("updates fulfillment and payment status independently", async () => {
    const products = new DrizzleProductRepository();
    const orders = new DrizzleOrderRepository();

    const order = await createOrder(
      { products, orders },
      {
        customerId: null,
        customerName: "Status Test",
        customerEmail: `status-test-${Date.now()}@example.com`,
        customerPhone: "+61400000003",
        fulfillmentType: "pickup",
        deliveryAddress: null,
        deliveryNotes: null,
        stopId: null,
        deliveryFeeCents: 0,
        channel: "web",
        items: [{ productId, quantity: 1 }],
      },
    );

    await orders.updateFulfillmentStatus(order.id, "in_prep");
    await orders.updatePaymentStatus(order.id, "paid");

    const found = await orders.findById(order.id);
    expect(found?.fulfillmentStatus).toBe("in_prep");
    expect(found?.paymentStatus).toBe("paid");
  });

  it("lists orders for a given customerId", async () => {
    const products = new DrizzleProductRepository();
    const orders = new DrizzleOrderRepository();

    // orders.customer_id es una foreign key real hacia users.id (nullable,
    // pero FK igual) — hace falta una fila real de users, un UUID
    // inventado rompe con una violación de FK.
    const users = new DrizzleUserRepository();
    const customer = await users.create({
      name: "Customer History Test",
      email: `history-test-${Date.now()}@example.com`,
      role: "customer",
      pinHash: null,
      passwordHash: null,
      isActive: true,
      preferredLocale: "en",
      failedPinAttempts: 0,
      pinLockedUntil: null,
    });

    await createOrder(
      { products, orders },
      {
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email!,
        customerPhone: "+61400000004",
        fulfillmentType: "pickup",
        deliveryAddress: null,
        deliveryNotes: null,
        stopId: null,
        deliveryFeeCents: 0,
        channel: "web",
        items: [{ productId, quantity: 1 }],
      },
    );

    const history = await orders.listByCustomerId(customer.id);
    expect(history).toHaveLength(1);
    expect(history[0].customerId).toBe(customer.id);
  });

  describe("findQueueForDespachador", () => {
    it("devuelve ordenes paid + received/in_prep/ready_for_pickup", async () => {
      const repo = new DrizzleOrderRepository();
      const paidReceived = await repo.create({
        ...minimalOrderInput,
        paymentStatus: "paid",
        fulfillmentStatus: "received",
      });
      const paidReadyForPickup = await repo.create({
        ...minimalOrderInput,
        paymentStatus: "paid",
        fulfillmentStatus: "ready_for_pickup",
      });
      await repo.create({ ...minimalOrderInput, paymentStatus: "pending", fulfillmentStatus: "received" });
      await repo.create({ ...minimalOrderInput, paymentStatus: "paid", fulfillmentStatus: "delivered" });

      const queue = await repo.findQueueForDespachador();

      expect(queue.map((o) => o.id)).toContain(paidReceived.id);
      expect(queue.map((o) => o.id)).toContain(paidReadyForPickup.id);
      expect(queue.every((o) => o.paymentStatus === "paid")).toBe(true);
      expect(queue.every((o) => ["received", "in_prep", "ready_for_pickup"].includes(o.fulfillmentStatus))).toBe(true);
    });
  });

  describe("assignDelivery / findAssignedToDelivery", () => {
    it("asigna un delivery y lo devuelve en su listado", async () => {
      const repo = new DrizzleOrderRepository();
      const users = new DrizzleUserRepository();
      const deliveryUser = await users.create({
        name: "Delivery Test",
        email: `delivery-test-${Date.now()}@example.com`,
        role: "delivery",
        pinHash: null,
        passwordHash: null,
        isActive: true,
        preferredLocale: "en",
        failedPinAttempts: 0,
        pinLockedUntil: null,
      });

      const order = await repo.create({
        ...minimalOrderInput,
        paymentStatus: "paid",
        fulfillmentStatus: "ready_for_pickup",
      });

      await repo.assignDelivery(order.id, deliveryUser.id);
      await repo.updateFulfillmentStatus(order.id, "out_for_delivery");

      const assigned = await repo.findAssignedToDelivery(deliveryUser.id);
      expect(assigned.map((o) => o.id)).toContain(order.id);
    });
  });

  describe("recordDeliveryEvidence", () => {
    it("persiste las cuatro columnas de evidencia", async () => {
      const repo = new DrizzleOrderRepository();
      const order = await repo.create({ ...minimalOrderInput, fulfillmentStatus: "out_for_delivery" });
      const capturedAt = new Date("2026-10-20T12:00:00Z");

      try {
        await repo.recordDeliveryEvidence(order.id, { key: "delivery-evidence/o/u.jpg", capturedAt, lat: 25.7, lng: -80.2 });

        const stored = await repo.findById(order.id);
        expect(stored?.deliveryEvidenceKey).toBe("delivery-evidence/o/u.jpg");
        expect(stored?.deliveryEvidenceCapturedAt?.toISOString()).toBe(capturedAt.toISOString());
        expect(stored?.deliveryEvidenceLat).toBe(25.7);
        expect(stored?.deliveryEvidenceLng).toBe(-80.2);
      } finally {
        await db.delete(ordersTable).where(eq(ordersTable.id, order.id));
      }
    });
  });
});

describe("DrizzleOrderRepository — eventos de transición, atención y paradas", () => {
  const repo = new DrizzleOrderRepository();
  const stops = new DrizzleTrailerStopRepository();
  const tag = `order-events-test-${Date.now()}`;
  const orderIds: string[] = [];
  const stopIds: string[] = [];
  let actorId: string;
  let deliveryId: string;

  const newOrder = async (overrides: Partial<Omit<Order, "id">> = {}) => {
    const o = await repo.create({ ...minimalOrderInput, customerEmail: `${tag}@example.com`, ...overrides });
    orderIds.push(o.id);
    return o;
  };
  const newStop = async () => {
    const stop = await stops.create({
      location: `${tag} stop`,
      lat: -34.9,
      lng: 138.6,
      startTime: new Date("2026-11-04T00:00:00Z"),
      endTime: new Date("2026-11-04T05:00:00Z"),
      status: "active",
    });
    stopIds.push(stop.id);
    return stop.id;
  };
  const eventsOf = (orderId: string) =>
    db.select().from(orderStatusEventsTable).where(eq(orderStatusEventsTable.orderId, orderId));
  const ctx = (extra: Partial<TransitionContext> = {}): TransitionContext => ({
    actorUserId: actorId,
    source: "web",
    record: true,
    ...extra,
  });

  beforeAll(async () => {
    const users = new DrizzleUserRepository();
    const base = {
      pinHash: null,
      passwordHash: null,
      isActive: true,
      preferredLocale: "en" as const,
      failedPinAttempts: 0,
      pinLockedUntil: null,
    };
    actorId = (await users.create({ ...base, name: "Actor", email: `${tag}-actor@example.com`, role: "despachador" })).id;
    deliveryId = (await users.create({ ...base, name: "Delivery", email: `${tag}-delivery@example.com`, role: "delivery" })).id;
  }, 15000);

  afterAll(async () => {
    if (orderIds.length) {
      await db.delete(orderStatusEventsTable).where(inArray(orderStatusEventsTable.orderId, orderIds));
      await db.delete(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds));
      await db.delete(ordersTable).where(inArray(ordersTable.id, orderIds));
    }
    for (const id of stopIds) await stops.deleteWithStock(id);
    const userIds = [actorId, deliveryId].filter(Boolean);
    if (userIds.length) await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }, 15000);

  it("una transición con record:true inserta un evento; repetirla (no-op) no inserta otro", async () => {
    const order = await newOrder();
    const before = Date.now();
    await repo.updateFulfillmentStatus(order.id, "received", ctx({ source: "mobile" }));
    const events = await eventsOf(order.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "fulfillment",
      fromStatus: "pending",
      toStatus: "received",
      actorUserId: actorId,
      source: "mobile",
    });
    expect(events[0].recordedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(events[0].occurredAt.getTime()).toBe(events[0].recordedAt.getTime());

    await repo.updateFulfillmentStatus(order.id, "received", ctx());
    expect(await eventsOf(order.id)).toHaveLength(1);
    expect((await repo.findById(order.id))?.fulfillmentStatus).toBe("received");
  }, 15000);

  it("record:false o sin ctx cambia el estado sin insertar eventos", async () => {
    const order = await newOrder();
    await repo.updateFulfillmentStatus(order.id, "received", ctx({ record: false }));
    await repo.updateFulfillmentStatus(order.id, "in_prep");
    await repo.markAsPaid(order.id);
    expect(await repo.findById(order.id)).toMatchObject({ fulfillmentStatus: "in_prep", paymentStatus: "paid" });
    expect(await eventsOf(order.id)).toEqual([]);
  }, 15000);

  it("occurredAt futura o de hace 25 h se reemplaza por la hora del servidor; una de hace 1 h se respeta", async () => {
    const hour = 60 * 60 * 1000;
    const cases = [
      { occurredAt: new Date(Date.now() + hour), respected: false },
      { occurredAt: new Date(Date.now() - 25 * hour), respected: false },
      { occurredAt: new Date(Date.now() - hour), respected: true },
    ];
    for (const { occurredAt, respected } of cases) {
      const order = await newOrder();
      await repo.updateFulfillmentStatus(order.id, "received", ctx({ occurredAt }));
      const [event] = await eventsOf(order.id);
      if (respected) expect(event.occurredAt.getTime()).toBe(occurredAt.getTime());
      else expect(event.occurredAt.getTime()).toBe(event.recordedAt.getTime());
    }
  }, 15000);

  it("el UPDATE y el evento son atómicos: si falla el evento, el estado no cambia", async () => {
    const order = await newOrder();
    // actorUserId inexistente: la FK del evento falla y arrastra el UPDATE.
    const ghost = ctx({ actorUserId: "00000000-0000-4000-8000-000000000000" });
    await expect(repo.updateFulfillmentStatus(order.id, "received", ghost)).rejects.toThrow();
    await expect(repo.markAsPaid(order.id, ghost, "stop_cancelled")).rejects.toThrow();
    expect(await repo.findById(order.id)).toMatchObject({
      fulfillmentStatus: "pending",
      paymentStatus: "pending",
      attentionReason: null,
    });
    expect(await eventsOf(order.id)).toEqual([]);
  }, 15000);

  it("markAsPaid guarda el motivo de atención en la misma escritura y registra el evento de pago", async () => {
    const order = await newOrder();
    const webhook = ctx({ source: "webhook", actorUserId: null });
    await repo.markAsPaid(order.id, webhook, "insufficient_stock:x");
    expect(await repo.findById(order.id)).toMatchObject({
      paymentStatus: "paid",
      fulfillmentStatus: "pending",
      attentionReason: "insufficient_stock:x",
    });
    expect(await eventsOf(order.id)).toMatchObject([
      { kind: "payment", fromStatus: "pending", toStatus: "paid", actorUserId: null, source: "webhook" },
    ]);
    await repo.markAsPaid(order.id, webhook);
    expect(await eventsOf(order.id)).toHaveLength(1);
    // Sin attentionReason no se toca el motivo existente.
    expect((await repo.findById(order.id))?.attentionReason).toBe("insufficient_stock:x");
  }, 15000);

  it("resolveAttention limpia el motivo y pasa pending→received con su evento (ida y vuelta de la atención)", async () => {
    const order = await newOrder();
    await repo.markAsPaid(order.id, undefined, "stop_cancelled");
    expect((await repo.findQueueForDespachador()).map((o) => o.id)).not.toContain(order.id);

    await repo.resolveAttention(order.id, ctx());
    expect(await repo.findById(order.id)).toMatchObject({ attentionReason: null, fulfillmentStatus: "received" });
    expect(await eventsOf(order.id)).toMatchObject([
      { kind: "fulfillment", fromStatus: "pending", toStatus: "received", actorUserId: actorId },
    ]);
    expect((await repo.findQueueForDespachador()).map((o) => o.id)).toContain(order.id);
  }, 15000);

  it("findQueueForDespachador excluye un pedido paid + received con attentionReason", async () => {
    const order = await newOrder({ paymentStatus: "paid", fulfillmentStatus: "received" });
    expect((await repo.findQueueForDespachador()).map((o) => o.id)).toContain(order.id);
    await db.update(ordersTable).set({ attentionReason: "stop_cancelled" }).where(eq(ordersTable.id, order.id));
    expect((await repo.findQueueForDespachador()).map((o) => o.id)).not.toContain(order.id);
  }, 15000);

  it("assignDelivery registra out_for_delivery con quien asigna como actor", async () => {
    const order = await newOrder({ paymentStatus: "paid", fulfillmentStatus: "ready_for_pickup" });
    await repo.assignDelivery(order.id, deliveryId, ctx());
    expect(await repo.findById(order.id)).toMatchObject({
      assignedDeliveryUserId: deliveryId,
      fulfillmentStatus: "out_for_delivery",
    });
    expect(await eventsOf(order.id)).toMatchObject([
      { kind: "fulfillment", fromStatus: "ready_for_pickup", toStatus: "out_for_delivery", actorUserId: actorId },
    ]);
  }, 15000);

  it("cancelPendingOrdersForStop cancela solo los pendientes de pago de esa parada; contadores por parada", async () => {
    const [stopA, stopB] = [await newStop(), await newStop()];
    const pendingA = await newOrder({ stopId: stopA });
    const pendingA2 = await newOrder({ stopId: stopA, fulfillmentStatus: "received" });
    const paidA = await newOrder({ stopId: stopA, paymentStatus: "paid", fulfillmentStatus: "received" });
    const paidDeliveredA = await newOrder({ stopId: stopA, paymentStatus: "paid", fulfillmentStatus: "delivered" });
    const pendingB = await newOrder({ stopId: stopB });

    expect(await repo.countPaidUndeliveredForStop(stopA)).toBe(1);
    expect(await repo.countUndeliveredForStop(stopA)).toBe(3);

    expect(await repo.cancelPendingOrdersForStop(stopA, ctx({ source: "system", actorUserId: null }))).toBe(2);
    const status = async (id: string) => (await repo.findById(id))?.fulfillmentStatus;
    expect(await status(pendingA.id)).toBe("cancelled");
    expect(await status(pendingA2.id)).toBe("cancelled");
    expect(await status(paidA.id)).toBe("received");
    expect(await status(paidDeliveredA.id)).toBe("delivered");
    expect(await status(pendingB.id)).toBe("pending");
    expect(await eventsOf(pendingA2.id)).toMatchObject([
      { kind: "fulfillment", fromStatus: "received", toStatus: "cancelled", source: "system" },
    ]);
    expect(await eventsOf(paidA.id)).toEqual([]);

    expect(await repo.countPaidUndeliveredForStop(stopA)).toBe(1);
    expect(await repo.countUndeliveredForStop(stopA)).toBe(1);
    expect(await repo.cancelPendingOrdersForStop(stopA, ctx())).toBe(0);
  }, 15000);
});
