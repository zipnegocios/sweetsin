# Fase 3 — Checkout, Carrito y Órdenes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carrito de compras real (persistido server-side para un `customer` logueado, `localStorage` para invitados) y checkout funcional que persiste órdenes reales en Postgres — vía WhatsApp (funcional de punta a punta) y vía tarjeta (scaffold completo de Stripe, sin credenciales todavía).

**Architecture:** Hexagonal estricta, mismo patrón que Fases 1-2: entidades/puertos/casos de uso en `packages/domain` (cero imports de framework), implementaciones Drizzle en `packages/db`, `apps/web` como adaptador de entrada/salida (Server Actions, Route Handlers, Client Components). El carrito de un visitante sin cuenta vive 100% en `localStorage` del navegador; el carrito server-side (tablas `carts`/`cart_items`, ya creadas en Fase 1.2) se construye completo pero sin login real que lo dispare todavía — Auth.js llega en Fase 4.

**Tech Stack:** Next.js 15 (Server Actions, Route Handlers), Drizzle ORM, Zod, Stripe SDK (`stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`), next-intl, GSAP (mismo patrón de animación que Fase 2).

## Global Constraints

- **Fulfillment: solo `pickup` y `self_delivery`.** `courier` existía en el prototipo legacy (`apps/web-legacy/src/components/ui/CheckoutModal.tsx`) pero está fuera de alcance desde Fase 0 (Courier/Uber Direct pospuesto) — no se reconstruye.
- **Checkout de invitado, cuenta opcional** (decisión resuelta #3 de `plan-desarrollo.md`): `orders.customerId` es `null` para todo lo que se construye en esta fase. No hay login real todavía.
- **Precio y descuento se calculan únicamente en `packages/domain`** (Fase 0) — el frontend nunca calcula el total que se cobra, solo muestra una aproximación visual con las mismas funciones de `packages/domain/pricing` mientras el usuario arma el carrito; el total que se persiste sale siempre de `createOrder` en el servidor.
- **Todas las órdenes se persisten en Postgres desde el día uno**, sin importar el canal (`web` o `whatsapp`) — decisión de Fase 0, ya reflejada en el `OrderRepository` de Fase 1.
- **Stripe: sin credenciales de test/live todavía** (confirmado al arrancar esta fase, 2026-09-13). Se construye el scaffold completo — SDK, `StripePaymentGateway`, Route Handlers de creación de PaymentIntent y de webhook — pero la verificación end-to-end queda documentada como bloqueada. No se mockea el flujo en silencio: si falta `STRIPE_SECRET_KEY`, el código falla explícitamente con un error claro, nunca simula un pago exitoso.
- **Fee de self-delivery: $5.00 AUD (500 cents) por defecto, editable desde el panel admin** (decisión del owner, 2026-09-13) — vive en una tabla nueva `settings` (fila única), no como constante en código. La UI de admin para editarlo es de Fase 4/5; esta fase solo deja el `SettingsRepository.update()` listo.
- **Carrito server-side construido completo, sin wiring de login real** (decisión del owner, 2026-09-13): `CartRepository`, `syncCart`, `mergeGuestCart` y `DrizzleCartRepository` se construyen y prueban ahora (Vitest + integración contra Postgres real, usando un `customerId` de prueba insertado directamente). Ningún flujo de UI de esta fase los invoca todavía — eso ocurre en Fase 4, cuando exista una sesión real de Auth.js.
- **Idioma y razonamiento:** todo el proceso sigue en español, estructura de 4 pasos (Evaluación de Impacto, Resolución de Conflictos, Mentoría Técnica, Plan de Acción), regla ya vigente en `CLAUDE.md` — no se repite en cada tarea de este plan.
- **Commits:** un commit por tarea. Quien ejecute el plan nunca corre `git commit` — solo `git add` de los archivos relevantes y sugiere el comando exacto (español, una línea, sin firmas) para que el owner lo corra manualmente.
- **Branching:** directo sobre `main`, sin branches ni PRs.

---

### Tarea 1: `packages/domain/src/settings` — entidad y puerto

**Files:**
- Create: `packages/domain/src/settings/entities.ts`
- Create: `packages/domain/src/settings/ports.ts`
- Create: `packages/domain/src/settings/index.ts`
- Modify: `packages/domain/package.json`

**Interfaces:**
- Produces: `AppSettings { deliveryFeeCents: number }`, `SettingsRepository { get(): Promise<AppSettings>; update(partial: Partial<AppSettings>): Promise<AppSettings> }`.

No hay `use-cases.ts` en este subdominio: `get`/`update` no aplican ninguna regla de negocio propia (a diferencia de `createOrder` o `decrementStockOnSale`), así que forzar un caso de uso encima del puerto sería un envoltorio vacío — el Server Action de checkout (Tarea 20) llama al repositorio directamente.

- [ ] **Step 1: Crear la entidad**

```ts
// packages/domain/src/settings/entities.ts
export interface AppSettings {
  deliveryFeeCents: number;
}
```

- [ ] **Step 2: Crear el puerto**

```ts
// packages/domain/src/settings/ports.ts
import type { AppSettings } from "./entities";

export interface SettingsRepository {
  get(): Promise<AppSettings>;
  update(partial: Partial<AppSettings>): Promise<AppSettings>;
}
```

- [ ] **Step 3: Crear el índice del subdominio**

```ts
// packages/domain/src/settings/index.ts
export * from "./entities";
export * from "./ports";
```

- [ ] **Step 4: Exponer el subpath export**

En `packages/domain/package.json`, agregar dentro de `"exports"`:

```json
"./settings": "./src/settings/index.ts"
```

- [ ] **Step 5: Verificar que el paquete sigue tipando limpio**

Run: `pnpm --filter @workspace/domain run test`
Expected: PASS (sin tests nuevos todavía, solo confirma que no rompiste nada)

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/settings packages/domain/package.json
```

Comando sugerido: `git commit -m "Agrega el puerto SettingsRepository al dominio para configuracion editable"`

---

### Tarea 2: `packages/db` — tabla `settings` y repositorio Drizzle

**Files:**
- Create: `packages/db/src/schema/settings.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/repositories/settings-repository.ts`
- Create: `packages/db/src/repositories/settings-repository.test.ts`
- Modify: `packages/db/src/repositories/index.ts`

**Interfaces:**
- Consumes: `AppSettings`, `SettingsRepository` de `@workspace/domain/settings` (Tarea 1).
- Produces: `settingsTable` (Drizzle), `DrizzleSettingsRepository implements SettingsRepository`.

- [ ] **Step 1: Crear el schema — fila única de configuración**

```ts
// packages/db/src/schema/settings.ts
import { pgTable, integer, timestamp } from "drizzle-orm/pg-core";

// Fila única de configuración editable — id fijo en 1 por convención (no
// hay multi-tenant ni necesidad de más de una fila). Se agregan columnas
// nuevas acá cuando aparezca la próxima necesidad real de configuración,
// en vez de construir un motor key-value genérico que hoy nadie pidió.
export const settingsTable = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  deliveryFeeCents: integer("delivery_fee_cents").notNull().default(500),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
```

- [ ] **Step 2: Exportarlo desde el índice de schema**

En `packages/db/src/schema/index.ts`, agregar:

```ts
export * from "./settings";
```

- [ ] **Step 3: Aplicar el schema contra Postgres**

Run: `pnpm --filter @workspace/db run push`
Expected: drizzle-kit reporta la tabla `settings` creada, sin errores. Confirmar en el output que no propone borrar ninguna tabla existente antes de aceptar.

- [ ] **Step 4: Escribir el test de integración (falla primero — la clase no existe)**

```ts
// packages/db/src/repositories/settings-repository.test.ts
import { describe, it, expect } from "vitest";
import { DrizzleSettingsRepository } from "./settings-repository";

describe("DrizzleSettingsRepository", () => {
  it("returns the default delivery fee when no row exists yet, then persists updates", async () => {
    const repo = new DrizzleSettingsRepository();

    const initial = await repo.get();
    expect(initial.deliveryFeeCents).toBe(500);

    const updated = await repo.update({ deliveryFeeCents: 700 });
    expect(updated.deliveryFeeCents).toBe(700);

    const reread = await repo.get();
    expect(reread.deliveryFeeCents).toBe(700);

    // Deja la fila en el valor por defecto para no afectar otros tests o el checkout real.
    await repo.update({ deliveryFeeCents: 500 });
  });
});
```

- [ ] **Step 5: Correr el test y confirmar que falla**

Run: `pnpm --filter @workspace/db run test -- settings-repository`
Expected: FAIL con "Cannot find module './settings-repository'"

- [ ] **Step 6: Implementar el repositorio**

```ts
// packages/db/src/repositories/settings-repository.ts
import { eq } from "drizzle-orm";
import type { AppSettings, SettingsRepository } from "@workspace/domain/settings";
import { db } from "../index";
import { settingsTable } from "../schema";

const SETTINGS_ROW_ID = 1;

export class DrizzleSettingsRepository implements SettingsRepository {
  async get(): Promise<AppSettings> {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.id, SETTINGS_ROW_ID));
    if (row) return { deliveryFeeCents: row.deliveryFeeCents };

    const [inserted] = await db.insert(settingsTable).values({ id: SETTINGS_ROW_ID }).returning();
    return { deliveryFeeCents: inserted.deliveryFeeCents };
  }

  async update(partial: Partial<AppSettings>): Promise<AppSettings> {
    const [updated] = await db
      .insert(settingsTable)
      .values({ id: SETTINGS_ROW_ID, ...partial })
      .onConflictDoUpdate({ target: settingsTable.id, set: partial })
      .returning();
    return { deliveryFeeCents: updated.deliveryFeeCents };
  }
}
```

- [ ] **Step 7: Exportarlo desde el índice de repositorios**

En `packages/db/src/repositories/index.ts`, agregar:

```ts
export * from "./settings-repository";
```

- [ ] **Step 8: Correr el test y confirmar que pasa**

Run: `pnpm --filter @workspace/db run test -- settings-repository`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/db/src/schema/settings.ts packages/db/src/schema/index.ts packages/db/src/repositories/settings-repository.ts packages/db/src/repositories/settings-repository.test.ts packages/db/src/repositories/index.ts
```

