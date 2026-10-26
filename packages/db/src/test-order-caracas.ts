// Pedido de PRUEBA con direccion en Caracas para probar mapa, ruta, ETA, detalle y contacto del delivery desde Venezuela.
// La base es compartida dev=prod: el pedido queda marcado con el nombre "TEST Caracas ..." y se borra con `clean`.
//
// Uso (desde la raiz del repo):
//   pnpm --filter @workspace/db run test-order-caracas create <email-del-delivery> ["Direccion, Caracas, Venezuela"]
//   pnpm --filter @workspace/db run test-order-caracas clean
//
// Mismo gotcha que seed.ts: tsx no carga .env y los imports estaticos se hoistean, por eso "./index" va dinamico.
// Fuerza modo modulo: sin import/export el archivo es un script global y su `main` choca con el de seed.ts (TS2393).
export {};

process.loadEnvFile();

const TEST_NAME_PREFIX = "TEST Caracas";
const DEFAULT_ADDRESS = "Plaza Venezuela, Caracas, Venezuela";

async function main() {
  const [command, deliveryEmail, addressArg] = process.argv.slice(2);
  const { db, pool, ordersTable, orderItemsTable, productsTable, usersTable } = await import("./index");
  const { and, eq, like, inArray } = await import("drizzle-orm");

  try {
    if (command === "clean") {
      const rows = await db.select({ id: ordersTable.id }).from(ordersTable).where(like(ordersTable.customerName, `${TEST_NAME_PREFIX}%`));
      const ids = rows.map((r) => r.id);
      if (ids.length) {
        await db.delete(orderItemsTable).where(inArray(orderItemsTable.orderId, ids));
        await db.delete(ordersTable).where(inArray(ordersTable.id, ids));
      }
      console.log(`Pedidos de prueba borrados: ${ids.length}`);
      return;
    }

    if (command !== "create" || !deliveryEmail) {
      console.error('Uso: test-order-caracas create <email-del-delivery> ["direccion"] | clean');
      process.exitCode = 1;
      return;
    }

    const [delivery] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.email, deliveryEmail), eq(usersTable.role, "delivery"), eq(usersTable.isActive, true)));
    if (!delivery) {
      console.error(`No hay un usuario delivery activo con el email ${deliveryEmail}`);
      process.exitCode = 1;
      return;
    }
    const [product] = await db.select().from(productsTable).limit(1);
    if (!product) {
      console.error("No hay productos en el catalogo");
      process.exitCode = 1;
      return;
    }

    const quantity = 2;
    const subtotal = product.priceCents * quantity;
    const [order] = await db
      .insert(ordersTable)
      .values({
        customerName: `${TEST_NAME_PREFIX} ${new Date().toISOString().slice(0, 16)}`,
        customerEmail: "test-caracas@example.invalid",
        customerPhone: "+58 412 123 4567", // numero venezolano con codigo de pais: prueba el enlace de WhatsApp internacional
        fulfillmentType: "self_delivery",
        deliveryAddress: addressArg ?? DEFAULT_ADDRESS,
        deliveryNotes: "Pedido de prueba en Caracas. Tocar el timbre dos veces.",
        paymentStatus: "paid",
        fulfillmentStatus: "out_for_delivery",
        subtotalCents: subtotal,
        discountCents: subtotal, // total 0: no es una venta real
        deliveryFeeCents: 0,
        totalCents: 0,
        channel: "web",
        assignedDeliveryUserId: delivery.id,
      })
      .returning({ id: ordersTable.id });
    await db.insert(orderItemsTable).values({ orderId: order!.id, productId: product.id, quantity, unitPriceCents: product.priceCents, lineDiscountCents: product.priceCents * quantity });
    console.log(`Pedido de prueba creado: ${order!.id} -> ${addressArg ?? DEFAULT_ADDRESS} (asignado a ${deliveryEmail}). Borrar con: clean`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
