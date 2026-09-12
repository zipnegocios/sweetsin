# Fase 1 — Cimientos: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar la base completa del negocio (schema de Postgres, dominio hexagonal puro y testeado, repositorios concretos) sólida antes de construir ninguna UI, retirando por completo el prototipo Vite/Express descartado.

**Architecture:** Hexagonal estricta. `packages/domain` contiene entidades, puertos (interfaces) y casos de uso en TypeScript puro (cero imports de Drizzle/Next.js/Stripe/Expo). `packages/db` implementa esos puertos con Drizzle contra Postgres. `apps/web` pasa a ser un scaffold de Next.js 15 vacío (el consumo real del dominio llega en Fase 2+). `packages/notifications` queda como esqueleto vacío (adaptadores llegan en Fase 6).

**Tech Stack:** TypeScript 5.9, Drizzle ORM + `pg` (node-postgres), Zod (`zod/v4` — no se usa todavía en Fase 1, ver nota de alcance), Vitest, Next.js 15, pnpm workspaces.

## Global Constraints

- `snake_case` en columnas Postgres (decisión #2, confirmada por default).
- `orders.customer_id` es **nullable** (decisión #3 — checkout de invitado).
- Se agregan `carts`/`cart_items` en este schema aunque su lógica de merge se construye recién en Fase 3 (decisión #4).
- `products` lleva campos bilingües `name_en`/`name_es`/`description_en`/`description_es` (decisión #1).
- Cero dependencias de framework/DB/proveedores externos en `packages/domain` — ni siquiera Zod se introduce todavía ahí (la validación de input crudo con Zod llega en Fase 2/3, en el borde de Next.js; los casos de uso de esta fase validan invariantes de negocio con checks directos + `throw`).
- Todas las tablas usan `id: uuid` con `defaultRandom()` como primary key.
- Dev y prod comparten la misma instancia de Postgres (EasyPanel) — nunca usar `push --force`; revisar el diff que muestra `drizzle-kit push` antes de confirmar.
- Claude nunca ejecuta `git commit` — solo `git add` y sugiere el comando exacto en el chat, en español, una sola línea, sin firmas.
- No se toca contenido de `apps/web` más allá del scaffold — nada de UI de catálogo, checkout ni admin todavía (eso es Fase 2+).

---

## File Structure

```
packages/
  domain/
    package.json
    tsconfig.json
    vitest.config.ts
    src/
      shared/
        types.ts            # Cents, roundCents
        index.ts
      products/
        entities.ts          # Product, ProductCategory
        ports.ts              # ProductRepository
        use-cases.ts
        use-cases.test.ts
        index.ts
      pricing/
        volume-discount.ts    # motor de descuento (migra apps/web-legacy/src/lib/pricing.ts)
        volume-discount.test.ts
        index.ts
      orders/
        entities.ts           # Order, OrderItem, enums
        ports.ts               # OrderRepository, NewOrderInput
        use-cases.ts            # createOrder
        use-cases.test.ts
        index.ts
      stock/
        entities.ts
        ports.ts
        use-cases.ts            # decrementStockOnSale
        use-cases.test.ts
        index.ts
      users/
        entities.ts
        ports.ts
        use-cases.ts            # registerCustomer, listActiveStaff
        use-cases.test.ts
        index.ts
      event-bookings/
        entities.ts
        ports.ts
        use-cases.ts            # requestEventQuote
        use-cases.test.ts
        index.ts
      payments/
        ports.ts                # PaymentGateway (sin implementación, Fase 3)
        index.ts
      notifications/
        ports.ts                # NotificationPort (sin implementación, Fase 6)
        index.ts
  db/                            # movido desde lib/db
    package.json
    drizzle.config.ts
    .env                         # gitignored, DATABASE_URL copiado manualmente
    src/
      schema/
        users.ts
        products.ts
        trailer-stops.ts
        stock.ts
        event-bookings.ts
        carts.ts
        orders.ts
        index.ts
      repositories/
        product-repository.ts
        order-repository.ts
        order-repository.test.ts   # integración, DB real
        user-repository.ts
        stock-repository.ts
        event-booking-repository.ts
        index.ts
      index.ts                    # ya existe (pool + db), sin cambios
  notifications/                  # esqueleto vacío
    package.json
    tsconfig.json
    src/
      index.ts
apps/
  web-legacy/                     # ex apps/web (prototipo Vite, referencia)
  web/                            # scaffold Next.js 15 nuevo
```

Removidos por completo: `apps/api/`, `lib/api-spec/`, `lib/api-zod/`, `lib/api-client-react/`.

---

### Task 1: Retirar el prototipo descartado (`apps/api`, `lib/api-spec`, `lib/api-zod`, `lib/api-client-react`)

**Files:**
- Delete: `apps/api/`, `lib/api-spec/`, `lib/api-zod/`, `lib/api-client-react/`
- Modify: `apps/web/package.json` (quitar dependencia a `@workspace/api-client-react`)
- Modify: `tsconfig.json` (raíz, quitar referencias a los paquetes eliminados)

**Interfaces:** N/A (tarea de limpieza, sin código de negocio).

- [ ] **Step 1: Preservar `DATABASE_URL` antes de borrar `apps/api`**

`apps/api/.env` es la única copia local de `DATABASE_URL` y se borra en el Step 3 de esta misma tarea. Copiarlo ahora a `lib/db/.env` — viaja automáticamente a `packages/db/.env` cuando la Tarea 2 haga `git mv lib/db packages/db`, porque mover un directorio con `git mv` mueve también los archivos no trackeados (gitignored) que contiene:

```bash
grep '^DATABASE_URL=' apps/api/.env > lib/db/.env
test -s lib/db/.env && echo "lib/db/.env creado" || echo "FALTA DATABASE_URL en apps/api/.env"
```

(el comando no imprime el valor — solo confirma si el archivo quedó no vacío). `lib/db/.env` ya está cubierto por el `.gitignore` raíz (`.env`/`.env.*`).

- [ ] **Step 2: Confirmar que nada más referencia estos paquetes**

```bash
grep -rl "api-client-react\|api-zod\|api-spec" --include="*.ts" --include="*.tsx" --include="*.json" apps packages lib 2>/dev/null | grep -v node_modules
```

Expected: solo coincidencias dentro de `apps/api/`, `lib/api-spec/`, `lib/api-zod/`, `lib/api-client-react/` y la línea `"@workspace/api-client-react": "workspace:*"` en `apps/web/package.json`. Si aparece algo más, detenerse y avisar antes de continuar.

- [ ] **Step 3: Eliminar los directorios**

```bash
git rm -r apps/api lib/api-spec lib/api-zod lib/api-client-react
```

- [ ] **Step 4: Quitar la dependencia huérfana de `apps/web/package.json`**

Quitar la línea `"@workspace/api-client-react": "workspace:*"` del bloque `"dependencies"` de [apps/web/package.json](../../../apps/web/package.json).

- [ ] **Step 5: Quitar las referencias del `tsconfig.json` raíz**

En [tsconfig.json](../../../tsconfig.json), dejar `"references"` así (se completa en la Tarea 2 con los paquetes nuevos):

```json
{
  "extends": "./tsconfig.base.json",
  "compileOnSave": false,
  "files": [],
  "references": [
    {
      "path": "./lib/db"
    }
  ]
}
```

- [ ] **Step 6: Reinstalar y verificar**

```bash
pnpm install
pnpm run typecheck
```

Expected: instala sin errores (el lockfile pierde las entradas de los paquetes eliminados); `typecheck` limpio.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Retira prototipo descartado: apps/api, api-spec, api-zod, api-client-react"
```

> ⚠️ El servicio `apps/api` de EasyPanel sigue apuntando a `apps/api/Dockerfile`, que ya no existe en el repo. Antes de que EasyPanel intente el próximo deploy de ese servicio, alguien con acceso al panel debe pausarlo o eliminarlo manualmente — está fuera del alcance de Claude.

---

### Task 2: Reestructurar el monorepo — `packages/domain`, mover `lib/db` a `packages/db`, `packages/notifications`

**Files:**
- Create: `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/src/shared/index.ts` (barrel vacío por ahora)
- Create: `packages/notifications/package.json`, `packages/notifications/tsconfig.json`, `packages/notifications/src/index.ts`
- Move: `lib/db/` → `packages/db/`
- Modify: `pnpm-workspace.yaml`, `tsconfig.json` (raíz)

**Interfaces:** N/A.

- [ ] **Step 1: Mover `lib/db` a `packages/db` preservando historia**

```bash
git mv lib/db packages/db
```

- [ ] **Step 2: Crear el esqueleto de `packages/domain`**

`packages/domain/package.json`:

```json
{
  "name": "@workspace/domain",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./shared": "./src/shared/index.ts",
    "./products": "./src/products/index.ts",
    "./pricing": "./src/pricing/index.ts",
    "./orders": "./src/orders/index.ts",
    "./stock": "./src/stock/index.ts",
    "./users": "./src/users/index.ts",
    "./event-bookings": "./src/event-bookings/index.ts",
    "./payments": "./src/payments/index.ts",
    "./notifications": "./src/notifications/index.ts"
  }
}
```

`packages/domain/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

`packages/domain/src/shared/index.ts` (placeholder — se llena en la Tarea 5):

```ts
export {};
```

- [ ] **Step 3: Crear el esqueleto de `packages/notifications`**

`packages/notifications/package.json`:

```json
{
  "name": "@workspace/notifications",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

`packages/notifications/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/notifications/src/index.ts`:

```ts
// Adaptadores de notificaciones nativas (SMTP propio, Expo Push).
// Implementados en Fase 6 — ver docs/superpowers/plan-desarrollo.md.
export {};
```

- [ ] **Step 4: Actualizar `pnpm-workspace.yaml`**

En [pnpm-workspace.yaml](../../../pnpm-workspace.yaml), cambiar:

```yaml
packages:
  - apps/*
  - lib/*
```

por:

```yaml
packages:
  - apps/*
  - packages/*
```

- [ ] **Step 5: Actualizar `tsconfig.json` raíz**

```json
{
  "extends": "./tsconfig.base.json",
  "compileOnSave": false,
  "files": [],
  "references": [
    {
      "path": "./packages/db"
    },
    {
      "path": "./packages/domain"
    },
    {
      "path": "./packages/notifications"
    }
  ]
}
```

- [ ] **Step 6: Reinstalar y verificar**

```bash
pnpm install
pnpm run typecheck
```

Expected: limpio (los tres paquetes nuevos no tienen código propio todavía, solo barrels vacíos).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Reestructura monorepo: packages/domain, packages/db, packages/notifications"
```

---

### Task 3: Reemplazar `apps/web` por el scaffold de Next.js 15 (mover el prototipo Vite a `apps/web-legacy`)

**Files:**
- Move: `apps/web/` → `apps/web-legacy/`
- Modify: `apps/web-legacy/package.json` (renombrar paquete)
- Create: `apps/web/` (scaffold nuevo de Next.js 15)

**Interfaces:** N/A.

> ⚠️ Downtime funcional aceptado explícitamente por el owner (decisión resuelta #5 en `plan-desarrollo.md`): el sitio público en EasyPanel queda sin catálogo/checkout real hasta la Fase 2. El servicio de EasyPanel necesita que alguien con acceso al panel actualice el path del build o lo pause mientras tanto — fuera del alcance de Claude.

- [ ] **Step 1: Mover el prototipo Vite a `apps/web-legacy`**

```bash
git mv apps/web apps/web-legacy
```

- [ ] **Step 2: Renombrar el paquete legacy para evitar colisión de nombres**

En `apps/web-legacy/package.json`, cambiar `"name": "@workspace/web"` por `"name": "@workspace/web-legacy"`.

- [ ] **Step 3: Scaffoldear Next.js 15 en `apps/web`**

```bash
pnpm dlx create-next-app@15 apps/web --typescript --eslint --app --src-dir --import-alias "@/*" --tailwind --skip-install --use-pnpm --no-turbopack
```

Si el comando pregunta algo no cubierto por los flags (ej. confirmar el nombre del proyecto), aceptar los defaults.

- [ ] **Step 4: Ajustar `apps/web/package.json` generado**

Cambiar `"name"` a `"@workspace/web"` y agregar el script de typecheck que usa el resto del workspace:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 5: Ajustar `apps/web/tsconfig.json` generado para extender la config compartida**

Reemplazar el contenido generado por:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] },
    "noEmit": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 6: Alinear versiones con el catálogo del workspace**

`create-next-app` fija sus propias versiones de React/Tailwind. El workspace exige `react`/`react-dom` en exactamente `19.1.0` (`pnpm-workspace.yaml`, comentario "Must be this exact version because expo requires it") para no romper esa restricción cuando `apps/mobile` (Expo) llegue en Fase 7. En `apps/web/package.json`, reemplazar las versiones generadas por:

```json
"dependencies": {
  "react": "catalog:",
  "react-dom": "catalog:",
  "next": "^15.5.0"
},
"devDependencies": {
  "@types/react": "catalog:",
  "@types/react-dom": "catalog:",
  "@types/node": "catalog:",
  "tailwindcss": "catalog:",
  "typescript": "~5.9.3"
}
```

(mantener cualquier otra devDependency que `create-next-app` haya generado y no choque con esto, ej. `eslint`, `eslint-config-next`, `@tailwindcss/postcss`).

- [ ] **Step 7: Instalar y verificar**

```bash
pnpm install
pnpm --filter @workspace/web run typecheck
pnpm --filter @workspace/web-legacy run typecheck
pnpm run typecheck
```

Expected: los tres comandos limpios. `apps/web-legacy` no necesita `PORT`/`BASE_PATH` para el typecheck (solo para `dev`/`build`/`serve`, que no se corren en esta tarea).

- [ ] **Step 8: Actualizar `CLAUDE.md` — sección "Where things live"**

En [CLAUDE.md](../../../CLAUDE.md), reemplazar la línea de `apps/web` por:

```
- `apps/web` — **Next.js 15**: sitio público + panel admin. Actúa como adaptador de entrada/salida del núcleo hexagonal (Server Actions / Route Handlers inyectando repositorios de `packages/db` en los casos de uso de `packages/domain`). Scaffold vacío hasta Fase 2.
- `apps/web-legacy` — prototipo Vite + React descartado, mantenido solo como referencia visual/de copy durante la migración. No se deploya más. Se elimina en Fase 8.
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Reemplaza apps/web por scaffold de Next.js 15, mueve el prototipo Vite a apps/web-legacy"
```

---

### Task 4: Schema completo de Drizzle en `packages/db` + push contra Postgres real

**Files:**
- Create: `packages/db/src/schema/users.ts`
- Create: `packages/db/src/schema/products.ts`
- Create: `packages/db/src/schema/trailer-stops.ts`
- Create: `packages/db/src/schema/stock.ts`
- Create: `packages/db/src/schema/event-bookings.ts`
- Create: `packages/db/src/schema/carts.ts`
- Create: `packages/db/src/schema/orders.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/.env` (gitignored, no se commitea)

**Interfaces:**
- Produces: todas las tablas/enums de Drizzle re-exportadas desde `@workspace/db/schema` — nombres exactos usados por las Tareas 12 (repositorios).

- [ ] **Step 1: Confirmar que `packages/db/.env` existe**

Ya se creó como `lib/db/.env` en la Tarea 1 (Step 1) y viajó a `packages/db/.env` cuando la Tarea 2 movió el directorio completo con `git mv`.

```bash
test -s packages/db/.env && echo "packages/db/.env OK" || echo "FALTA — copiar DATABASE_URL manualmente ahora"
```

Si falta, pedirle el valor de `DATABASE_URL` al owner y crear `packages/db/.env` manualmente antes de continuar. Este archivo ya está cubierto por el `.gitignore` raíz (`.env` / `.env.*`) — confirmar con `git status` que no aparece como untracked-para-commitear.

- [ ] **Step 2: `packages/db/src/schema/users.ts`**

```ts
import { pgEnum, pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "despachador", "delivery", "customer"]);

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").unique(),
  role: userRoleEnum("role").notNull(),
  pinHash: text("pin_hash"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 3: `packages/db/src/schema/products.ts`**

```ts
import { pgEnum, pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const productCategoryEnum = pgEnum("product_category", ["sin", "virtue", "coffee"]);

export const productsTable = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  category: productCategoryEnum("category").notNull(),
  nameEn: text("name_en").notNull(),
  nameEs: text("name_es").notNull(),
  descriptionEn: text("description_en").notNull(),
  descriptionEs: text("description_es").notNull(),
  priceCents: integer("price_cents").notNull(),
  imageUrl: text("image_url"),
  featured: boolean("featured").notNull().default(false),
  available: boolean("available").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 4: `packages/db/src/schema/trailer-stops.ts`**

```ts
import { pgEnum, pgTable, uuid, text, doublePrecision, timestamp } from "drizzle-orm/pg-core";

export const trailerStopStatusEnum = pgEnum("trailer_stop_status", [
  "scheduled",
  "active",
  "completed",
  "cancelled",
]);

export const trailerStopsTable = pgTable("trailer_stops", {
  id: uuid("id").primaryKey().defaultRandom(),
  location: text("location").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  status: trailerStopStatusEnum("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 5: `packages/db/src/schema/stock.ts`**

```ts
import { pgEnum, pgTable, uuid, integer, text, timestamp } from "drizzle-orm/pg-core";
import { trailerStopsTable } from "./trailer-stops";
import { productsTable } from "./products";
import { usersTable } from "./users";

export const stockEventTypeEnum = pgEnum("stock_event_type", ["sale", "waste", "early_sellout", "restock"]);

export const stopProductStockTable = pgTable("stop_product_stock", {
  id: uuid("id").primaryKey().defaultRandom(),
  stopId: uuid("stop_id").notNull().references(() => trailerStopsTable.id),
  productId: uuid("product_id").notNull().references(() => productsTable.id),
  maxStock: integer("max_stock").notNull(),
  currentStock: integer("current_stock").notNull(),
});

export const stockEventsTable = pgTable("stock_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  stopProductStockId: uuid("stop_product_stock_id")
    .notNull()
    .references(() => stopProductStockTable.id),
  eventType: stockEventTypeEnum("event_type").notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  reportedByUserId: uuid("reported_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 6: `packages/db/src/schema/event-bookings.ts`**

```ts
import { pgEnum, pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const eventBookingStatusEnum = pgEnum("event_booking_status", [
  "quote_requested",
  "quoted",
  "confirmed",
  "completed",
  "cancelled",
]);

export const eventBookingsTable = pgTable("event_bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientName: text("client_name").notNull(),
  clientCompany: text("client_company"),
  clientEmail: text("client_email").notNull(),
  clientPhone: text("client_phone").notNull(),
  eventType: text("event_type").notNull(),
  eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  location: text("location").notNull(),
  estimatedGuests: integer("estimated_guests").notNull(),
  status: eventBookingStatusEnum("status").notNull().default("quote_requested"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const eventBookingItemsTable = pgTable("event_booking_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventBookingId: uuid("event_booking_id")
    .notNull()
    .references(() => eventBookingsTable.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  agreedUnitPriceCents: integer("agreed_unit_price_cents").notNull(),
});
```

- [ ] **Step 7: `packages/db/src/schema/carts.ts`**

```ts
import { pgTable, uuid, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { productsTable } from "./products";

export const cartsTable = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => usersTable.id)
    .unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const cartItemsTable = pgTable("cart_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  cartId: uuid("cart_id")
    .notNull()
    .references(() => cartsTable.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => productsTable.id),
  quantity: integer("quantity").notNull(),
});
```

- [ ] **Step 8: `packages/db/src/schema/orders.ts`**

```ts
import { pgEnum, pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { trailerStopsTable } from "./trailer-stops";
import { productsTable } from "./products";

export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid", "failed", "refunded"]);

export const fulfillmentStatusEnum = pgEnum("fulfillment_status", [
  "pending",
  "received",
  "in_prep",
  "ready_for_pickup",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);

export const fulfillmentTypeEnum = pgEnum("fulfillment_type", ["pickup", "self_delivery"]);
export const orderChannelEnum = pgEnum("order_channel", ["web", "whatsapp"]);

export const ordersTable = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => usersTable.id),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  fulfillmentType: fulfillmentTypeEnum("fulfillment_type").notNull(),
  deliveryAddress: text("delivery_address"),
  stopId: uuid("stop_id").references(() => trailerStopsTable.id),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  fulfillmentStatus: fulfillmentStatusEnum("fulfillment_status").notNull().default("pending"),
  subtotalCents: integer("subtotal_cents").notNull(),
  discountCents: integer("discount_cents").notNull().default(0),
  deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  channel: orderChannelEnum("channel").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const orderItemsTable = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => ordersTable.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => productsTable.id),
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  lineDiscountCents: integer("line_discount_cents").notNull().default(0),
});
```

- [ ] **Step 9: `packages/db/src/schema/index.ts`**

```ts
export * from "./users";
export * from "./products";
export * from "./trailer-stops";
export * from "./stock";
export * from "./event-bookings";
export * from "./carts";
export * from "./orders";
```

- [ ] **Step 10: Typecheck antes de tocar la base real**

```bash
pnpm --filter @workspace/db run typecheck 2>/dev/null || pnpm run typecheck
```

Expected: limpio.

- [ ] **Step 11: Aplicar el schema contra Postgres**

```bash
pnpm --filter @workspace/db run push
```

`drizzle-kit push` va a mostrar un diff antes de aplicar. Expected: solo `CREATE TABLE`/`CREATE TYPE` para las tablas/enums de arriba. Si aparece cualquier `DROP` o `ALTER` sobre algo que no sea de esta lista, **detenerse y preguntar antes de confirmar** — la base es compartida con producción.

- [ ] **Step 12: Commit**

```bash
git add packages/db/src/schema
git commit -m "Agrega schema completo de Drizzle: usuarios, productos, paradas, stock, eventos, carritos, órdenes"
```

---

### Task 5: `packages/domain` — tipos compartidos + dominio Productos

**Files:**
- Create: `packages/domain/src/shared/types.ts`
- Modify: `packages/domain/src/shared/index.ts`
- Create: `packages/domain/src/products/entities.ts`
- Create: `packages/domain/src/products/ports.ts`
- Create: `packages/domain/src/products/use-cases.ts`
- Create: `packages/domain/src/products/use-cases.test.ts`
- Create: `packages/domain/src/products/index.ts`
- Create: `packages/domain/vitest.config.ts`
- Modify: `packages/domain/package.json`, `pnpm-workspace.yaml`, root `package.json`

**Interfaces:**
- Produces: `Cents` (`packages/domain/shared`), `Product`/`ProductCategory` (`packages/domain/products`), `ProductRepository` con `findById`/`findBySlug`/`listAvailable` — la Tarea 12 implementa este puerto.

- [ ] **Step 1: Agregar Vitest al catálogo del workspace**

En [pnpm-workspace.yaml](../../../pnpm-workspace.yaml), agregar al bloque `catalog`:

```yaml
  vitest: ^3.2.4
```

- [ ] **Step 2: Configurar Vitest en `packages/domain`**

Agregar a `packages/domain/package.json`:

```json
"scripts": {
  "test": "vitest run"
},
"devDependencies": {
  "vitest": "catalog:"
}
```

`packages/domain/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

Agregar a la raíz `package.json`, dentro de `"scripts"`:

```json
"test": "pnpm -r --if-present run test"
```

- [ ] **Step 3: Tipos compartidos**

`packages/domain/src/shared/types.ts`:

```ts
export type Cents = number;

// Los descuentos por volumen multiplican price_cents por un porcentaje,
// lo que produce centavos fraccionarios — se redondea siempre igual para
// que la suma de line items nunca descuadre con el total.
export function roundCents(value: number): Cents {
  return Math.round(value);
}
```

`packages/domain/src/shared/index.ts`:

```ts
export * from "./types";
```

- [ ] **Step 4: Entidades y puerto de Productos**

`packages/domain/src/products/entities.ts`:

```ts
export type ProductCategory = "sin" | "virtue" | "coffee";

export interface Product {
  id: string;
  slug: string;
  category: ProductCategory;
  nameEn: string;
  nameEs: string;
  descriptionEn: string;
  descriptionEs: string;
  priceCents: number;
  imageUrl: string | null;
  featured: boolean;
  available: boolean;
}
```

`packages/domain/src/products/ports.ts`:

```ts
import type { Product } from "./entities";

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  findBySlug(slug: string): Promise<Product | null>;
  listAvailable(): Promise<Product[]>;
}
```

- [ ] **Step 5: Escribir el test que falla**

`packages/domain/src/products/use-cases.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { listAvailableProducts, getProductBySlug } from "./use-cases";
import type { Product } from "./entities";
import type { ProductRepository } from "./ports";

function fakeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "gluttony",
    category: "sin",
    nameEn: "Gluttony",
    nameEs: "Gula",
    descriptionEn: "More than you should.",
    descriptionEs: "Más de lo que deberías.",
    priceCents: 1300,
    imageUrl: null,
    featured: false,
    available: true,
    ...overrides,
  };
}

function fakeRepo(products: Product[]): ProductRepository {
  return {
    async findById(id) {
      return products.find((p) => p.id === id) ?? null;
    },
    async findBySlug(slug) {
      return products.find((p) => p.slug === slug) ?? null;
    },
    async listAvailable() {
      return products.filter((p) => p.available);
    },
  };
}

describe("listAvailableProducts", () => {
  it("returns only available products", async () => {
    const repo = fakeRepo([fakeProduct({ id: "p1", available: true }), fakeProduct({ id: "p2", available: false })]);
    const result = await listAvailableProducts(repo);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });
});

describe("getProductBySlug", () => {
  it("returns the matching product", async () => {
    const repo = fakeRepo([fakeProduct({ slug: "gluttony" })]);
    const result = await getProductBySlug(repo, "gluttony");
    expect(result.slug).toBe("gluttony");
  });

  it("throws when the product does not exist", async () => {
    const repo = fakeRepo([]);
    await expect(getProductBySlug(repo, "missing")).rejects.toThrow("Product not found: missing");
  });
});
```

- [ ] **Step 6: Correr el test y confirmar que falla**

```bash
pnpm install
pnpm --filter @workspace/domain run test
```

Expected: FAIL — `use-cases.ts` no existe todavía.

- [ ] **Step 7: Implementación mínima**

`packages/domain/src/products/use-cases.ts`:

```ts
import type { ProductRepository } from "./ports";
import type { Product } from "./entities";

export function listAvailableProducts(repo: ProductRepository): Promise<Product[]> {
  return repo.listAvailable();
}

export async function getProductBySlug(repo: ProductRepository, slug: string): Promise<Product> {
  const product = await repo.findBySlug(slug);
  if (!product) throw new Error(`Product not found: ${slug}`);
  return product;
}
```

`packages/domain/src/products/index.ts`:

```ts
export * from "./entities";
export * from "./ports";
export * from "./use-cases";
```

- [ ] **Step 8: Correr el test y confirmar que pasa**

```bash
pnpm --filter @workspace/domain run test
```

Expected: PASS (3 tests).

- [ ] **Step 9: Typecheck**

```bash
pnpm run typecheck
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Agrega dominio Productos con Vitest en packages/domain"
```

---

### Task 6: `packages/domain` — motor de pricing / descuento por volumen

**Files:**
- Create: `packages/domain/src/pricing/volume-discount.ts`
- Create: `packages/domain/src/pricing/volume-discount.test.ts`
- Create: `packages/domain/src/pricing/index.ts`

**Interfaces:**
- Consumes: `ProductCategory` (`../products/entities`), `Cents`/`roundCents` (`../shared/types`).
- Produces: `getDiscountedUnitPriceCents`, `getLineTotalCents`, `isVolumeEligible`, `getDiscountForQty`, `VOLUME_TIERS` — usados por la Tarea 7 (`createOrder`).

Migra la lógica de `apps/web-legacy/src/lib/pricing.ts` (dólares flotantes) a centavos enteros con redondeo consistente.

- [ ] **Step 1: Escribir los tests que fallan**

`packages/domain/src/pricing/volume-discount.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isVolumeEligible, getDiscountForQty, getDiscountedUnitPriceCents, getLineTotalCents } from "./volume-discount";

describe("isVolumeEligible", () => {
  it("is eligible for sin and coffee, not virtue", () => {
    expect(isVolumeEligible("sin")).toBe(true);
    expect(isVolumeEligible("coffee")).toBe(true);
    expect(isVolumeEligible("virtue")).toBe(false);
  });
});

describe("getDiscountForQty", () => {
  it("returns the highest tier the quantity qualifies for", () => {
    expect(getDiscountForQty(100, "sin")?.discountPct).toBe(0.15);
    expect(getDiscountForQty(50, "sin")?.discountPct).toBe(0.1);
    expect(getDiscountForQty(20, "sin")?.discountPct).toBe(0.05);
    expect(getDiscountForQty(19, "sin")).toBeNull();
  });

  it("never discounts virtue regardless of quantity", () => {
    expect(getDiscountForQty(1000, "virtue")).toBeNull();
  });
});

describe("getDiscountedUnitPriceCents", () => {
  it("applies the tier discount and rounds to whole cents", () => {
    // 1300 * 0.95 = 1235 exacto
    expect(getDiscountedUnitPriceCents(1300, 20, "sin")).toBe(1235);
  });

  it("returns the original price when no tier applies", () => {
    expect(getDiscountedUnitPriceCents(1300, 5, "sin")).toBe(1300);
  });
});

describe("getLineTotalCents", () => {
  it("multiplies the discounted unit price by quantity", () => {
    expect(getLineTotalCents(1300, 20, "sin")).toBe(1235 * 20);
  });
});
```

- [ ] **Step 2: Correr y confirmar que falla**

```bash
pnpm --filter @workspace/domain run test
```

Expected: FAIL — `volume-discount.ts` no existe.

- [ ] **Step 3: Implementación**

`packages/domain/src/pricing/volume-discount.ts`:

```ts
import type { ProductCategory } from "../products/entities";
import { roundCents, type Cents } from "../shared/types";

export interface VolumeTier {
  minQty: number;
  discountPct: number; // e.g. 0.05 = 5%
}

// Ordenado descendente por minQty — getDiscountForQty depende de este orden.
export const VOLUME_TIERS: VolumeTier[] = [
  { minQty: 100, discountPct: 0.15 },
  { minQty: 50, discountPct: 0.1 },
  { minQty: 20, discountPct: 0.05 },
];

// El descuento por volumen premia comprar mucho de un mismo "sin" (y el café
// que acompaña un pedido grande) — las virtudes nunca se descuentan.
export function isVolumeEligible(category: ProductCategory): boolean {
  return category === "sin" || category === "coffee";
}

export function getDiscountForQty(qty: number, category: ProductCategory): VolumeTier | null {
  if (!isVolumeEligible(category)) return null;
  return VOLUME_TIERS.find((tier) => qty >= tier.minQty) ?? null;
}

export function getDiscountedUnitPriceCents(unitPriceCents: Cents, qty: number, category: ProductCategory): Cents {
  const tier = getDiscountForQty(qty, category);
  if (!tier) return unitPriceCents;
  return roundCents(unitPriceCents * (1 - tier.discountPct));
}

export function getLineTotalCents(unitPriceCents: Cents, qty: number, category: ProductCategory): Cents {
  return getDiscountedUnitPriceCents(unitPriceCents, qty, category) * qty;
}
```

`packages/domain/src/pricing/index.ts`:

```ts
export * from "./volume-discount";
```

- [ ] **Step 4: Correr y confirmar que pasa**

```bash
pnpm --filter @workspace/domain run test
```

Expected: PASS (todos los tests, incluidos los de la Tarea 5).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Migra el motor de descuento por volumen a packages/domain en centavos enteros"
```

---

### Task 7: `packages/domain` — dominio Órdenes (`createOrder`)

**Files:**
- Create: `packages/domain/src/orders/entities.ts`
- Create: `packages/domain/src/orders/ports.ts`
- Create: `packages/domain/src/orders/use-cases.ts`
- Create: `packages/domain/src/orders/use-cases.test.ts`
- Create: `packages/domain/src/orders/index.ts`
- Modify: `packages/domain/src/products/ports.ts` (agregar `findById`, ya está desde la Tarea 5)

**Interfaces:**
- Consumes: `ProductRepository` (`../products/ports`), `getDiscountedUnitPriceCents` (`../pricing/volume-discount`).
- Produces: `Order`, `OrderItem`, `OrderRepository` (`create`, `findById`), `createOrder(deps, input)` — la Tarea 12 implementa `OrderRepository`; la Tarea 12 también escribe el test de integración que llama a `createOrder` contra un `DrizzleOrderRepository` real.

- [ ] **Step 1: Entidades**

`packages/domain/src/orders/entities.ts`:

```ts
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type FulfillmentStatus =
  | "pending"
  | "received"
  | "in_prep"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type FulfillmentType = "pickup" | "self_delivery";
export type OrderChannel = "web" | "whatsapp";

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPriceCents: number;
  lineDiscountCents: number;
}

export interface Order {
  id: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  deliveryAddress: string | null;
  stopId: string | null;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  subtotalCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  channel: OrderChannel;
  stripePaymentIntentId: string | null;
  items: OrderItem[];
}
```

- [ ] **Step 2: Puerto**

`packages/domain/src/orders/ports.ts`:

```ts
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
}
```

- [ ] **Step 3: Escribir el test que falla**

`packages/domain/src/orders/use-cases.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createOrder } from "./use-cases";
import type { Order } from "./entities";
import type { OrderRepository } from "./ports";
import type { Product } from "../products/entities";
import type { ProductRepository } from "../products/ports";

function fakeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "gluttony",
    category: "sin",
    nameEn: "Gluttony",
    nameEs: "Gula",
    descriptionEn: "More than you should.",
    descriptionEs: "Más de lo que deberías.",
    priceCents: 1300,
    imageUrl: null,
    featured: false,
    available: true,
    ...overrides,
  };
}

function fakeProductRepo(products: Product[]): ProductRepository {
  return {
    async findById(id) {
      return products.find((p) => p.id === id) ?? null;
    },
    async findBySlug(slug) {
      return products.find((p) => p.slug === slug) ?? null;
    },
    async listAvailable() {
      return products.filter((p) => p.available);
    },
  };
}

function fakeOrderRepo(): OrderRepository & { created: Omit<Order, "id">[] } {
  const created: Omit<Order, "id">[] = [];
  return {
    created,
    async create(order) {
      created.push(order);
      return { ...order, id: `order-${created.length}` };
    },
    async findById() {
      return null;
    },
  };
}

describe("createOrder", () => {
  it("computes subtotal, volume discount and total for a single line", async () => {
    const products = fakeProductRepo([fakeProduct({ id: "p1", priceCents: 1300 })]);
    const orders = fakeOrderRepo();

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
        items: [{ productId: "p1", quantity: 20 }],
      },
    );

    // 20 x 1300 = 26000 subtotal; tier 20 -> 5% descuento -> 1235/u -> 24700 total
    expect(order.subtotalCents).toBe(26000);
    expect(order.discountCents).toBe(1300);
    expect(order.totalCents).toBe(24700);
    expect(order.paymentStatus).toBe("pending");
    expect(order.fulfillmentStatus).toBe("pending");
    expect(order.items).toEqual([
      { productId: "p1", quantity: 20, unitPriceCents: 1300, lineDiscountCents: 1300 },
    ]);
  });

  it("adds the delivery fee on top of the discounted subtotal", async () => {
    const products = fakeProductRepo([fakeProduct({ id: "p1", priceCents: 1000, category: "virtue" })]);
    const orders = fakeOrderRepo();

    const order = await createOrder(
      { products, orders },
      {
        customerId: null,
        customerName: "Jane Doe",
        customerEmail: "jane@example.com",
        customerPhone: "+61400000000",
        fulfillmentType: "self_delivery",
        deliveryAddress: "1 Test St",
        stopId: null,
        deliveryFeeCents: 500,
        channel: "web",
        items: [{ productId: "p1", quantity: 2 }],
      },
    );

    expect(order.subtotalCents).toBe(2000);
    expect(order.discountCents).toBe(0);
    expect(order.totalCents).toBe(2500);
  });

  it("throws when the order has no items", async () => {
    const products = fakeProductRepo([]);
    const orders = fakeOrderRepo();

    await expect(
      createOrder(
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
          items: [],
        },
      ),
    ).rejects.toThrow("Order must have at least one item");
  });

  it("throws when a product does not exist", async () => {
    const products = fakeProductRepo([]);
    const orders = fakeOrderRepo();

    await expect(
      createOrder(
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
          items: [{ productId: "missing", quantity: 1 }],
        },
      ),
    ).rejects.toThrow("Product not found: missing");
  });
});
```

- [ ] **Step 4: Correr y confirmar que falla**

```bash
pnpm --filter @workspace/domain run test
```

Expected: FAIL — `use-cases.ts` no existe.

- [ ] **Step 5: Implementación**

`packages/domain/src/orders/use-cases.ts`:

```ts
import type { ProductRepository } from "../products/ports";
import type { OrderRepository, NewOrderInput } from "./ports";
import type { Order, OrderItem } from "./entities";
import { getDiscountedUnitPriceCents } from "../pricing/volume-discount";

export async function createOrder(
  deps: { products: ProductRepository; orders: OrderRepository },
  input: NewOrderInput,
): Promise<Order> {
  if (input.items.length === 0) {
    throw new Error("Order must have at least one item");
  }

  const items: OrderItem[] = [];
  let subtotalCents = 0;
  let discountCents = 0;

  for (const line of input.items) {
    const product = await deps.products.findById(line.productId);
    if (!product) throw new Error(`Product not found: ${line.productId}`);

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

  const totalCents = subtotalCents - discountCents + input.deliveryFeeCents;

  return deps.orders.create({
    customerId: input.customerId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    fulfillmentType: input.fulfillmentType,
    deliveryAddress: input.deliveryAddress,
    stopId: input.stopId,
    paymentStatus: "pending",
    fulfillmentStatus: "pending",
    subtotalCents,
    discountCents,
    deliveryFeeCents: input.deliveryFeeCents,
    totalCents,
    channel: input.channel,
    stripePaymentIntentId: null,
    items,
  });
}
```

`packages/domain/src/orders/index.ts`:

```ts
export * from "./entities";
export * from "./ports";
export * from "./use-cases";
```

Agregar `findById` al puerto de productos si todavía no está (ya se agregó en la Tarea 5 — confirmar que `packages/domain/src/products/ports.ts` tiene `findById`, `findBySlug` y `listAvailable`).

- [ ] **Step 6: Correr y confirmar que pasa**

```bash
pnpm --filter @workspace/domain run test
```

Expected: PASS (todos los tests).

- [ ] **Step 7: Typecheck + commit**

```bash
pnpm run typecheck
git add -A
git commit -m "Agrega dominio Ordenes con caso de uso createOrder"
```

---

### Task 8: `packages/domain` — dominio Stock

**Files:**
- Create: `packages/domain/src/stock/entities.ts`
- Create: `packages/domain/src/stock/ports.ts`
- Create: `packages/domain/src/stock/use-cases.ts`
- Create: `packages/domain/src/stock/use-cases.test.ts`
- Create: `packages/domain/src/stock/index.ts`

**Interfaces:**
- Produces: `StopProductStock`, `StockEvent`, `StockRepository` (`findByStopAndProduct`, `decrementStock`, `recordEvent`), `decrementStockOnSale(repo, stopId, productId, quantity)` — la Tarea 12 implementa `StockRepository`; Fase 3 llama `decrementStockOnSale` desde el webhook de Stripe.

- [ ] **Step 1: Entidades y puerto**

`packages/domain/src/stock/entities.ts`:

```ts
export type StockEventType = "sale" | "waste" | "early_sellout" | "restock";

export interface StopProductStock {
  id: string;
  stopId: string;
  productId: string;
  maxStock: number;
  currentStock: number;
}

export interface StockEvent {
  id: string;
  stopProductStockId: string;
  eventType: StockEventType;
  quantity: number;
  reason: string | null;
  reportedByUserId: string | null;
}
```

`packages/domain/src/stock/ports.ts`:

```ts
import type { StopProductStock, StockEvent } from "./entities";

export interface StockRepository {
  findByStopAndProduct(stopId: string, productId: string): Promise<StopProductStock | null>;
  decrementStock(stopProductStockId: string, quantity: number): Promise<StopProductStock>;
  recordEvent(event: Omit<StockEvent, "id">): Promise<StockEvent>;
}
```

- [ ] **Step 2: Escribir el test que falla**

`packages/domain/src/stock/use-cases.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { decrementStockOnSale } from "./use-cases";
import type { StopProductStock, StockEvent } from "./entities";
import type { StockRepository } from "./ports";

function fakeStockRepo(stock: StopProductStock): StockRepository & { events: Omit<StockEvent, "id">[] } {
  const events: Omit<StockEvent, "id">[] = [];
  let current = stock;
  return {
    events,
    async findByStopAndProduct(stopId, productId) {
      return stopId === current.stopId && productId === current.productId ? current : null;
    },
    async decrementStock(id, quantity) {
      current = { ...current, currentStock: current.currentStock - quantity };
      return current;
    },
    async recordEvent(event) {
      events.push(event);
      return { ...event, id: `event-${events.length}` };
    },
  };
}

describe("decrementStockOnSale", () => {
  it("decrements stock and records a sale event", async () => {
    const repo = fakeStockRepo({ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 10 });

    await decrementStockOnSale(repo, "stop1", "p1", 3);

    expect(repo.events).toEqual([
      { stopProductStockId: "s1", eventType: "sale", quantity: 3, reason: null, reportedByUserId: null },
    ]);
  });

  it("throws when there is no stock record for that stop/product", async () => {
    const repo = fakeStockRepo({ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 10 });

    await expect(decrementStockOnSale(repo, "other-stop", "p1", 1)).rejects.toThrow(
      "No stock record for product p1 at stop other-stop",
    );
  });

  it("throws when there is not enough stock", async () => {
    const repo = fakeStockRepo({ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 2 });

    await expect(decrementStockOnSale(repo, "stop1", "p1", 3)).rejects.toThrow(
      "Insufficient stock for product p1 at stop stop1",
    );
  });
});
```

- [ ] **Step 3: Correr y confirmar que falla**

```bash
pnpm --filter @workspace/domain run test
```

Expected: FAIL.

- [ ] **Step 4: Implementación**

`packages/domain/src/stock/use-cases.ts`:

```ts
import type { StockRepository } from "./ports";

export async function decrementStockOnSale(
  repo: StockRepository,
  stopId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  const stock = await repo.findByStopAndProduct(stopId, productId);
  if (!stock) throw new Error(`No stock record for product ${productId} at stop ${stopId}`);
  if (stock.currentStock < quantity) {
    throw new Error(`Insufficient stock for product ${productId} at stop ${stopId}`);
  }

  await repo.decrementStock(stock.id, quantity);
  await repo.recordEvent({
    stopProductStockId: stock.id,
    eventType: "sale",
    quantity,
    reason: null,
    reportedByUserId: null,
  });
}
```

`packages/domain/src/stock/index.ts`:

```ts
export * from "./entities";
export * from "./ports";
export * from "./use-cases";
```

- [ ] **Step 5: Correr y confirmar que pasa + typecheck + commit**

```bash
pnpm --filter @workspace/domain run test
pnpm run typecheck
git add -A
git commit -m "Agrega dominio Stock con caso de uso decrementStockOnSale"
```

---

### Task 9: `packages/domain` — dominio Usuarios

**Files:**
- Create: `packages/domain/src/users/entities.ts`
- Create: `packages/domain/src/users/ports.ts`
- Create: `packages/domain/src/users/use-cases.ts`
- Create: `packages/domain/src/users/use-cases.test.ts`
- Create: `packages/domain/src/users/index.ts`

**Interfaces:**
- Produces: `User`, `UserRole`, `UserRepository` (`findById`, `findByEmail`, `listActiveByRole`, `create`), `registerCustomer`, `listActiveStaff` — la Tarea 12 implementa `UserRepository`; Fase 4 (Auth.js) y Fase 7 (login PIN) reusan este puerto.

- [ ] **Step 1: Entidades y puerto**

`packages/domain/src/users/entities.ts`:

```ts
export type UserRole = "admin" | "despachador" | "delivery" | "customer";

export interface User {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  pinHash: string | null;
  isActive: boolean;
}
```

`packages/domain/src/users/ports.ts`:

```ts
import type { User, UserRole } from "./entities";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  listActiveByRole(role: UserRole): Promise<User[]>;
  create(user: Omit<User, "id">): Promise<User>;
}
```

- [ ] **Step 2: Escribir el test que falla**

`packages/domain/src/users/use-cases.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { registerCustomer, listActiveStaff } from "./use-cases";
import type { User } from "./entities";
import type { UserRepository } from "./ports";

function fakeUserRepo(users: User[]): UserRepository & { created: Omit<User, "id">[] } {
  const created: Omit<User, "id">[] = [];
  return {
    created,
    async findById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async findByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async listActiveByRole(role) {
      return users.filter((u) => u.role === role && u.isActive);
    },
    async create(user) {
      created.push(user);
      return { ...user, id: `user-${created.length}` };
    },
  };
}

describe("registerCustomer", () => {
  it("creates a new customer user", async () => {
    const repo = fakeUserRepo([]);
    const user = await registerCustomer(repo, { name: "Jane Doe", email: "jane@example.com" });

    expect(user.role).toBe("customer");
    expect(user.isActive).toBe(true);
    expect(repo.created).toHaveLength(1);
  });

  it("throws when the email is already registered", async () => {
    const repo = fakeUserRepo([
      { id: "u1", name: "Existing", email: "jane@example.com", role: "customer", pinHash: null, isActive: true },
    ]);

    await expect(registerCustomer(repo, { name: "Jane Doe", email: "jane@example.com" })).rejects.toThrow(
      "User already exists with email: jane@example.com",
    );
  });
});

describe("listActiveStaff", () => {
  it("returns only active users with the given role", async () => {
    const repo = fakeUserRepo([
      { id: "u1", name: "Active Despachador", email: null, role: "despachador", pinHash: "x", isActive: true },
      { id: "u2", name: "Inactive Despachador", email: null, role: "despachador", pinHash: "x", isActive: false },
      { id: "u3", name: "Delivery", email: null, role: "delivery", pinHash: "x", isActive: true },
    ]);

    const result = await listActiveStaff(repo, "despachador");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("u1");
  });
});
```

- [ ] **Step 3: Correr y confirmar que falla**

```bash
pnpm --filter @workspace/domain run test
```

Expected: FAIL.

- [ ] **Step 4: Implementación**

`packages/domain/src/users/use-cases.ts`:

```ts
import type { UserRepository } from "./ports";
import type { User, UserRole } from "./entities";

export async function listActiveStaff(
  repo: UserRepository,
  role: Exclude<UserRole, "customer">,
): Promise<User[]> {
  return repo.listActiveByRole(role);
}

export async function registerCustomer(
  repo: UserRepository,
  input: { name: string; email: string },
): Promise<User> {
  const existing = await repo.findByEmail(input.email);
  if (existing) throw new Error(`User already exists with email: ${input.email}`);
  return repo.create({ name: input.name, email: input.email, role: "customer", pinHash: null, isActive: true });
}
```

`packages/domain/src/users/index.ts`:

```ts
export * from "./entities";
export * from "./ports";
export * from "./use-cases";
```

- [ ] **Step 5: Correr y confirmar que pasa + typecheck + commit**

```bash
pnpm --filter @workspace/domain run test
pnpm run typecheck
git add -A
git commit -m "Agrega dominio Usuarios con registerCustomer y listActiveStaff"
```

---

### Task 10: `packages/domain` — dominio Event Bookings

**Files:**
- Create: `packages/domain/src/event-bookings/entities.ts`
- Create: `packages/domain/src/event-bookings/ports.ts`
- Create: `packages/domain/src/event-bookings/use-cases.ts`
- Create: `packages/domain/src/event-bookings/use-cases.test.ts`
- Create: `packages/domain/src/event-bookings/index.ts`

**Interfaces:**
- Produces: `EventBooking`, `EventBookingItem`, `EventBookingRepository` (`create`, `findOverlapping`), `requestEventQuote` — la Tarea 12 implementa `EventBookingRepository`; Fase 2 llama `requestEventQuote` desde el formulario de cotización; Fase 5 usa `findOverlapping` para la advertencia visual de solapamiento.

- [ ] **Step 1: Entidades y puerto**

`packages/domain/src/event-bookings/entities.ts`:

```ts
export type EventBookingStatus = "quote_requested" | "quoted" | "confirmed" | "completed" | "cancelled";

export interface EventBookingItem {
  description: string;
  quantity: number;
  agreedUnitPriceCents: number;
}

export interface EventBooking {
  id: string;
  clientName: string;
  clientCompany: string | null;
  clientEmail: string;
  clientPhone: string;
  eventType: string;
  eventDate: Date;
  startTime: Date;
  endTime: Date;
  location: string;
  estimatedGuests: number;
  status: EventBookingStatus;
  notes: string | null;
  items: EventBookingItem[];
}
```

`packages/domain/src/event-bookings/ports.ts`:

```ts
import type { EventBooking } from "./entities";

export interface EventBookingRepository {
  create(booking: Omit<EventBooking, "id">): Promise<EventBooking>;
  findOverlapping(eventDate: Date, startTime: Date, endTime: Date): Promise<EventBooking[]>;
}
```

- [ ] **Step 2: Escribir el test que falla**

`packages/domain/src/event-bookings/use-cases.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { requestEventQuote } from "./use-cases";
import type { EventBooking } from "./entities";
import type { EventBookingRepository } from "./ports";

function fakeEventBookingRepo(): EventBookingRepository & { created: Omit<EventBooking, "id">[] } {
  const created: Omit<EventBooking, "id">[] = [];
  return {
    created,
    async create(booking) {
      created.push(booking);
      return { ...booking, id: `booking-${created.length}` };
    },
    async findOverlapping() {
      return [];
    },
  };
}

describe("requestEventQuote", () => {
  it("creates a booking with status quote_requested and no items by default", async () => {
    const repo = fakeEventBookingRepo();

    const booking = await requestEventQuote(repo, {
      clientName: "Acme Corp",
      clientCompany: "Acme",
      clientEmail: "events@acme.com",
      clientPhone: "+61400000000",
      eventType: "corporate",
      eventDate: new Date("2026-11-01"),
      startTime: new Date("2026-11-01T17:00:00Z"),
      endTime: new Date("2026-11-01T20:00:00Z"),
      location: "Adelaide CBD",
      estimatedGuests: 40,
      notes: null,
    });

    expect(booking.status).toBe("quote_requested");
    expect(booking.items).toEqual([]);
  });
});
```

- [ ] **Step 3: Correr y confirmar que falla**

```bash
pnpm --filter @workspace/domain run test
```

Expected: FAIL.

- [ ] **Step 4: Implementación**

`packages/domain/src/event-bookings/use-cases.ts`:

```ts
import type { EventBookingRepository } from "./ports";
import type { EventBooking, EventBookingItem } from "./entities";

type RequestEventQuoteInput = Omit<EventBooking, "id" | "status" | "items"> & {
  items?: EventBookingItem[];
};

export async function requestEventQuote(
  repo: EventBookingRepository,
  input: RequestEventQuoteInput,
): Promise<EventBooking> {
  return repo.create({
    ...input,
    status: "quote_requested",
    items: input.items ?? [],
  });
}
```

`packages/domain/src/event-bookings/index.ts`:

```ts
export * from "./entities";
export * from "./ports";
export * from "./use-cases";
```

- [ ] **Step 5: Correr y confirmar que pasa + typecheck + commit**

```bash
pnpm --filter @workspace/domain run test
pnpm run typecheck
git add -A
git commit -m "Agrega dominio Event Bookings con caso de uso requestEventQuote"
```

---

### Task 11: `packages/domain` — puertos externos (pagos, notificaciones)

**Files:**
- Create: `packages/domain/src/payments/ports.ts`
- Create: `packages/domain/src/payments/index.ts`
- Create: `packages/domain/src/notifications/ports.ts`
- Create: `packages/domain/src/notifications/index.ts`

**Interfaces:**
- Produces: `PaymentGateway` (implementado en Fase 3 por `apps/web/src/infra/stripe-payment-gateway.ts`), `NotificationPort` (implementado en Fase 6 por `packages/notifications`).

Solo interfaces — sin implementación, sin tests (no hay lógica que testear todavía).

- [ ] **Step 1: Puerto de pagos**

`packages/domain/src/payments/ports.ts`:

```ts
export interface PaymentGateway {
  createPaymentIntent(amountCents: number, currency: string): Promise<{ id: string; clientSecret: string }>;
}
```

`packages/domain/src/payments/index.ts`:

```ts
export * from "./ports";
```

- [ ] **Step 2: Puerto de notificaciones**

`packages/domain/src/notifications/ports.ts`:

```ts
export interface NotificationPort {
  sendOrderConfirmation(order: { customerEmail: string; totalCents: number; id: string }): Promise<void>;
  sendEventQuoteRequestReceipt(booking: { clientEmail: string; id: string }): Promise<void>;
}
```

`packages/domain/src/notifications/index.ts`:

```ts
export * from "./ports";
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm run typecheck
git add -A
git commit -m "Agrega puertos externos de pagos y notificaciones en packages/domain"
```

---

### Task 12: `packages/db` — repositorios Drizzle + test de integración contra Postgres real

**Files:**
- Create: `packages/db/src/repositories/product-repository.ts`
- Create: `packages/db/src/repositories/order-repository.ts`
- Create: `packages/db/src/repositories/order-repository.test.ts`
- Create: `packages/db/src/repositories/user-repository.ts`
- Create: `packages/db/src/repositories/stock-repository.ts`
- Create: `packages/db/src/repositories/event-booking-repository.ts`
- Create: `packages/db/src/repositories/index.ts`
- Modify: `packages/db/package.json` (agregar `@workspace/domain` como dependencia, Vitest)

**Interfaces:**
- Consumes: todos los puertos de `packages/domain` (Tareas 5, 7, 8, 9, 10) y el schema de `packages/db/src/schema` (Tarea 4).
- Produces: `DrizzleProductRepository`, `DrizzleOrderRepository`, `DrizzleUserRepository`, `DrizzleStockRepository`, `DrizzleEventBookingRepository` — consumidos por las Server Actions de Fase 2+.

> Requiere `packages/db/.env` con `DATABASE_URL` (creado en la Tarea 4) y las tablas ya migradas contra Postgres.

- [ ] **Step 1: Agregar dependencias**

En `packages/db/package.json`, agregar a `"dependencies"`:

```json
"@workspace/domain": "workspace:*"
```

y a `"devDependencies"`:

```json
"vitest": "catalog:"
```

y a `"scripts"`:

```json
"test": "vitest run"
```

```bash
pnpm install
```

- [ ] **Step 2: `DrizzleProductRepository`**

`packages/db/src/repositories/product-repository.ts`:

```ts
import { eq } from "drizzle-orm";
import type { Product, ProductRepository } from "@workspace/domain/products";
import { db } from "../index";
import { productsTable } from "../schema";

export class DrizzleProductRepository implements ProductRepository {
  async findById(id: string): Promise<Product | null> {
    const [row] = await db.select().from(productsTable).where(eq(productsTable.id, id));
    return row ?? null;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const [row] = await db.select().from(productsTable).where(eq(productsTable.slug, slug));
    return row ?? null;
  }

  async listAvailable(): Promise<Product[]> {
    return db.select().from(productsTable).where(eq(productsTable.available, true));
  }
}
```

- [ ] **Step 3: `DrizzleOrderRepository`**

`packages/db/src/repositories/order-repository.ts`:

```ts
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
}
```

- [ ] **Step 4: `DrizzleUserRepository`**

`packages/db/src/repositories/user-repository.ts`:

```ts
import { and, eq } from "drizzle-orm";
import type { User, UserRepository, UserRole } from "@workspace/domain/users";
import { db } from "../index";
import { usersTable } from "../schema";

export class DrizzleUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const [row] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return row ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    return row ?? null;
  }

  async listActiveByRole(role: UserRole): Promise<User[]> {
    return db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.role, role), eq(usersTable.isActive, true)));
  }

  async create(user: Omit<User, "id">): Promise<User> {
    const [inserted] = await db.insert(usersTable).values(user).returning();
    return inserted;
  }
}
```

- [ ] **Step 5: `DrizzleStockRepository`**

`packages/db/src/repositories/stock-repository.ts`:

```ts
import { and, eq, sql } from "drizzle-orm";
import type { StockEvent, StockRepository, StopProductStock } from "@workspace/domain/stock";
import { db } from "../index";
import { stockEventsTable, stopProductStockTable } from "../schema";

export class DrizzleStockRepository implements StockRepository {
  async findByStopAndProduct(stopId: string, productId: string): Promise<StopProductStock | null> {
    const [row] = await db
      .select()
      .from(stopProductStockTable)
      .where(and(eq(stopProductStockTable.stopId, stopId), eq(stopProductStockTable.productId, productId)));
    return row ?? null;
  }

  async decrementStock(stopProductStockId: string, quantity: number): Promise<StopProductStock> {
    const [updated] = await db
      .update(stopProductStockTable)
      .set({ currentStock: sql`${stopProductStockTable.currentStock} - ${quantity}` })
      .where(eq(stopProductStockTable.id, stopProductStockId))
      .returning();
    return updated;
  }

  async recordEvent(event: Omit<StockEvent, "id">): Promise<StockEvent> {
    const [inserted] = await db.insert(stockEventsTable).values(event).returning();
    return inserted;
  }
}
```

- [ ] **Step 6: `DrizzleEventBookingRepository`**

`packages/db/src/repositories/event-booking-repository.ts`:

```ts
import { and, eq, gt, lt } from "drizzle-orm";
import type { EventBooking, EventBookingRepository } from "@workspace/domain/event-bookings";
import { db } from "../index";
import { eventBookingItemsTable, eventBookingsTable } from "../schema";

export class DrizzleEventBookingRepository implements EventBookingRepository {
  async create(booking: Omit<EventBooking, "id">): Promise<EventBooking> {
    return db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(eventBookingsTable)
        .values({
          clientName: booking.clientName,
          clientCompany: booking.clientCompany,
          clientEmail: booking.clientEmail,
          clientPhone: booking.clientPhone,
          eventType: booking.eventType,
          eventDate: booking.eventDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
          location: booking.location,
          estimatedGuests: booking.estimatedGuests,
          status: booking.status,
          notes: booking.notes,
        })
        .returning();

      if (booking.items.length > 0) {
        await tx.insert(eventBookingItemsTable).values(
          booking.items.map((item) => ({
            eventBookingId: inserted.id,
            description: item.description,
            quantity: item.quantity,
            agreedUnitPriceCents: item.agreedUnitPriceCents,
          })),
        );
      }

      return { ...inserted, items: booking.items };
    });
  }

  async findOverlapping(eventDate: Date, startTime: Date, endTime: Date): Promise<EventBooking[]> {
    const rows = await db
      .select()
      .from(eventBookingsTable)
      .where(
        and(
          eq(eventBookingsTable.status, "confirmed"),
          lt(eventBookingsTable.startTime, endTime),
          gt(eventBookingsTable.endTime, startTime),
        ),
      );

    return rows.map((row) => ({ ...row, items: [] }));
  }
}
```

- [ ] **Step 7: Barrel**

`packages/db/src/repositories/index.ts`:

```ts
export * from "./product-repository";
export * from "./order-repository";
export * from "./user-repository";
export * from "./stock-repository";
export * from "./event-booking-repository";
```

- [ ] **Step 8: Escribir el test de integración end-to-end (createOrder contra Postgres real)**

`packages/db/src/repositories/order-repository.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { createOrder } from "@workspace/domain/orders";
import { DrizzleProductRepository } from "./product-repository";
import { DrizzleOrderRepository } from "./order-repository";
import { db } from "../index";
import { productsTable } from "../schema";

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
});
```

- [ ] **Step 9: Correr el test contra la base real**

```bash
pnpm --filter @workspace/db run test
```

Expected: PASS. Si falla por conexión, confirmar que `packages/db/.env` tiene `DATABASE_URL` (Tarea 4, Step 1) y que las tablas ya fueron migradas (Tarea 4, Step 11).

- [ ] **Step 10: Typecheck + commit**

```bash
pnpm run typecheck
git add -A
git commit -m "Agrega repositorios Drizzle y test de integracion end-to-end de createOrder"
```

---

### Task 13: Cierre de Fase 1 — verificación final y checklist de aceptación

**Files:** ninguno nuevo — solo verificación y, si hace falta, ajustes menores.

- [ ] **Step 1: Typecheck completo**

```bash
pnpm run typecheck
```

Expected: limpio, sin errores en ningún paquete.

- [ ] **Step 2: Build completo**

```bash
pnpm run build
```

Expected: limpio. Si `apps/web-legacy` falla por `PORT`/`BASE_PATH` faltante, confirmar que su `.env` (heredado de la Tarea 3) sigue teniendo esos valores.

- [ ] **Step 3: Suite de tests completa**

```bash
pnpm run test
```

Expected: todos los tests de `packages/domain` (Tareas 5-11) y `packages/db` (Tarea 12) en verde.

- [ ] **Step 4: Confirmar las migraciones aplicadas**

```bash
pnpm --filter @workspace/db run push
```

Expected: "No changes detected" (ya se aplicaron en la Tarea 4) — confirma que el schema en código y el de Postgres siguen sincronizados.

- [ ] **Step 5: Checklist de criterios de aceptación de Fase 1** (de `plan-desarrollo.md`)

- [ ] `pnpm run typecheck` limpio — Step 1.
- [ ] Suite de Vitest de `packages/domain` y `packages/db` en verde — Step 3.
- [ ] Migraciones de Drizzle aplicadas sin error — Step 4.
- [ ] Caso de uso "crear orden" probado de punta a punta con un repositorio real — Tarea 12, Step 8-9.

- [ ] **Step 6: Actualizar `CLAUDE.md` con el estado final de Fase 1**

En [CLAUDE.md](../../../CLAUDE.md):
- Quitar el bloque de advertencia "⚠️ En transición de stack" de "Run & Operate" y reemplazar los comandos por los reales: `pnpm --filter @workspace/web run dev` (Next.js), `pnpm --filter @workspace/db run push`, `pnpm run typecheck`, `pnpm run build`, `pnpm run test`.
- Actualizar "Where things live" con `packages/domain`, `packages/db` (ya no `lib/db`), `packages/notifications`, y quitar la línea de `apps/api`/`lib/api-*` (ya no existen).
- Actualizar "Gotchas" quitando las notas específicas de Vite/Express que ya no aplican (siguen vigentes las de Postgres compartido dev/prod).
- Actualizar "Deploy (EasyPanel)" señalando que el servicio de `apps/api` ya no existe y que `apps/web` está temporalmente sirviendo el scaffold de Next.js (topología final se revisa en Fase 8).

- [ ] **Step 7: Commit final de Fase 1**

```bash
git add -A
git commit -m "Actualiza CLAUDE.md con el estado final de Fase 1"
```

- [ ] **Step 8: Resumen para el owner**

Presentar en el chat (no en un archivo nuevo): resumen de lo hecho, resultado real de cada criterio de aceptación (comandos + salida real), y cualquier decisión tomada por ambigüedad durante la ejecución que no haya sido confirmada explícitamente todavía. Esperar confirmación antes de arrancar Fase 2.