Comando sugerido: `git commit -m "Agrega la tabla settings y DrizzleSettingsRepository para el fee de delivery editable"`

---

### Tarea 3: Cargar el default de `settings` en el seed

**Files:**
- Modify: `packages/db/src/seed.ts`

**Interfaces:**
- Consumes: `settingsTable` (Tarea 2).

- [ ] **Step 1: Agregar la carga idempotente del default**

En `packages/db/src/seed.ts`, dentro de `main()`, después del destructure de `schema` (línea `const { productsTable, trailerStopsTable } = await import("./schema");`), ampliar el destructure y agregar el insert al final, antes de `await pool.end();`:

```ts
const { productsTable, trailerStopsTable, settingsTable } = await import("./schema");
```

```ts
  await db.insert(settingsTable).values({ id: 1, deliveryFeeCents: 500 }).onConflictDoNothing();
  console.log("Ensured default settings row (delivery fee: 500 cents).");

  await pool.end();
```

- [ ] **Step 2: Correr el seed contra la DB real**

Run: `pnpm --filter @workspace/db run seed`
Expected: output incluye `Ensured default settings row (delivery fee: 500 cents).` sin errores, y no duplica productos/paradas ya existentes.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/seed.ts
```

Comando sugerido: `git commit -m "Carga el valor por defecto de settings en el script de seed"`

---

### Tarea 4: `packages/domain/src/cart` — entidades, puerto y casos de uso

**Files:**
- Create: `packages/domain/src/cart/entities.ts`
- Create: `packages/domain/src/cart/ports.ts`
- Create: `packages/domain/src/cart/use-cases.ts`
- Create: `packages/domain/src/cart/use-cases.test.ts`
- Create: `packages/domain/src/cart/index.ts`
- Modify: `packages/domain/package.json`

**Interfaces:**
- Produces: `CartItem { productId: string; quantity: number }`, `Cart { id: string; customerId: string; items: CartItem[] }`, `CartRepository { findByCustomerId(customerId): Promise<Cart | null>; replaceItems(customerId, items): Promise<Cart> }`, `syncCart(repo, customerId, items): Promise<Cart>`, `mergeGuestCart(repo, customerId, guestItems): Promise<Cart>`.

- [ ] **Step 1: Crear las entidades**

```ts
// packages/domain/src/cart/entities.ts
export interface CartItem {
  productId: string;
  quantity: number;
}

export interface Cart {
  id: string;
  customerId: string;
  items: CartItem[];
}
```

- [ ] **Step 2: Crear el puerto**

`replaceItems` reemplaza el array completo de items en vez de exponer `addItem`/`removeItem` incrementales — encaja con el modelo de "sincronizar el estado completo del carrito local" en un solo paso, y es más simple de implementar/testear que operaciones incrementales.

```ts
// packages/domain/src/cart/ports.ts
import type { Cart, CartItem } from "./entities";

export interface CartRepository {
  findByCustomerId(customerId: string): Promise<Cart | null>;
  replaceItems(customerId: string, items: CartItem[]): Promise<Cart>;
}
```

- [ ] **Step 3: Escribir los tests de los casos de uso (fallan primero)**

```ts
// packages/domain/src/cart/use-cases.test.ts
import { describe, it, expect } from "vitest";
import { syncCart, mergeGuestCart } from "./use-cases";
import type { Cart, CartItem } from "./entities";
import type { CartRepository } from "./ports";

function fakeCartRepo(initial: Cart | null = null): CartRepository & { saved: Cart | null } {
  let stored = initial;
  return {
    get saved() {
      return stored;
    },
    async findByCustomerId() {
      return stored;
    },
    async replaceItems(customerId, items) {
      stored = { id: stored?.id ?? "cart-1", customerId, items };
      return stored;
    },
  };
}

describe("syncCart", () => {
  it("replaces the stored items with the given ones", async () => {
    const repo = fakeCartRepo();
    const items: CartItem[] = [{ productId: "p1", quantity: 2 }];

    const cart = await syncCart(repo, "customer-1", items);

    expect(cart.customerId).toBe("customer-1");
    expect(cart.items).toEqual(items);
  });
});

describe("mergeGuestCart", () => {
  it("uses the guest items as-is when there is no existing server-side cart", async () => {
    const repo = fakeCartRepo(null);
    const guestItems: CartItem[] = [{ productId: "p1", quantity: 3 }];

    const cart = await mergeGuestCart(repo, "customer-1", guestItems);

    expect(cart.items).toEqual(guestItems);
  });

  it("sums quantities for products present in both carts", async () => {
    const existing: Cart = { id: "cart-1", customerId: "customer-1", items: [{ productId: "p1", quantity: 2 }] };
    const repo = fakeCartRepo(existing);
    const guestItems: CartItem[] = [{ productId: "p1", quantity: 1 }, { productId: "p2", quantity: 5 }];

    const cart = await mergeGuestCart(repo, "customer-1", guestItems);

    expect(cart.items).toEqual(
      expect.arrayContaining([
        { productId: "p1", quantity: 3 },
        { productId: "p2", quantity: 5 },
      ]),
    );
    expect(cart.items).toHaveLength(2);
  });
});
```

- [ ] **Step 4: Correr los tests y confirmar que fallan**

Run: `pnpm --filter @workspace/domain run test -- cart`
Expected: FAIL con "Cannot find module './use-cases'"

- [ ] **Step 5: Implementar los casos de uso**

```ts
// packages/domain/src/cart/use-cases.ts
import type { CartRepository } from "./ports";
import type { Cart, CartItem } from "./entities";

export function syncCart(repo: CartRepository, customerId: string, items: CartItem[]): Promise<Cart> {
  return repo.replaceItems(customerId, items);
}

export async function mergeGuestCart(
  repo: CartRepository,
  customerId: string,
  guestItems: CartItem[],
): Promise<Cart> {
  const existing = await repo.findByCustomerId(customerId);
  const merged = new Map<string, number>();

  for (const item of existing?.items ?? []) {
    merged.set(item.productId, item.quantity);
  }
  for (const item of guestItems) {
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }

  const mergedItems: CartItem[] = Array.from(merged.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));

  return repo.replaceItems(customerId, mergedItems);
}
```

- [ ] **Step 6: Crear el índice del subdominio**

```ts
// packages/domain/src/cart/index.ts
export * from "./entities";
export * from "./ports";
export * from "./use-cases";
```

- [ ] **Step 7: Exponer el subpath export**

En `packages/domain/package.json`, agregar dentro de `"exports"`:

```json
"./cart": "./src/cart/index.ts"
```

- [ ] **Step 8: Correr los tests y confirmar que pasan**

Run: `pnpm --filter @workspace/domain run test -- cart`
Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
git add packages/domain/src/cart packages/domain/package.json
```

Comando sugerido: `git commit -m "Agrega el subdominio cart con syncCart y mergeGuestCart"`

---

### Tarea 5: `DrizzleCartRepository`

**Files:**
- Create: `packages/db/src/repositories/cart-repository.ts`
- Create: `packages/db/src/repositories/cart-repository.test.ts`
- Modify: `packages/db/src/repositories/index.ts`

**Interfaces:**
- Consumes: `Cart`, `CartItem`, `CartRepository` de `@workspace/domain/cart` (Tarea 4); `cartsTable`, `cartItemsTable` de `../schema` (ya existen desde Fase 1.2).
- Produces: `DrizzleCartRepository implements CartRepository`.

- [ ] **Step 1: Escribir el test de integración (falla primero)**

```ts
// packages/db/src/repositories/cart-repository.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { DrizzleCartRepository } from "./cart-repository";
import { db } from "../index";
import { usersTable, productsTable } from "../schema";

describe("DrizzleCartRepository", () => {
  let customerId: string;
  let productId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(usersTable)
      .values({ name: "Test Customer", email: `cart-test-${Date.now()}@example.com`, role: "customer" })
      .returning();
    customerId = user.id;

    const [product] = await db
      .insert(productsTable)
      .values({
        slug: `cart-test-product-${Date.now()}`,
        category: "sin",
        nameEn: "Test Product",
        nameEs: "Producto de Prueba",
        descriptionEn: "Test",
        descriptionEs: "Prueba",
        priceCents: 1000,
      })
      .returning();
    productId = product.id;
  });

  it("creates a cart on first sync and persists items", async () => {
    const repo = new DrizzleCartRepository();

    const cart = await repo.replaceItems(customerId, [{ productId, quantity: 2 }]);
    expect(cart.customerId).toBe(customerId);
    expect(cart.items).toEqual([{ productId, quantity: 2 }]);

    const found = await repo.findByCustomerId(customerId);
    expect(found?.items).toEqual([{ productId, quantity: 2 }]);
  });

  it("replaces items entirely on subsequent syncs instead of merging", async () => {
    const repo = new DrizzleCartRepository();

    await repo.replaceItems(customerId, [{ productId, quantity: 5 }]);
    const updated = await repo.replaceItems(customerId, [{ productId, quantity: 1 }]);

    expect(updated.items).toEqual([{ productId, quantity: 1 }]);
  });

  it("returns null for a customer with no cart yet", async () => {
    const repo = new DrizzleCartRepository();
    const found = await repo.findByCustomerId("00000000-0000-0000-0000-000000000000");
    expect(found).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `pnpm --filter @workspace/db run test -- cart-repository`
Expected: FAIL con "Cannot find module './cart-repository'"

- [ ] **Step 3: Implementar el repositorio**

```ts
// packages/db/src/repositories/cart-repository.ts
import { eq } from "drizzle-orm";
import type { Cart, CartItem, CartRepository } from "@workspace/domain/cart";
import { db } from "../index";
import { cartsTable, cartItemsTable } from "../schema";

export class DrizzleCartRepository implements CartRepository {
  async findByCustomerId(customerId: string): Promise<Cart | null> {
    const [cart] = await db.select().from(cartsTable).where(eq(cartsTable.customerId, customerId));
    if (!cart) return null;

    const itemRows = await db.select().from(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
    return {
      id: cart.id,
      customerId: cart.customerId,
      items: itemRows.map((row) => ({ productId: row.productId, quantity: row.quantity })),
    };
  }

  async replaceItems(customerId: string, items: CartItem[]): Promise<Cart> {
    return db.transaction(async (tx) => {
      let [cart] = await tx.select().from(cartsTable).where(eq(cartsTable.customerId, customerId));
      if (!cart) {
        [cart] = await tx.insert(cartsTable).values({ customerId }).returning();
      }

      await tx.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));

      if (items.length > 0) {
        await tx.insert(cartItemsTable).values(
          items.map((item) => ({ cartId: cart.id, productId: item.productId, quantity: item.quantity })),
        );
      }

      return { id: cart.id, customerId: cart.customerId, items };
    });
  }
}
```

- [ ] **Step 4: Exportarlo desde el índice de repositorios**

En `packages/db/src/repositories/index.ts`, agregar:

```ts
export * from "./cart-repository";
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `pnpm --filter @workspace/db run test -- cart-repository`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/repositories/cart-repository.ts packages/db/src/repositories/cart-repository.test.ts packages/db/src/repositories/index.ts
```

Comando sugerido: `git commit -m "Agrega DrizzleCartRepository con test de integracion contra Postgres real"`

---

### Tarea 6: Extender `OrderRepository` y agregar `confirmOrderPayment`

**Files:**
- Modify: `packages/domain/src/orders/ports.ts`
- Modify: `packages/domain/src/orders/use-cases.ts`
- Modify: `packages/domain/src/orders/use-cases.test.ts`

**Interfaces:**
- Consumes: `StockRepository`, `decrementStockOnSale` de `../stock` (ya existen desde Fase 1.3).
- Produces: `OrderRepository.attachPaymentIntent(orderId, stripePaymentIntentId): Promise<void>`, `OrderRepository.markAsPaid(orderId): Promise<void>`, `confirmOrderPayment(deps: { orders: OrderRepository; stock: StockRepository }, orderId: string): Promise<void>`.

- [ ] **Step 1: Escribir los tests de `confirmOrderPayment` (fallan primero)**

Agregar al final de `packages/domain/src/orders/use-cases.test.ts` (mantener los imports y fakes existentes, agregar lo que falte):

```ts
import { confirmOrderPayment } from "./use-cases";
import type { StockRepository } from "../stock/ports";
import type { StopProductStock, StockEvent } from "../stock/entities";

function fakeOrderRepoWithOrder(order: Order): OrderRepository & { paidCalls: string[] } {
  const paidCalls: string[] = [];
  return {
    paidCalls,
    async create(o) {
      return { ...o, id: "unused" };
    },
    async findById(id) {
      return id === order.id ? order : null;
    },
    async attachPaymentIntent() {},
    async markAsPaid(id) {
      paidCalls.push(id);
      order.paymentStatus = "paid";
    },
  };
}

function fakeStockRepo(stock: StopProductStock[]): StockRepository & { events: Omit<StockEvent, "id">[] } {
  const events: Omit<StockEvent, "id">[] = [];
  return {
    events,
    async findByStopAndProduct(stopId, productId) {
      return stock.find((s) => s.stopId === stopId && s.productId === productId) ?? null;
    },
    async decrementStock(id, quantity) {
      const item = stock.find((s) => s.id === id);
      if (!item) throw new Error("not found");
      item.currentStock -= quantity;
      return item;
    },
    async recordEvent(event) {
      events.push(event);
      return { ...event, id: `event-${events.length}` };
    },
  };
}

describe("confirmOrderPayment", () => {
  it("marks the order as paid and does nothing else when there is no stopId", async () => {
    const order: Order = {
      id: "order-1",
      customerId: null,
      customerName: "Jane",
      customerEmail: "jane@example.com",
      customerPhone: "+61400000000",
      fulfillmentType: "pickup",
      deliveryAddress: null,
      stopId: null,
      paymentStatus: "pending",
      fulfillmentStatus: "pending",
      subtotalCents: 1000,
      discountCents: 0,
      deliveryFeeCents: 0,
      totalCents: 1000,
      channel: "web",
      stripePaymentIntentId: "pi_123",
      items: [{ productId: "p1", quantity: 1, unitPriceCents: 1000, lineDiscountCents: 0 }],
    };
    const orders = fakeOrderRepoWithOrder(order);
    const stock = fakeStockRepo([]);

    await confirmOrderPayment({ orders, stock }, "order-1");

    expect(orders.paidCalls).toEqual(["order-1"]);
    expect(stock.events).toHaveLength(0);
  });

  it("decrements stock for every item when the order has a stopId", async () => {
    const order: Order = {
      id: "order-2",
      customerId: null,
      customerName: "Jane",
      customerEmail: "jane@example.com",
      customerPhone: "+61400000000",
      fulfillmentType: "pickup",
      deliveryAddress: null,
      stopId: "stop-1",
      paymentStatus: "pending",
      fulfillmentStatus: "pending",
      subtotalCents: 2000,
      discountCents: 0,
      deliveryFeeCents: 0,
      totalCents: 2000,
      channel: "web",
      stripePaymentIntentId: "pi_456",
      items: [{ productId: "p1", quantity: 2, unitPriceCents: 1000, lineDiscountCents: 0 }],
    };
    const orders = fakeOrderRepoWithOrder(order);
    const stock = fakeStockRepo([{ id: "stock-1", stopId: "stop-1", productId: "p1", maxStock: 10, currentStock: 10 }]);

    await confirmOrderPayment({ orders, stock }, "order-2");

    expect(stock.events).toEqual([
      { stopProductStockId: "stock-1", eventType: "sale", quantity: 2, reason: null, reportedByUserId: null },
    ]);
  });

  it("is idempotent: does nothing if the order is already paid", async () => {
    const order: Order = {
      id: "order-3",
      customerId: null,
      customerName: "Jane",
      customerEmail: "jane@example.com",
      customerPhone: "+61400000000",
      fulfillmentType: "pickup",
      deliveryAddress: null,
      stopId: "stop-1",
      paymentStatus: "paid",
      fulfillmentStatus: "pending",
      subtotalCents: 1000,
      discountCents: 0,
      deliveryFeeCents: 0,
      totalCents: 1000,
      channel: "web",
      stripePaymentIntentId: "pi_789",
      items: [{ productId: "p1", quantity: 1, unitPriceCents: 1000, lineDiscountCents: 0 }],
    };
    const orders = fakeOrderRepoWithOrder(order);
    const stock = fakeStockRepo([{ id: "stock-1", stopId: "stop-1", productId: "p1", maxStock: 10, currentStock: 10 }]);

    await confirmOrderPayment({ orders, stock }, "order-3");

    expect(orders.paidCalls).toEqual([]);
    expect(stock.events).toHaveLength(0);
  });
});
```

Actualizar también las dos fábricas `fakeOrderRepo()` ya existentes en el archivo (usadas por los tests de `createOrder`) agregando los dos métodos nuevos del puerto para que sigan compilando:

```ts
    async attachPaymentIntent() {},
    async markAsPaid() {},
```

(agregar estas dos líneas dentro del objeto que retorna `fakeOrderRepo()`, junto a `create`/`findById`).

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `pnpm --filter @workspace/domain run test -- orders`
Expected: FAIL — `confirmOrderPayment` no existe, y los fakes no implementan el puerto ampliado (error de tipos)

- [ ] **Step 3: Extender el puerto**

```ts
// packages/domain/src/orders/ports.ts
import type { Order, OrderChannel, FulfillmentType } from "./entities";

export interface NewOrderInput {
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  deliveryAddress: string | null;
  stopId: string | null;
  deliveryFeeCents: number;
  channel: OrderChannel;
  items: { productId: string; quantity: number }[];
}

export interface OrderRepository {
  create(order: Omit<Order, "id">): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  attachPaymentIntent(orderId: string, stripePaymentIntentId: string): Promise<void>;
  markAsPaid(orderId: string): Promise<void>;
}
```

- [ ] **Step 4: Implementar `confirmOrderPayment`**

```ts
// packages/domain/src/orders/use-cases.ts — agregar al final del archivo
import type { StockRepository } from "../stock/ports";
import { decrementStockOnSale } from "../stock/use-cases";

export async function confirmOrderPayment(
  deps: { orders: OrderRepository; stock: StockRepository },
  orderId: string,
): Promise<void> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.paymentStatus === "paid") return; // Stripe puede reenviar el mismo evento de webhook más de una vez.

  await deps.orders.markAsPaid(orderId);

  if (order.stopId) {
    for (const item of order.items) {
      await decrementStockOnSale(deps.stock, order.stopId, item.productId, item.quantity);
    }
  }
}
```

(agregar los dos imports nuevos junto a los imports existentes al principio del archivo, no repetidos)

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `pnpm --filter @workspace/domain run test -- orders`
Expected: PASS (todos los tests de `createOrder` + los 3 nuevos de `confirmOrderPayment`)

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/orders/ports.ts packages/domain/src/orders/use-cases.ts packages/domain/src/orders/use-cases.test.ts
```

Comando sugerido: `git commit -m "Agrega confirmOrderPayment y los metodos de pago al puerto OrderRepository"`

---

### Tarea 7: Implementar los métodos nuevos en `DrizzleOrderRepository`

**Files:**
- Modify: `packages/db/src/repositories/order-repository.ts`
- Modify: `packages/db/src/repositories/order-repository.test.ts`

**Interfaces:**
- Consumes: `attachPaymentIntent`, `markAsPaid` (puerto extendido, Tarea 6).

- [ ] **Step 1: Agregar el caso al test de integración (falla primero)**

Agregar al final del `describe("DrizzleOrderRepository", ...)` en `packages/db/src/repositories/order-repository.test.ts`:

```ts
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
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `pnpm --filter @workspace/db run test -- order-repository`
Expected: FAIL — `orders.attachPaymentIntent is not a function`

- [ ] **Step 3: Implementar los métodos**

Agregar dentro de `class DrizzleOrderRepository` en `packages/db/src/repositories/order-repository.ts`, después de `findById`:

```ts
  async attachPaymentIntent(orderId: string, stripePaymentIntentId: string): Promise<void> {
    await db.update(ordersTable).set({ stripePaymentIntentId }).where(eq(ordersTable.id, orderId));
  }

  async markAsPaid(orderId: string): Promise<void> {
    await db.update(ordersTable).set({ paymentStatus: "paid" }).where(eq(ordersTable.id, orderId));
  }
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `pnpm --filter @workspace/db run test -- order-repository`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/repositories/order-repository.ts packages/db/src/repositories/order-repository.test.ts
```

Comando sugerido: `git commit -m "Implementa attachPaymentIntent y markAsPaid en DrizzleOrderRepository"`

---

### Tarea 8: Extender `PaymentGateway` con metadata

**Files:**
- Modify: `packages/domain/src/payments/ports.ts`

**Interfaces:**
- Produces: `PaymentGateway.createPaymentIntent(amountCents, currency, metadata): Promise<{ id: string; clientSecret: string }>`.

El webhook de Stripe (Tarea 11) necesita saber a qué `orderId` corresponde cada evento — Stripe no conoce el concepto de "orden" de este dominio, así que ese vínculo viaja en `metadata`, adjunta al crear el PaymentIntent.

- [ ] **Step 1: Modificar el puerto**

```ts
// packages/domain/src/payments/ports.ts
export interface PaymentGateway {
  createPaymentIntent(
    amountCents: number,
    currency: string,
    metadata: Record<string, string>,
  ): Promise<{ id: string; clientSecret: string }>;
}
```

- [ ] **Step 2: Verificar que el dominio sigue tipando limpio**

Run: `pnpm run typecheck`
Expected: sin errores (nada implementa este puerto todavía dentro de `packages/domain`/`packages/db`)

- [ ] **Step 3: Commit**

```bash
git add packages/domain/src/payments/ports.ts
```

Comando sugerido: `git commit -m "Agrega metadata al puerto PaymentGateway para vincular el pago con la orden"`

---

### Tarea 9: `StripePaymentGateway` — adaptador en `apps/web`

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/infra/stripe-payment-gateway.ts`

**Interfaces:**
- Consumes: `PaymentGateway` de `@workspace/domain/payments` (Tarea 8).
- Produces: `StripePaymentGateway implements PaymentGateway`.

- [ ] **Step 1: Instalar el SDK de Stripe**

Run: `pnpm --filter @workspace/web add stripe`
Expected: se agrega `stripe` a las dependencies de `apps/web/package.json`

- [ ] **Step 2: Implementar el adaptador**

La validación de `STRIPE_SECRET_KEY` es lazy (dentro del método, no a nivel de módulo ni en el constructor) — mismo patrón aprendido del incidente de `packages/db/src/index.ts` en el deploy de Fase 2: validar en import-time revienta cualquier ruta de build que importe este archivo, incluso antes de que la clave llegue a hacer falta de verdad.

```ts
// apps/web/src/infra/stripe-payment-gateway.ts
import Stripe from "stripe";
import type { PaymentGateway } from "@workspace/domain/payments";

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY must be set. Card payments are not connected yet.");
  }
  return new Stripe(secretKey);
}

export class StripePaymentGateway implements PaymentGateway {
  async createPaymentIntent(
    amountCents: number,
    currency: string,
    metadata: Record<string, string>,
  ): Promise<{ id: string; clientSecret: string }> {
    const stripe = getStripeClient();
    const intent = await stripe.paymentIntents.create({ amount: amountCents, currency, metadata });

    if (!intent.client_secret) {
      throw new Error("Stripe did not return a client secret for the payment intent.");
    }
    return { id: intent.id, clientSecret: intent.client_secret };
  }
}
```

- [ ] **Step 3: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/src/infra/stripe-payment-gateway.ts
```

Comando sugerido: `git commit -m "Agrega StripePaymentGateway con validacion lazy de STRIPE_SECRET_KEY"`

---

### Tarea 10: Route Handler — crear el PaymentIntent de una orden

**Files:**
- Create: `apps/web/src/app/api/checkout/payment-intent/route.ts`

**Interfaces:**
- Consumes: `DrizzleOrderRepository` de `@workspace/db/repositories`, `StripePaymentGateway` (Tarea 9).
- Produces: `POST /api/checkout/payment-intent` — body `{ orderId: string }`, respuesta `{ clientSecret: string }` o `{ error: string }`.

- [ ] **Step 1: Implementar el Route Handler**

```ts
// apps/web/src/app/api/checkout/payment-intent/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { StripePaymentGateway } from "@/infra/stripe-payment-gateway";

const bodySchema = z.object({ orderId: z.string().uuid() });

export async function POST(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const orders = new DrizzleOrderRepository();
  const order = await orders.findById(parsed.data.orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  try {
    const gateway = new StripePaymentGateway();
    const intent = await gateway.createPaymentIntent(order.totalCents, "aud", { orderId: order.id });
    await orders.attachPaymentIntent(order.id, intent.id);
    return NextResponse.json({ clientSecret: intent.clientSecret });
  } catch {
    return NextResponse.json({ error: "Card payments are not available yet." }, { status: 503 });
  }
}
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Verificar manualmente el error explícito sin credenciales**

Con el servidor de dev corriendo (`pnpm --filter @workspace/web run dev`) y sin `STRIPE_SECRET_KEY` declarada, hacer `POST` con un `orderId` real (crear uno primero con el checkout de WhatsApp de una tarea posterior, o saltar esta verificación manual hasta la Tarea 22 donde ya existe un flujo real que la ejercita).

Expected: `503` con `{ "error": "Card payments are not available yet." }` — nunca un pago simulado como exitoso.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/checkout/payment-intent/route.ts
```

Comando sugerido: `git commit -m "Agrega el Route Handler que crea el PaymentIntent de una orden"`

---

### Tarea 11: Route Handler — webhook de Stripe

**Files:**
- Create: `apps/web/src/app/api/webhooks/stripe/route.ts`

**Interfaces:**
- Consumes: `confirmOrderPayment` de `@workspace/domain/orders` (Tarea 6), `DrizzleOrderRepository`, `DrizzleStockRepository` de `@workspace/db/repositories`.
- Produces: `POST /api/webhooks/stripe`.

- [ ] **Step 1: Implementar el webhook**

```ts
// apps/web/src/app/api/webhooks/stripe/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { confirmOrderPayment } from "@workspace/domain/orders";
import { DrizzleOrderRepository, DrizzleStockRepository } from "@workspace/db/repositories";

export async function POST(request: Request): Promise<Response> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!webhookSecret || !secretKey) {
    return NextResponse.json({ error: "Stripe webhook is not connected yet." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(secretKey);
    event = stripe.webhooks.constructEvent(rawBody, signature ?? "", webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata.orderId;
    if (orderId) {
      await confirmOrderPayment(
        { orders: new DrizzleOrderRepository(), stock: new DrizzleStockRepository() },
        orderId,
      );
    }
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/webhooks/stripe/route.ts
```

Comando sugerido: `git commit -m "Agrega el webhook de Stripe que confirma el pago de una orden"`

---

### Tarea 12: `packages/i18n` — namespace `cart`

**Files:**
- Modify: `packages/i18n/src/types.ts`
- Modify: `packages/i18n/src/dictionaries/en.ts`
- Modify: `packages/i18n/src/dictionaries/es.ts`

**Interfaces:**
- Produces: `Dictionary.cart` con todas las claves que usan el carrito y el checkout (Tareas 15-19).

- [ ] **Step 1: Agregar el namespace al tipo `Dictionary`**

En `packages/i18n/src/types.ts`, agregar antes del cierre de la interfaz (después de `footer`):

```ts
  cart: {
    title: string;
    empty: string;
    subtotal: string;
    savings: string;
    checkoutButton: string;
    remove: string;
    stepFulfillmentTitle: string;
    fulfillmentPickup: string;
    fulfillmentPickupFee: string;
    fulfillmentDelivery: string;
    stepAddressTitle: string;
    addressLine1Placeholder: string;
    addressSuburbPlaceholder: string;
    addressError: string;
    continueButton: string;
    backButton: string;
    stepContactTitle: string;
    contactNamePlaceholder: string;
    contactPhonePlaceholder: string;
    contactEmailPlaceholder: string;
    contactError: string;
    stepPaymentTitle: string;
    payWithWhatsapp: string;
    payWithCardTitle: string;
    payWithCardUnavailable: string;
    payButton: string;
    processing: string;
    confirmationTitle: string;
    confirmationBody: string;
    doneButton: string;
    total: string;
  };
```

- [ ] **Step 2: Agregar las traducciones en inglés**

En `packages/i18n/src/dictionaries/en.ts`, agregar la clave `cart` (mismo nivel que `footer`):

```ts
  cart: {
    title: "Your cart",
    empty: "Your cart is empty.",
    subtotal: "Subtotal",
    savings: "You're saving",
    checkoutButton: "Checkout",
    remove: "Remove",
    stepFulfillmentTitle: "How do you want it?",
    fulfillmentPickup: "Pickup at the trailer",
    fulfillmentPickupFee: "Free",
    fulfillmentDelivery: "Delivery by Sweet Sin",
    stepAddressTitle: "Where to?",
    addressLine1Placeholder: "Start typing your address…",
    addressSuburbPlaceholder: "Suburb",
    addressError: "Please fill in both fields.",
    continueButton: "Continue",
    backButton: "Back",
    stepContactTitle: "Your details",
    contactNamePlaceholder: "Full name",
    contactPhonePlaceholder: "Phone",
    contactEmailPlaceholder: "Email",
    contactError: "Please fill in all fields.",
    stepPaymentTitle: "Pay",
    payWithWhatsapp: "Order via WhatsApp",
    payWithCardTitle: "Pay with card",
    payWithCardUnavailable: "Card payments coming soon.",
    payButton: "Pay",
    processing: "Processing…",
    confirmationTitle: "You're in!",
    confirmationBody: "We've received your order.",
    doneButton: "Done",
    total: "Total",
  },
```

- [ ] **Step 3: Agregar las traducciones en español**

En `packages/i18n/src/dictionaries/es.ts`, agregar la clave `cart` (mismo nivel que `footer`):

```ts
  cart: {
    title: "Tu carrito",
    empty: "Tu carrito está vacío.",
    subtotal: "Subtotal",
    savings: "Estás ahorrando",
    checkoutButton: "Finalizar compra",
    remove: "Quitar",
    stepFulfillmentTitle: "¿Cómo lo querés?",
    fulfillmentPickup: "Retiro en el trailer",
    fulfillmentPickupFee: "Gratis",
    fulfillmentDelivery: "Delivery de Sweet Sin",
    stepAddressTitle: "¿A dónde lo llevamos?",
    addressLine1Placeholder: "Empezá a escribir tu dirección…",
    addressSuburbPlaceholder: "Barrio",
    addressError: "Completá ambos campos.",
    continueButton: "Continuar",
    backButton: "Atrás",
    stepContactTitle: "Tus datos",
    contactNamePlaceholder: "Nombre completo",
    contactPhonePlaceholder: "Teléfono",
    contactEmailPlaceholder: "Email",
    contactError: "Completá todos los campos.",
    stepPaymentTitle: "Pagar",
    payWithWhatsapp: "Pedir por WhatsApp",
    payWithCardTitle: "Pagar con tarjeta",
    payWithCardUnavailable: "Pagos con tarjeta próximamente.",
    payButton: "Pagar",
    processing: "Procesando…",
    confirmationTitle: "¡Listo!",
    confirmationBody: "Recibimos tu pedido.",
    doneButton: "Listo",
    total: "Total",
  },
```

- [ ] **Step 4: Correr el test de paridad de claves**

Run: `pnpm --filter @workspace/i18n run test`
Expected: PASS

- [ ] **Step 5: Verificar que `apps/web` sigue tipando limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 6: Commit**

```bash
git add packages/i18n/src/types.ts packages/i18n/src/dictionaries/en.ts packages/i18n/src/dictionaries/es.ts
```

Comando sugerido: `git commit -m "Agrega el namespace cart a los diccionarios de i18n"`

---

### Tarea 13: `CartProvider` — estado del carrito de invitado en `localStorage`

**Files:**
- Create: `apps/web/src/lib/cart-store.tsx`

**Interfaces:**
- Consumes: `Product` de `@workspace/domain/products`, `getLineTotalCents` de `@workspace/domain/pricing` (ya existen desde Fase 1).
- Produces: `CartProvider({ children, products }): JSX.Element`, `useCart(): CartContextValue` con `{ items, products, add, remove, setQty, clear, totalQty, subtotalCents, savingsCents, isDrawerOpen, openDrawer, closeDrawer, isCheckoutOpen, openCheckout, closeCheckout }`.

Reemplaza a `apps/web-legacy/src/lib/cart.tsx`, adaptado: en vez de calcular contra el array `products` hardcodeado del legacy, recibe la lista real de Postgres como prop. El total mostrado acá es solo una aproximación visual — el total que efectivamente se cobra sale siempre de `createOrder` en el servidor (Fase 0).

- [ ] **Step 1: Implementar el Context**

```tsx
// apps/web/src/lib/cart-store.tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Product } from "@workspace/domain/products";
import { getLineTotalCents } from "@workspace/domain/pricing";

export interface CartLine {
  productId: string;
  quantity: number;
}

interface CartContextValue {
  items: CartLine[];
  products: Product[];
  add: (productId: string) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, quantity: number) => void;
  clear: () => void;
  totalQty: number;
  subtotalCents: number;
  savingsCents: number;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  isCheckoutOpen: boolean;
  openCheckout: () => void;
  closeCheckout: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "sweet-sin-cart";

export function CartProvider({ children, products }: { children: ReactNode; products: Product[] }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // localStorage puede fallar (modo privado, storage bloqueado) — el carrito simplemente arranca vacío.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ver comentario del efecto de arriba
    }
  }, [items, hydrated]);

  const add = (productId: string) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) return prev.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const remove = (productId: string) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i));
    });
  };

  const setQty = (productId: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.productId !== productId);
      const existing = prev.find((i) => i.productId === productId);
      if (existing) return prev.map((i) => (i.productId === productId ? { ...i, quantity } : i));
      return [...prev, { productId, quantity }];
    });
  };

  const clear = () => setItems([]);

  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);

  const subtotalCents = items.reduce((sum, i) => {
    const product = products.find((p) => p.id === i.productId);
    if (!product) return sum;
    return sum + getLineTotalCents(product.priceCents, i.quantity, product.category);
  }, 0);

  const savingsCents = items.reduce((sum, i) => {
    const product = products.find((p) => p.id === i.productId);
    if (!product) return sum;
    const fullPriceCents = product.priceCents * i.quantity;
    return sum + (fullPriceCents - getLineTotalCents(product.priceCents, i.quantity, product.category));
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        products,
        add,
        remove,
        setQty,
        clear,
        totalQty,
        subtotalCents,
        savingsCents,
        isDrawerOpen,
        openDrawer: () => setDrawerOpen(true),
        closeDrawer: () => setDrawerOpen(false),
        isCheckoutOpen,
        openCheckout: () => setCheckoutOpen(true),
        closeCheckout: () => setCheckoutOpen(false),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/cart-store.tsx
```

Comando sugerido: `git commit -m "Agrega CartProvider con persistencia en localStorage para el carrito de invitado"`

---

### Tarea 14: Botones de agregar/quitar en `MenuCard`

**Files:**
- Modify: `apps/web/src/components/sections/menu-grid.tsx`

**Interfaces:**
- Consumes: `useCart` de `@/lib/cart-store` (Tarea 13).

- [ ] **Step 1: Conectar `MenuCard` al carrito**

En `apps/web/src/components/sections/menu-grid.tsx`, agregar el import:

```ts
import { useCart } from "@/lib/cart-store";
```

Modificar la función `MenuCard` para agregar los controles de cantidad. Reemplazar el bloque final (`<div className="flex items-center justify-between mt-auto pt-2">...</div>`) por:

```tsx
function MenuCard({ product, locale }: { product: Product; locale: "en" | "es" }) {
  const name = locale === "en" ? product.nameEn : product.nameEs;
  const description = locale === "en" ? product.descriptionEn : product.descriptionEs;
  const price = (product.priceCents / 100).toFixed(2);
  const { items, add, remove } = useCart();
  const quantity = items.find((i) => i.productId === product.id)?.quantity ?? 0;

  return (
    <div className="menu-card bg-white border border-navy/[0.07] rounded-2xl overflow-hidden group transition-all duration-300 hover:border-sin-red/30 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(230,57,70,0.10)] flex flex-col">
      <div className="aspect-square bg-cream-dark relative overflow-hidden">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cream to-cream-dark" />
        )}

        <div
          className={`absolute top-2 left-2 px-2 py-0.5 rounded-full font-mono text-[8px] md:text-[9px] tracking-[0.12em] uppercase z-20 ${
            product.category === "sin" ? "bg-sin-red/90 text-white" : "bg-navy/90 text-cream"
          }`}
        >
          {product.category}
        </div>
      </div>

      <div className="p-3 md:p-5 flex flex-col flex-1 gap-2">
        <div>
          <h3 className="font-serif font-bold text-[14px] md:text-[18px] text-navy leading-tight">{name}</h3>
          <p className="text-[11px] md:text-[13px] text-navy/45 leading-relaxed mt-1 hidden md:block">{description}</p>
        </div>

        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="font-mono text-[13px] md:text-[16px] text-sin-red font-semibold">${price}</span>

          {quantity === 0 ? (
            <button
              onClick={() => add(product.id)}
              className="w-8 h-8 rounded-full bg-sin-red text-white flex items-center justify-center hover:bg-sin-red-light transition-colors"
              aria-label={`Add ${name}`}
            >
              +
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => remove(product.id)}
                className="w-7 h-7 rounded-full border border-navy/15 text-navy flex items-center justify-center hover:border-sin-red hover:text-sin-red transition-colors"
                aria-label={`Remove one ${name}`}
              >
                −
              </button>
              <span className="font-mono text-[13px] text-navy w-4 text-center">{quantity}</span>
              <button
                onClick={() => add(product.id)}
                className="w-7 h-7 rounded-full bg-sin-red text-white flex items-center justify-center hover:bg-sin-red-light transition-colors"
                aria-label={`Add one more ${name}`}
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores (fallará hasta que `page.tsx` envuelva el árbol con `CartProvider` en la Tarea 21 — `useCart()` lanza en runtime si no hay Provider, pero eso no es un error de tipos)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/sections/menu-grid.tsx
```

Comando sugerido: `git commit -m "Agrega los controles de agregar/quitar al catalogo"`

---

### Tarea 15: Ícono de carrito en `Navbar`

**Files:**
- Modify: `apps/web/src/components/layout/navbar.tsx`

**Interfaces:**
- Consumes: `useCart` de `@/lib/cart-store` (Tarea 13).

- [ ] **Step 1: Agregar el ícono con badge**

En `apps/web/src/components/layout/navbar.tsx`, agregar el import:

```ts
import { useCart } from "@/lib/cart-store";
```

Dentro de `export function Navbar()`, agregar junto a las demás llamadas a hooks:

```ts
  const { totalQty, openDrawer } = useCart();
```

Y agregar el botón dentro del `<div className="flex items-center gap-3">`, antes del botón "Order Now" desktop:

```tsx
        <button
          onClick={openDrawer}
          className="relative w-10 h-10 flex items-center justify-center text-navy/70 hover:text-sin-red transition-colors"
          aria-label="Open cart"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          {totalQty > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-sin-red text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {totalQty}
            </span>
          )}
        </button>
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/navbar.tsx
```

Comando sugerido: `git commit -m "Agrega el icono de carrito con badge al Navbar"`

---

### Tarea 16: Conectar el tab "order" de `MobileNav` al carrito

**Files:**
- Modify: `apps/web/src/components/layout/mobile-nav.tsx`

**Interfaces:**
- Consumes: `useCart` de `@/lib/cart-store` (Tarea 13).

- [ ] **Step 1: Reemplazar el `href="#menu"` del tab "order" por abrir el drawer**

En `apps/web/src/components/layout/mobile-nav.tsx`, agregar el import:

```ts
import { useCart } from "@/lib/cart-store";
```

Dentro de `export function MobileNav()`, agregar:

```ts
  const { totalQty, openDrawer } = useCart();
```

Reemplazar el comentario y el array `tabs` (que hoy apuntan el tab "order" a `#menu`) y el render de cada tab para que "order" dispare `openDrawer()` en vez de navegar:

```tsx
  const tabs = [
    { id: "menu", label: t("menu"), href: "#menu" },
    { id: "events", label: t("events"), href: "#events" },
    { id: "order", label: t("order"), href: null },
    { id: "find-us", label: t("findUs"), href: "#find-us" },
  ];
```

```tsx
      {tabs.map((tab) =>
        tab.href ? (
          <a
            key={tab.id}
            href={tab.href}
            onClick={() => setActiveTab(tab.id)}
            className="flex flex-col items-center justify-center w-full h-full gap-1"
          >
            <span className={`transition-all ${activeTab === tab.id ? "scale-110 text-sin-red" : "opacity-50 text-white"}`}>
              <TabIcon id={tab.id} />
            </span>
            {activeTab === tab.id && (
              <span className="text-[9px] font-mono uppercase tracking-wider text-sin-red">{tab.label}</span>
            )}
          </a>
        ) : (
          <button
            key={tab.id}
            onClick={openDrawer}
            className="relative flex flex-col items-center justify-center w-full h-full gap-1"
          >
            <span className="opacity-50 text-white">
              <TabIcon id={tab.id} />
            </span>
            {totalQty > 0 && (
              <span className="absolute top-1 right-1/2 translate-x-3 w-3.5 h-3.5 bg-sin-red text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                {totalQty}
              </span>
            )}
          </button>
        ),
      )}
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/mobile-nav.tsx
```

Comando sugerido: `git commit -m "Conecta el tab order de MobileNav para abrir el carrito"`

---

### Tarea 17: `CartDrawer`

**Files:**
- Create: `apps/web/src/components/cart/cart-drawer.tsx`

**Interfaces:**
- Consumes: `useCart` de `@/lib/cart-store` (Tarea 13).
- Produces: `CartDrawer(): JSX.Element`.

- [ ] **Step 1: Implementar el drawer**

```tsx
// apps/web/src/components/cart/cart-drawer.tsx
"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useCart } from "@/lib/cart-store";

export function CartDrawer() {
  const t = useTranslations("cart");
  const locale = useLocale();
  const { items, products, isDrawerOpen, closeDrawer, setQty, subtotalCents, savingsCents, openCheckout } = useCart();

  if (!isDrawerOpen) return null;

  return (
    <>
      <div onClick={closeDrawer} className="fixed inset-0 z-[190] bg-navy/40 backdrop-blur-sm" />
      <div className="fixed inset-y-0 right-0 z-[195] w-full max-w-md bg-white shadow-[-8px_0_48px_rgba(15,27,61,0.18)] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-navy/10">
          <h3 className="font-serif font-bold text-navy text-xl">{t("title")}</h3>
          <button onClick={closeDrawer} aria-label="Close" className="text-navy/40 hover:text-navy transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="text-navy/40 text-sm font-mono text-center mt-12">{t("empty")}</p>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const product = products.find((p) => p.id === item.productId);
                if (!product) return null;
                const name = locale === "en" ? product.nameEn : product.nameEs;

                return (
                  <div key={item.productId} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-navy">{name}</p>
                      <p className="text-xs text-navy/40 font-mono">${(product.priceCents / 100).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQty(item.productId, item.quantity - 1)}
                        className="w-7 h-7 rounded-full border border-navy/15 text-navy flex items-center justify-center hover:border-sin-red hover:text-sin-red transition-colors"
                      >
                        −
                      </button>
                      <span className="font-mono text-sm text-navy w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => setQty(item.productId, item.quantity + 1)}
                        className="w-7 h-7 rounded-full bg-sin-red text-white flex items-center justify-center hover:bg-sin-red-light transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="px-6 py-5 border-t border-navy/10 space-y-3">
            {savingsCents > 0 && (
              <p className="text-[13px] text-sin-red font-medium">
                {t("savings")} ${(savingsCents / 100).toFixed(2)}
              </p>
            )}
            <div className="flex justify-between items-center">
              <span className="font-mono text-[11px] uppercase tracking-wider text-navy/40">{t("subtotal")}</span>
              <span className="font-serif font-bold text-navy text-xl">${(subtotalCents / 100).toFixed(2)}</span>
            </div>
            <button
              onClick={openCheckout}
              className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors"
            >
              {t("checkoutButton")}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/cart/cart-drawer.tsx
```

Comando sugerido: `git commit -m "Agrega el CartDrawer"`

---

### Tarea 18: Server Action `placeOrderAction`

**Files:**
- Create: `apps/web/src/app/actions/checkout.ts`

**Interfaces:**
- Consumes: `createOrder` de `@workspace/domain/orders`, `DrizzleOrderRepository`, `DrizzleProductRepository`, `DrizzleSettingsRepository` de `@workspace/db/repositories`.
- Produces: `PlaceOrderInput`, `PlaceOrderResult { orderId: string; totalCents: number }`, `placeOrderAction(input: PlaceOrderInput): Promise<PlaceOrderResult>`.

A diferencia de `requestEventQuoteAction` (Fase 2, invocado desde `<form action={formAction}>` vía `useActionState`), este Server Action se llama como una función `async` normal desde un `onClick` del modal — el checkout es un flujo multi-paso con estado propio del lado cliente (paso actual, dirección, contacto), y necesita el `orderId`/`totalCents` de vuelta para decidir el siguiente paso (armar el link de WhatsApp, o pedir el `clientSecret` de Stripe). Next.js soporta llamar una función `"use server"` como RPC directo igual que a través de un `<form>`.

- [ ] **Step 1: Implementar el Server Action**

```ts
// apps/web/src/app/actions/checkout.ts
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
```

`checkoutSchema.parse` (no `safeParse`) lanza si el input es inválido — a diferencia del formulario de eventos (Fase 2), acá no hay `FormData` cruda del navegador que pueda venir mal formada por fuera de nuestro control: el modal ya validó los campos requeridos antes de llamar a esta función, así que un input inválido acá es un bug del cliente, no una entrada de usuario a tolerar silenciosamente.

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/actions/checkout.ts
```

Comando sugerido: `git commit -m "Agrega el Server Action placeOrderAction"`

---

### Tarea 19: Instalar Stripe Elements en el cliente

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Instalar los paquetes de cliente de Stripe**

Run: `pnpm --filter @workspace/web add @stripe/stripe-js @stripe/react-stripe-js`
Expected: ambos paquetes agregados a las dependencies de `apps/web/package.json`

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json
```

Comando sugerido: `git commit -m "Instala los paquetes de cliente de Stripe"`

(el `pnpm-lock.yaml` se actualiza junto con el `package.json` en el mismo `pnpm add` — agregarlo también si `git status` lo muestra modificado)

---

### Tarea 20: `CheckoutModal`

**Files:**
- Create: `apps/web/src/components/cart/checkout-modal.tsx`

**Interfaces:**
- Consumes: `useCart` de `@/lib/cart-store` (Tarea 13), `placeOrderAction` de `@/app/actions/checkout` (Tarea 18), `ensureGoogleMapsOptionsSet` de `@/lib/google-maps` (ya existe desde Fase 2).
- Produces: `CheckoutModal(): JSX.Element`.

Reconstruye `apps/web-legacy/src/components/ui/CheckoutModal.tsx` sin el paso "courier" (fuera de alcance). El pago con tarjeta usa Stripe Elements si `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` está declarada; si no, muestra un estado deshabilitado — mismo patrón de fallback explícito que `LocationMap` (Fase 2) usa para el mapa sin API key, en vez de romper el build o simular un pago.

- [ ] **Step 1: Implementar el modal**

```tsx
// apps/web/src/components/cart/checkout-modal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary } from "@googlemaps/js-api-loader";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useTranslations } from "next-intl";
import { useCart } from "@/lib/cart-store";
import { placeOrderAction } from "@/app/actions/checkout";
import { ensureGoogleMapsOptionsSet } from "@/lib/google-maps";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

type Fulfillment = "pickup" | "self_delivery";
type Step = "fulfillment" | "address" | "contact" | "payment" | "confirmation";

const inputClass =
  "w-full bg-cream border border-navy/12 rounded-2xl px-5 py-3.5 text-sm text-navy placeholder:text-navy/35 focus:border-sin-red outline-none transition-colors";

function getAddressComponent(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  type: string,
): string {
  return components?.find((c) => c.types.includes(type))?.long_name ?? "";
}

export function CheckoutModal() {
  const t = useTranslations("cart");
  const { items, products, subtotalCents, savingsCents, clear, isCheckoutOpen, closeCheckout } = useCart();

  const [step, setStep] = useState<Step>("fulfillment");
  const [fulfillment, setFulfillment] = useState<Fulfillment | null>(null);
  const [address, setAddress] = useState({ line1: "", suburb: "" });
  const [contact, setContact] = useState({ name: "", phone: "", email: "" });
  const [addressError, setAddressError] = useState("");
  const [contactError, setContactError] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== "address" || !addressInputRef.current || !ensureGoogleMapsOptionsSet()) return;
    let cancelled = false;
    let listener: google.maps.MapsEventListener | null = null;

    importLibrary("places").then(({ Autocomplete }) => {
      if (cancelled || !addressInputRef.current) return;
      const autocomplete = new Autocomplete(addressInputRef.current, {
        componentRestrictions: { country: "au" },
        fields: ["address_components", "formatted_address"],
      });
      listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const streetNumber = getAddressComponent(place.address_components, "street_number");
        const route = getAddressComponent(place.address_components, "route");
        const suburb = getAddressComponent(place.address_components, "locality");
        setAddress({
          line1: [streetNumber, route].filter(Boolean).join(" ") || place.formatted_address || "",
          suburb,
        });
      });
    });

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, [step]);

  if (!isCheckoutOpen) return null;

  function reset() {
    setStep("fulfillment");
    setFulfillment(null);
    setAddress({ line1: "", suburb: "" });
    setContact({ name: "", phone: "", email: "" });
    setAddressError("");
    setContactError("");
    setIsPlacing(false);
    setClientSecret(null);
  }

  function handleClose() {
    closeCheckout();
    reset();
  }

  function chooseFulfillment(choice: Fulfillment) {
    setFulfillment(choice);
    setStep(choice === "pickup" ? "contact" : "address");
  }

  function submitAddress() {
    if (!address.line1.trim() || !address.suburb.trim()) {
      setAddressError(t("addressError"));
      return;
    }
    setAddressError("");
    setStep("contact");
  }

  function submitContact() {
    if (!contact.name.trim() || !contact.phone.trim() || !contact.email.trim()) {
      setContactError(t("contactError"));
      return;
    }
    setContactError("");
    setStep("payment");
  }

  function goBack() {
    if (step === "address") setStep("fulfillment");
    else if (step === "contact") setStep(fulfillment === "pickup" ? "fulfillment" : "address");
    else if (step === "payment") setStep("contact");
  }

  const orderItems = items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
  const deliveryAddress =
    fulfillment === "self_delivery" ? `${address.line1}, ${address.suburb}` : undefined;

  async function payWithWhatsApp() {
    setIsPlacing(true);
    try {
      const result = await placeOrderAction({
        fulfillmentType: fulfillment ?? "pickup",
        deliveryAddress,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        channel: "whatsapp",
        items: orderItems,
      });

      const lines = items.map((i) => {
        const product = products.find((p) => p.id === i.productId);
        return `• ${i.quantity}x ${product?.nameEn ?? ""}`;
      });
      const text = [
        `Hi! I'd like to place an order with Sweet Sin (order ${result.orderId})`,
        "",
        ...lines,
        "",
        `Total: $${(result.totalCents / 100).toFixed(2)}`,
        deliveryAddress ? `Address: ${deliveryAddress}` : "Pickup at the trailer",
        `Name: ${contact.name}`,
        `Phone: ${contact.phone}`,
      ].join("\n");

      window.open(`https://wa.me/61433508831?text=${encodeURIComponent(text)}`, "_blank");
      clear();
      handleClose();
    } finally {
      setIsPlacing(false);
    }
  }

  async function startCardPayment() {
    setIsPlacing(true);
    try {
      const result = await placeOrderAction({
        fulfillmentType: fulfillment ?? "pickup",
        deliveryAddress,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        channel: "web",
        items: orderItems,
      });

      const response = await fetch("/api/checkout/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: result.orderId }),
      });
      const data = await response.json();
      if (data.clientSecret) setClientSecret(data.clientSecret);
    } finally {
      setIsPlacing(false);
    }
  }

  function finishConfirmation() {
    clear();
    handleClose();
  }

  return (
    <>
      <div onClick={handleClose} className="fixed inset-0 z-[190] bg-navy/40 backdrop-blur-sm" />
      <div className="fixed inset-x-0 bottom-0 z-[195] bg-white rounded-t-3xl shadow-[0_-8px_48px_rgba(15,27,61,0.18)] max-h-[85vh] flex flex-col">
        <div className="w-12 h-1 bg-navy/15 rounded-full mx-auto mt-3 mb-4 flex-shrink-0" />

        <div className="px-6 pb-8 overflow-y-auto">
          {step !== "fulfillment" && step !== "confirmation" && (
            <button
              onClick={goBack}
              className="font-mono text-[10px] uppercase tracking-wider text-navy/40 hover:text-sin-red transition-colors mb-4"
            >
              ← {t("backButton")}
            </button>
          )}

          {step === "fulfillment" && (
            <div>
              <h3 className="font-serif font-bold text-navy text-xl mb-6">{t("stepFulfillmentTitle")}</h3>
              <div className="space-y-3">
                <button
                  onClick={() => chooseFulfillment("pickup")}
                  className="w-full text-left border border-navy/10 rounded-2xl p-4 hover:border-sin-red transition-colors"
                >
                  <p className="font-medium text-navy">{t("fulfillmentPickup")}</p>
                  <p className="text-[13px] text-navy/50">{t("fulfillmentPickupFee")}</p>
                </button>
                <button
                  onClick={() => chooseFulfillment("self_delivery")}
                  className="w-full text-left border border-navy/10 rounded-2xl p-4 hover:border-sin-red transition-colors"
                >
                  <p className="font-medium text-navy">{t("fulfillmentDelivery")}</p>
                </button>
              </div>
            </div>
          )}

          {step === "address" && (
            <div>
              <h3 className="font-serif font-bold text-navy text-xl mb-4">{t("stepAddressTitle")}</h3>
              <div className="space-y-3 mb-4">
                <input
                  ref={addressInputRef}
                  value={address.line1}
                  onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                  placeholder={t("addressLine1Placeholder")}
                  autoComplete="off"
                  className={inputClass}
                />
                <input
                  value={address.suburb}
                  onChange={(e) => setAddress((a) => ({ ...a, suburb: e.target.value }))}
                  placeholder={t("addressSuburbPlaceholder")}
                  className={inputClass}
                />
              </div>
              {addressError && <p className="text-sin-red text-[12px] mb-4">{addressError}</p>}
              <button
                onClick={submitAddress}
                className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors"
              >
                {t("continueButton")}
              </button>
            </div>
          )}

          {step === "contact" && (
            <div>
              <h3 className="font-serif font-bold text-navy text-xl mb-6">{t("stepContactTitle")}</h3>
              <div className="space-y-3 mb-4">
                <input
                  value={contact.name}
                  onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                  placeholder={t("contactNamePlaceholder")}
                  className={inputClass}
                />
                <input
                  value={contact.phone}
                  onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                  placeholder={t("contactPhonePlaceholder")}
                  className={inputClass}
                />
                <input
                  value={contact.email}
                  onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                  placeholder={t("contactEmailPlaceholder")}
                  type="email"
                  className={inputClass}
                />
              </div>
              {contactError && <p className="text-sin-red text-[12px] mb-4">{contactError}</p>}
              <button
                onClick={submitContact}
                className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors"
              >
                {t("continueButton")}
              </button>
            </div>
          )}

          {step === "payment" && (
            <div>
              <h3 className="font-serif font-bold text-navy text-xl mb-2">{t("stepPaymentTitle")}</h3>
              {savingsCents > 0 && (
                <p className="text-[13px] text-sin-red font-medium mb-2">
                  {t("savings")} ${(savingsCents / 100).toFixed(2)}
                </p>
              )}
              <div className="flex justify-between items-center border-t border-b border-navy/10 py-3 mb-6">
                <span className="font-mono text-[11px] uppercase tracking-wider text-navy/40">{t("total")}</span>
                <span className="font-serif font-bold text-navy text-xl">${(subtotalCents / 100).toFixed(2)}</span>
              </div>

              <button
                onClick={payWithWhatsApp}
                disabled={isPlacing}
                className="w-full bg-navy text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-navy-mid transition-colors mb-3 disabled:opacity-50"
              >
                {isPlacing ? t("processing") : t("payWithWhatsapp")}
              </button>

              <div className="border border-navy/10 rounded-2xl p-4 space-y-3">
                <p className="font-medium text-navy text-[14px]">{t("payWithCardTitle")}</p>
                {!stripePromise ? (
                  <p className="text-navy/40 text-[13px] font-mono">{t("payWithCardUnavailable")}</p>
                ) : clientSecret ? (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <StripeCardForm onSuccess={() => setStep("confirmation")} />
                  </Elements>
                ) : (
                  <button
                    onClick={startCardPayment}
                    disabled={isPlacing}
                    className="w-full bg-sin-red text-white py-3.5 rounded-xl font-bold text-[14px] tracking-wide hover:bg-sin-red-light transition-colors disabled:opacity-60"
                  >
                    {isPlacing ? t("processing") : `${t("payButton")} $${(subtotalCents / 100).toFixed(2)}`}
                  </button>
                )}
              </div>
            </div>
          )}

          {step === "confirmation" && (
            <div className="text-center py-4">
              <h3 className="font-serif font-bold text-navy text-xl mb-2">{t("confirmationTitle")}</h3>
              <p className="text-navy/50 text-[14px] mb-6">{t("confirmationBody")}</p>
              <button
                onClick={finishConfirmation}
                className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors"
              >
                {t("doneButton")}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StripeCardForm({ onSuccess }: { onSuccess: () => void }) {
  const t = useTranslations("cart");
  const stripe = useStripe();
  const elements = useElements();
  const [isConfirming, setIsConfirming] = useState(false);

  async function handleConfirm() {
    if (!stripe || !elements) return;
    setIsConfirming(true);
    const { error } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    setIsConfirming(false);
    if (!error) onSuccess();
  }

  return (
    <div className="space-y-3">
      <PaymentElement />
      <button
        onClick={handleConfirm}
        disabled={isConfirming || !stripe}
        className="w-full bg-sin-red text-white py-3.5 rounded-xl font-bold text-[14px] tracking-wide hover:bg-sin-red-light transition-colors disabled:opacity-60"
      >
        {isConfirming ? t("processing") : t("payButton")}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/cart/checkout-modal.tsx
```

Comando sugerido: `git commit -m "Reconstruye el CheckoutModal con WhatsApp funcional y Stripe Elements"`

---

### Tarea 21: Ensamblar — `page.tsx` envuelve el árbol con `CartProvider`

**Files:**
- Modify: `apps/web/src/app/[locale]/page.tsx`
- Modify: `apps/web/src/components/sections/menu.tsx`

**Interfaces:**
- Consumes: `CartProvider` (Tarea 13), `CartDrawer` (Tarea 17), `CheckoutModal` (Tarea 20), `listAvailableProducts` de `@workspace/domain/products`, `DrizzleProductRepository` de `@workspace/db/repositories`.

`Menu` deja de hacer su propio fetch de productos y los recibe como prop — evita una segunda query idéntica a la que `page.tsx` ya necesita hacer para pasarle la misma lista al `CartProvider`.

- [ ] **Step 1: Convertir `Menu` en presentacional**

```tsx
// apps/web/src/components/sections/menu.tsx
import type { Product } from "@workspace/domain/products";
import { MenuGrid } from "./menu-grid";

export function Menu({ products }: { products: Product[] }) {
  return <MenuGrid products={products} />;
}
```

- [ ] **Step 2: Cargar productos una vez en `page.tsx` y envolver el árbol**

```tsx
// apps/web/src/app/[locale]/page.tsx
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { listAvailableProducts } from "@workspace/domain/products";
import { DrizzleProductRepository } from "@workspace/db/repositories";
import { CartProvider } from "@/lib/cart-store";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CheckoutModal } from "@/components/cart/checkout-modal";
import { Navbar } from "@/components/layout/navbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Hero } from "@/components/sections/hero";
import { BrandStory } from "@/components/sections/brand-story";
import { Menu } from "@/components/sections/menu";
import { Events } from "@/components/sections/events";
import { FindUs } from "@/components/sections/find-us";
import { Footer } from "@/components/sections/footer";

// El catálogo (Menu) y las paradas (FindUs) consultan Postgres en vivo —
// sin esto, generateStaticParams() del layout hace que next build intente
// pre-renderizar la página estáticamente, ejecutando esas queries contra
// la DB real *en build time* y congelando los datos hasta el próximo
// deploy. force-dynamic obliga a Next a renderizar en cada request real.
export const dynamic = "force-dynamic";

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const products = await listAvailableProducts(new DrizzleProductRepository());

  return (
    <CartProvider products={products}>
      <main className="w-full min-h-screen bg-sweet-dark text-cream selection:bg-sin-red selection:text-white pb-14 md:pb-0">
        <Navbar />
        <Hero />
        <BrandStory />
        <Menu products={products} />
        <Events />
        <FindUs />
        <Footer />
        <MobileNav />
      </main>
      <CartDrawer />
      <CheckoutModal />
    </CartProvider>
  );
}
```

- [ ] **Step 3: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/[locale]/page.tsx apps/web/src/components/sections/menu.tsx
```

Comando sugerido: `git commit -m "Ensambla CartProvider, CartDrawer y CheckoutModal en la pagina principal"`

---

### Tarea 22: Verificación end-to-end

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Typecheck completo**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 2: Suite completa de tests**

Run: `pnpm run test`
Expected: todos los tests de `packages/domain` y `packages/db` en verde, incluyendo los nuevos de `cart`, `settings`, `confirmOrderPayment` y los métodos nuevos de `DrizzleOrderRepository`

- [ ] **Step 3: Build completo**

Run: `pnpm run build`
Expected: build de `apps/web` exitoso. Confirmar en el output que sigue siendo `● /[locale]` con `force-dynamic` (revisar `.next/prerender-manifest.json` si hay dudas, mismo método que en Fase 2 — no confiar solo en el símbolo de la tabla resumen)

- [ ] **Step 4: Smoke test manual — checkout de invitado vía WhatsApp**

Con `pnpm --filter @workspace/web run dev` corriendo: agregar un producto al carrito desde el catálogo, abrir el drawer, ir a checkout, elegir "Pickup", completar contacto con datos de prueba reales (usar un email identificable, ej. `qa-fase3@example.com`), y confirmar "Order via WhatsApp". Verificar:
- Se abre una pestaña de WhatsApp con el mensaje armado y el total correcto.
- La orden quedó persistida: query directa a `orders`/`order_items` por `customer_email = 'qa-fase3@example.com'` confirma la fila real, con `channel = 'whatsapp'` y `payment_status = 'pending'`.
- Borrar esa fila de prueba (y su `order_items` asociada) inmediatamente después, igual que se hizo con la cotización de prueba de Fase 2 — no dejar datos de prueba en la DB compartida dev=prod.

- [ ] **Step 5: Smoke test manual — pago con tarjeta sin credenciales**

En el mismo flujo, en el paso de pago, hacer clic en el botón de tarjeta. Confirmar que la respuesta es el mensaje de error explícito (`503`, "Card payments are not available yet.") — nunca un pago simulado como exitoso. Este es el comportamiento esperado y correcto mientras falten las credenciales de Stripe.

- [ ] **Step 6: Confirmar que el carrito persiste entre recargas**

Agregar un producto, recargar la página (`F5`), confirmar que el contador del ícono de carrito sigue mostrando la cantidad correcta (persistencia real de `localStorage`, no solo de memoria de React).

- [ ] **Step 7: Commit**

Si esta tarea no modificó ningún archivo de código (solo verificó), no hay nada que commitear — pasar directamente a la Tarea 23.

---

### Tarea 23: Actualizar `CLAUDE.md` y `handoff.md`

**Files:**
- Modify: `CLAUDE.md`
- Modify: `handoff.md`

- [ ] **Step 1: Actualizar `CLAUDE.md`**

En la sección **Run & Operate**, agregar una línea documentando las variables de Stripe que faltan:

```
- Variables de Stripe pendientes de credenciales reales: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (`apps/web/.env.local`) y `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — sin ellas, el checkout de invitado (pickup/self-delivery, pago vía WhatsApp) funciona igual; el pago con tarjeta responde explícitamente "not available yet", nunca simula un pago exitoso.
```

En la sección **Architecture decisions**, agregar una entrada sobre el carrito y la configuración editable:

```
- **Carrito y checkout (Fase 3):** carrito de invitado 100% en `localStorage` (sin cuenta, `orders.customerId = null`); `CartRepository`/`syncCart`/`mergeGuestCart` server-side construidos y probados desde ya, pero sin ningún flujo de UI que los invoque todavía — se conectan en Fase 4 cuando exista sesión real de Auth.js. El fee de self-delivery vive en la tabla `settings` (fila única, no una constante en código) para poder editarse desde el panel admin sin tocar el dominio.
```

En **Gotchas**, agregar:

```
- `PaymentGateway.createPaymentIntent` recibe `metadata: Record<string, string>` — el webhook de Stripe (`apps/web/src/app/api/webhooks/stripe/route.ts`) depende de que `metadata.orderId` viaje en el PaymentIntent para saber qué orden confirmar; si se crea un PaymentIntent por otra vía sin ese metadata, el webhook no tiene forma de vincularlo a una orden.
```

- [ ] **Step 2: Reescribir `handoff.md`**

Actualizar **Objetivo** y **Estado actual** para reflejar Fase 3, agregar la sección de **Archivos y cambios** de esta fase, sumar los intentos fallidos que hayan surgido durante la ejecución real (si los hubo, numerados a continuación del último de Fase 2), y actualizar **Próximos pasos**: conectar credenciales de Stripe cuando lleguen (probar el flujo de tarjeta end-to-end, sin las cuales el panel de pago queda con el mensaje "coming soon"), y arrancar Fase 4 (Auth.js + panel admin básico) solo cuando el owner lo pida explícitamente.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md handoff.md
```

Comando sugerido: `git commit -m "Documenta la Fase 3 en CLAUDE.md y handoff.md"`

---

### Tarea 24: Deploy a producción

**Files:** ninguno (operación de deploy)

- [ ] **Step 1: Push**

El owner ejecuta `git push` manualmente (Claude no lo hace por su cuenta).

- [ ] **Step 2: Advertencia operativa — variables de Stripe**

Antes de dar el deploy por completo, confirmar en el panel de EasyPanel para el servicio `apps/web`: **no hace falta declarar ninguna variable de Stripe todavía** — el código maneja su ausencia explícitamente (checkout de invitado funcional, pago con tarjeta responde "not available yet"). Cuando lleguen las credenciales reales, declarar `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — esta última, al ser `NEXT_PUBLIC_*`, necesita estar disponible en build-time (ver el `ARG`/`ENV` que Fase 2 ya agregó a `apps/web/Dockerfile` para `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — el mismo patrón aplica: agregar un `ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` análogo cuando llegue el momento).

- [ ] **Step 3: Verificar el log de build y el sitio real**

Confirmar en el log de EasyPanel que el build pasa limpio, y verificar en `https://sweetsin.com.au/` (ambos idiomas) que: el catálogo muestra los controles de agregar/quitar, el ícono de carrito del Navbar/MobileNav abre el drawer, y el checkout de invitado vía WhatsApp persiste una orden real (mismo procedimiento de verificación que la Tarea 22, contra producción — insertar con datos identificables, confirmar, borrar).

- [ ] **Step 4: Confirmar que el servicio `apps/api` sigue pendiente de EasyPanel**

Recordatorio heredado de Fase 1/2: el servicio roto `apps/api` en EasyPanel sigue pendiente de pausar/eliminar manualmente — fuera del alcance de Claude, el owner lo gestiona directamente en el panel.
