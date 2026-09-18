# Fase 7 — Apps de despachador/delivery (Expo) + gestión de staff — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a despachador/delivery una app Expo (y páginas web equivalentes) para trabajar la
cola de órdenes — pasar de `received` a `ready_for_pickup`, asignar repartidor, marcar
`delivered` — con login propio (PIN por mobile, password por web) y push notifications.

**Architecture:** `apps/web` es el único backend. Expone Route Handlers REST bajo
`app/api/mobile/**` (JWT + HMAC de build) para `apps/mobile`, y Server Actions nuevas para
`/dispatch` y `/delivery` (sesión Auth.js). Ambos adaptadores llaman a los mismos casos de uso de
`packages/domain` — la lógica de negocio (transiciones de estado, guard de rol/ownership,
lockout de PIN) vive una sola vez.

**Tech Stack:** TypeScript, Next.js 15 Route Handlers, Drizzle, `jose` (JWT edge/node-safe, nuevo),
`bcryptjs` (ya en el repo), Expo (managed workflow), `expo-secure-store`, `expo-server-sdk`,
`crypto-js` (HMAC en el cliente Expo), Vitest.

**Spec:** [docs/superpowers/specs/2026-09-18-fase7-mobile-staff-design.md](../specs/2026-09-18-fase7-mobile-staff-design.md)

## Global Constraints

- Hexagonal estricta: `packages/domain` no importa Next.js, Drizzle, Expo ni `jose`/`bcryptjs`-en-runtime-nativo — solo tipos e interfaces de puertos; la única dependencia de librería ya establecida ahí es `bcryptjs` (ver `packages/domain/src/users/auth.ts`), que ya cubre el hashing de PIN también.
- `role` de staff: `despachador` | `delivery` (enum `user_role` ya existe, sin cambios).
- Solo `despachador` mueve `received → in_prep → ready_for_pickup` y asigna repartidor.
- Solo el `delivery` asignado (`assignedDeliveryUserId === actingUserId`) mueve `out_for_delivery → delivered`.
- Un fallo de notificación (push) nunca bloquea la persistencia del cambio de estado de la orden — mismo principio que SMTP en Fase 6.
- PIN: 6 dígitos, hasheado con `bcrypt` (reusar `hashPassword`/`verifyPassword` de `packages/domain/src/users/auth.ts` — es hashing genérico, no específico de password).
- Lockout de PIN: 5 intentos fallidos → bloqueo de 15 minutos (`pinLockedUntil`).
- JWT mobile: TTL 12h, secreto propio `MOBILE_JWT_SECRET` (nunca el de Auth.js).
- **Desviación deliberada de la spec (Sección 2):** en vez de generalizar `email_logs` →
  `notification_logs`, se agrega una tabla `push_logs` **separada**, con la misma forma. Motivo:
  la preferencia no negociable de minimalismo/reutilización del proyecto pesa más que la
  generalización — tocar `email_logs` obligaría a migrar datos, el repositorio de Fase 6, la
  página `/admin/email-logs` y sus i18n dicts sin necesidad real. `push_logs` cubre el mismo
  propósito (auditoría de envíos) sin ese riesgo.
- Ningún test nuevo para `apps/mobile` (spec, Sección 6, diferido explícitamente) — se verifica manualmente con Expo Go.
- Commits en español, un renglón, sin firmas — seguir el mismo patrón usado en el resto del repo (ver `git log`).

---

## Task 1: Schema de DB — columnas y tablas nuevas

**Files:**
- Modify: `packages/db/src/schema/orders.ts`
- Modify: `packages/db/src/schema/users.ts`
- Create: `packages/db/src/schema/push-tokens.ts`
- Create: `packages/db/src/schema/push-logs.ts`
- Modify: `packages/db/src/schema/index.ts`

**Interfaces:**
- Produces: `ordersTable.assignedDeliveryUserId`, `usersTable.failedPinAttempts`,
  `usersTable.pinLockedUntil`, `pushTokensTable`, `pushLogsTable` — usados por los repositorios
  de Task 4/6.

- [ ] **Step 1: Agregar `assignedDeliveryUserId` a `orders`**

En `packages/db/src/schema/orders.ts`, dentro de `ordersTable`, agregar después de
`stripePaymentIntentId`:

```ts
  assignedDeliveryUserId: uuid("assigned_delivery_user_id").references(() => usersTable.id),
```

- [ ] **Step 2: Agregar contadores de lockout a `users`**

En `packages/db/src/schema/users.ts`, agregar al final de las columnas (antes de `createdAt`):

```ts
  failedPinAttempts: integer("failed_pin_attempts").notNull().default(0),
  pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true }),
```

Actualizar el import de `drizzle-orm/pg-core` en ese archivo para incluir `integer`.

- [ ] **Step 3: Crear tabla `push_tokens`**

```ts
// packages/db/src/schema/push-tokens.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const pushTokensTable = pgTable("push_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id),
  token: text("token").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
```

- [ ] **Step 4: Crear tabla `push_logs`**

```ts
// packages/db/src/schema/push-logs.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const pushLogsTable = pgTable("push_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  to: text("to").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 5: Registrar los schemas nuevos en el índice**

En `packages/db/src/schema/index.ts`, agregar:

```ts
export * from "./push-tokens";
export * from "./push-logs";
```

- [ ] **Step 6: Push del schema a la DB de dev/prod**

Run: `pnpm --filter @workspace/db run push`
Expected: drizzle-kit reporta las tablas/columnas nuevas y las aplica sin pedir confirmación destructiva (todas son adiciones).

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/orders.ts packages/db/src/schema/users.ts packages/db/src/schema/push-tokens.ts packages/db/src/schema/push-logs.ts packages/db/src/schema/index.ts
git commit -m "Agrega columnas de asignacion de delivery y lockout de PIN, y tablas de push tokens/logs"
```

---

## Task 2: Dominio — entidades y puertos de usuarios extendidos

**Files:**
- Modify: `packages/domain/src/users/entities.ts`
- Modify: `packages/domain/src/users/ports.ts`
- Test: `packages/domain/src/users/use-cases.test.ts`

**Interfaces:**
- Consumes: nada nuevo (extiende tipos existentes).
- Produces: `User.failedPinAttempts: number`, `User.pinLockedUntil: Date | null`;
  `UserRepository.recordFailedPinAttempt(id, lockedUntil)`,
  `UserRepository.resetPinAttempts(id)`, `UserRepository.update` ampliado a
  `Partial<Pick<User, "preferredLocale" | "pinHash" | "isActive">>`.

- [ ] **Step 1: Escribir el test que fija la forma de `User`**

Agregar en `packages/domain/src/users/use-cases.test.ts` (junto a los tests existentes de
`authenticateUser`):

```ts
describe("authenticateStaffByPin", () => {
  it("rechaza si el usuario no existe", async () => {
    const repo = makeFakeUserRepo([]);
    await expect(authenticateStaffByPin(repo, "nadie@sweetsin.com", "123456")).resolves.toBeNull();
  });
});
```

(La fábrica `makeFakeUserRepo` y el resto de tests de `authenticateStaffByPin` se completan en el
Task 3 — este paso solo fuerza que `entities.ts`/`ports.ts` compilen con los campos nuevos.)

- [ ] **Step 2: Confirmar que el test falla por falta de la función (no por tipos)**

Run: `pnpm --filter @workspace/domain exec vitest run src/users/use-cases.test.ts`
Expected: FAIL — `authenticateStaffByPin is not defined` (se implementa en Task 3).

- [ ] **Step 3: Extender `User` con los campos de lockout**

En `packages/domain/src/users/entities.ts`:

```ts
export interface User {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  pinHash: string | null;
  passwordHash: string | null;
  isActive: boolean;
  preferredLocale: Locale;
  failedPinAttempts: number;
  pinLockedUntil: Date | null;
}
```

- [ ] **Step 4: Ampliar `UserRepository`**

En `packages/domain/src/users/ports.ts`:

```ts
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  listActiveByRole(role: UserRole): Promise<User[]>;
  create(user: Omit<User, "id">): Promise<User>;
  update(id: string, data: Partial<Pick<User, "preferredLocale" | "pinHash" | "isActive">>): Promise<User>;
  recordFailedPinAttempt(id: string, lockedUntil: Date | null): Promise<void>;
  resetPinAttempts(id: string): Promise<void>;
}
```

- [ ] **Step 5: Verificar que el paquete compila**

Run: `pnpm --filter @workspace/domain run typecheck`
Expected: PASS (el repo fake del Task 1 de este archivo todavía no existe como implementación completa — si el typecheck del test falla por la fábrica faltante, dejar el test de Step 1 comentado con `// completado en Task 3` en vez de referenciar símbolos inexistentes).

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/users/entities.ts packages/domain/src/users/ports.ts packages/domain/src/users/use-cases.test.ts
git commit -m "Extiende User y UserRepository con contadores de lockout de PIN"
```

---

## Task 3: Dominio — `authenticateStaffByPin` con lockout

**Files:**
- Modify: `packages/domain/src/users/use-cases.ts`
- Modify: `packages/domain/src/users/use-cases.test.ts`

**Interfaces:**
- Consumes: `UserRepository` (Task 2), `hashPassword`/`verifyPassword` de `./auth`.
- Produces: `authenticateStaffByPin(repo, email, pin): Promise<User | null>`,
  `registerStaffUser(repo, input): Promise<{ user: User; plainPin: string }>`,
  `resetStaffPin(repo, userId): Promise<string>`, `generatePin(): string`.

- [ ] **Step 1: Reemplazar el test parcial del Task 2 por la suite completa**

Reemplazar el bloque `describe("authenticateStaffByPin", ...)` agregado en el Task 2 por:

```ts
import { authenticateStaffByPin, registerStaffUser, resetStaffPin, generatePin } from "./use-cases";

function makeFakeUserRepo(users: User[]): UserRepository {
  const store = new Map(users.map((u) => [u.id, u]));
  return {
    findById: async (id) => store.get(id) ?? null,
    findByEmail: async (email) => [...store.values()].find((u) => u.email === email) ?? null,
    listActiveByRole: async (role) => [...store.values()].filter((u) => u.role === role && u.isActive),
    create: async (data) => {
      const user = { ...data, id: `user-${store.size + 1}` };
      store.set(user.id, user);
      return user;
    },
    update: async (id, data) => {
      const user = store.get(id);
      if (!user) throw new Error("not found");
      const updated = { ...user, ...data };
      store.set(id, updated);
      return updated;
    },
    recordFailedPinAttempt: async (id, lockedUntil) => {
      const user = store.get(id);
      if (!user) return;
      store.set(id, { ...user, failedPinAttempts: user.failedPinAttempts + 1, pinLockedUntil: lockedUntil });
    },
    resetPinAttempts: async (id) => {
      const user = store.get(id);
      if (!user) return;
      store.set(id, { ...user, failedPinAttempts: 0, pinLockedUntil: null });
    },
  };
}

const baseStaff: User = {
  id: "staff-1",
  name: "Ana Despachadora",
  email: "ana@sweetsin.com",
  role: "despachador",
  pinHash: null,
  passwordHash: null,
  isActive: true,
  preferredLocale: "es",
  failedPinAttempts: 0,
  pinLockedUntil: null,
};

describe("authenticateStaffByPin", () => {
  it("autentica con PIN correcto", async () => {
    const { hashPassword } = await import("./auth");
    const pinHash = await hashPassword("123456");
    const repo = makeFakeUserRepo([{ ...baseStaff, pinHash }]);

    const user = await authenticateStaffByPin(repo, "ana@sweetsin.com", "123456");

    expect(user?.id).toBe("staff-1");
  });

  it("rechaza PIN incorrecto e incrementa el contador", async () => {
    const { hashPassword } = await import("./auth");
    const pinHash = await hashPassword("123456");
    const repo = makeFakeUserRepo([{ ...baseStaff, pinHash }]);

    const user = await authenticateStaffByPin(repo, "ana@sweetsin.com", "000000");

    expect(user).toBeNull();
    const stored = await repo.findByEmail("ana@sweetsin.com");
    expect(stored?.failedPinAttempts).toBe(1);
  });

  it("bloquea tras 5 intentos fallidos", async () => {
    const { hashPassword } = await import("./auth");
    const pinHash = await hashPassword("123456");
    const repo = makeFakeUserRepo([{ ...baseStaff, pinHash, failedPinAttempts: 4 }]);

    await authenticateStaffByPin(repo, "ana@sweetsin.com", "000000");
    const lockedResult = await authenticateStaffByPin(repo, "ana@sweetsin.com", "123456");

    expect(lockedResult).toBeNull();
    const stored = await repo.findByEmail("ana@sweetsin.com");
    expect(stored?.pinLockedUntil).not.toBeNull();
  });

  it("rechaza si isActive es false", async () => {
    const { hashPassword } = await import("./auth");
    const pinHash = await hashPassword("123456");
    const repo = makeFakeUserRepo([{ ...baseStaff, pinHash, isActive: false }]);

    await expect(authenticateStaffByPin(repo, "ana@sweetsin.com", "123456")).resolves.toBeNull();
  });

  it("rechaza rol customer", async () => {
    const { hashPassword } = await import("./auth");
    const pinHash = await hashPassword("123456");
    const repo = makeFakeUserRepo([{ ...baseStaff, role: "customer", pinHash }]);

    await expect(authenticateStaffByPin(repo, "ana@sweetsin.com", "123456")).resolves.toBeNull();
  });
});

describe("registerStaffUser / resetStaffPin", () => {
  it("crea un despachador con PIN de 6 digitos y lo devuelve en texto plano una sola vez", async () => {
    const repo = makeFakeUserRepo([]);

    const { user, plainPin } = await registerStaffUser(repo, {
      name: "Ana",
      email: "ana@sweetsin.com",
      role: "despachador",
      password: "hunter2hunter2",
    });

    expect(plainPin).toMatch(/^\d{6}$/);
    expect(user.pinHash).not.toBeNull();
    expect(user.pinHash).not.toBe(plainPin);
  });

  it("resetStaffPin genera un PIN nuevo y resetea el lockout", async () => {
    const repo = makeFakeUserRepo([{ ...baseStaff, failedPinAttempts: 3, pinLockedUntil: new Date() }]);

    const plainPin = await resetStaffPin(repo, "staff-1");

    expect(plainPin).toMatch(/^\d{6}$/);
    const stored = await repo.findById("staff-1");
    expect(stored?.failedPinAttempts).toBe(0);
    expect(stored?.pinLockedUntil).toBeNull();
  });
});

describe("generatePin", () => {
  it("genera siempre 6 digitos numericos, incluso con ceros a la izquierda", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePin()).toMatch(/^\d{6}$/);
    }
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `pnpm --filter @workspace/domain exec vitest run src/users/use-cases.test.ts`
Expected: FAIL — `authenticateStaffByPin`/`registerStaffUser`/`resetStaffPin`/`generatePin` no existen.

- [ ] **Step 3: Implementar en `use-cases.ts`**

Agregar al final de `packages/domain/src/users/use-cases.ts`:

```ts
const PIN_LOCKOUT_ATTEMPTS = 5;
const PIN_LOCKOUT_MINUTES = 15;

export function generatePin(): string {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
}

export async function authenticateStaffByPin(
  repo: UserRepository,
  email: string,
  pin: string,
): Promise<User | null> {
  const user = await repo.findByEmail(email);
  if (!user || !user.isActive || !user.pinHash) return null;
  if (user.role !== "despachador" && user.role !== "delivery") return null;
  if (user.pinLockedUntil && user.pinLockedUntil > new Date()) return null;

  const valid = await verifyPassword(pin, user.pinHash);
  if (!valid) {
    const attempts = user.failedPinAttempts + 1;
    const lockedUntil =
      attempts >= PIN_LOCKOUT_ATTEMPTS ? new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60_000) : null;
    await repo.recordFailedPinAttempt(user.id, lockedUntil);
    return null;
  }

  await repo.resetPinAttempts(user.id);
  return user;
}

export async function registerStaffUser(
  repo: UserRepository,
  input: { name: string; email: string; role: Exclude<UserRole, "customer">; password: string },
): Promise<{ user: User; plainPin: string }> {
  const existing = await repo.findByEmail(input.email);
  if (existing) throw new Error(`User already exists with email: ${input.email}`);

  const passwordHash = await hashPassword(input.password);
  const plainPin = generatePin();
  const pinHash = await hashPassword(plainPin);

  const user = await repo.create({
    name: input.name,
    email: input.email,
    role: input.role,
    pinHash,
    passwordHash,
    isActive: true,
    preferredLocale: "es",
    failedPinAttempts: 0,
    pinLockedUntil: null,
  });

  return { user, plainPin };
}

export async function resetStaffPin(repo: UserRepository, userId: string): Promise<string> {
  const plainPin = generatePin();
  const pinHash = await hashPassword(plainPin);
  await repo.update(userId, { pinHash });
  await repo.resetPinAttempts(userId);
  return plainPin;
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `pnpm --filter @workspace/domain exec vitest run src/users/use-cases.test.ts`
Expected: PASS (todos los tests de este archivo, incluidos los preexistentes de `authenticateUser`).

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/users/use-cases.ts packages/domain/src/users/use-cases.test.ts
git commit -m "Agrega autenticacion por PIN con lockout y alta/reset de staff"
```

---

## Task 4: DB — repositorio de usuarios actualizado

**Files:**
- Modify: `packages/db/src/repositories/user-repository.ts`
- Modify: `packages/db/src/repositories/user-repository.test.ts` (crear si no existe con ese nombre exacto — confirmar `ls packages/db/src/repositories/` antes de escribir; si el archivo de test de usuarios tiene otro nombre, usar ese)

**Interfaces:**
- Consumes: `UserRepository` de Task 2, `usersTable` con columnas de lockout de Task 1.
- Produces: `DrizzleUserRepository` conforme a la interfaz ampliada.

- [ ] **Step 1: Escribir el test de los métodos nuevos**

Agregar a `packages/db/src/repositories/user-repository.test.ts`:

```ts
describe("recordFailedPinAttempt / resetPinAttempts", () => {
  it("incrementa el contador y setea el lock", async () => {
    const repo = new DrizzleUserRepository();
    const user = await repo.create({
      name: "Test Staff",
      email: `staff-${Date.now()}@sweetsin.test`,
      role: "despachador",
      pinHash: "hash",
      passwordHash: null,
      isActive: true,
      preferredLocale: "es",
      failedPinAttempts: 0,
      pinLockedUntil: null,
    });

    const lockedUntil = new Date(Date.now() + 60_000);
    await repo.recordFailedPinAttempt(user.id, lockedUntil);

    const found = await repo.findById(user.id);
    expect(found?.failedPinAttempts).toBe(1);
    expect(found?.pinLockedUntil?.getTime()).toBeCloseTo(lockedUntil.getTime(), -2);

    await repo.resetPinAttempts(user.id);
    const reset = await repo.findById(user.id);
    expect(reset?.failedPinAttempts).toBe(0);
    expect(reset?.pinLockedUntil).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `pnpm --filter @workspace/db exec vitest run src/repositories/user-repository.test.ts`
Expected: FAIL — `recordFailedPinAttempt is not a function`.

- [ ] **Step 3: Implementar en el repositorio**

En `packages/db/src/repositories/user-repository.ts`, reemplazar el método `update` y agregar los
dos nuevos al final de la clase:

```ts
  async update(id: string, data: Partial<Pick<User, "preferredLocale" | "pinHash" | "isActive">>): Promise<User> {
    const [updated] = await db.update(usersTable).set(data).where(eq(usersTable.id, id)).returning();
    if (!updated) throw new Error(`User not found: ${id}`);
    return { ...updated, preferredLocale: updated.preferredLocale as Locale };
  }

  async recordFailedPinAttempt(id: string, lockedUntil: Date | null): Promise<void> {
    const [current] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!current) return;
    await db
      .update(usersTable)
      .set({ failedPinAttempts: current.failedPinAttempts + 1, pinLockedUntil: lockedUntil })
      .where(eq(usersTable.id, id));
  }

  async resetPinAttempts(id: string): Promise<void> {
    await db.update(usersTable).set({ failedPinAttempts: 0, pinLockedUntil: null }).where(eq(usersTable.id, id));
  }
```

También actualizar `findById`, `findByEmail`, `listActiveByRole` y `create` para que el objeto
devuelto incluya `failedPinAttempts`/`pinLockedUntil` — como ya usan el spread `{ ...row, ... }`
sobre la fila completa de Drizzle, no requieren cambios de código, solo confirmar que el tipo
`User` (Task 2) matchea las columnas nuevas de la tabla (Task 1).

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `pnpm --filter @workspace/db exec vitest run src/repositories/user-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/repositories/user-repository.ts packages/db/src/repositories/user-repository.test.ts
git commit -m "Implementa lockout de PIN en DrizzleUserRepository"
```

---

## Task 5: Dominio — transiciones de orden por rol y asignación de delivery

**Files:**
- Modify: `packages/domain/src/orders/use-cases.ts`
- Modify: `packages/domain/src/orders/entities.ts`
- Modify: `packages/domain/src/orders/ports.ts`
- Modify: `packages/domain/src/orders/use-cases.test.ts`

**Interfaces:**
- Consumes: `OrderRepository` ampliado.
- Produces: `Order.assignedDeliveryUserId: string | null`;
  `OrderRepository.findQueueForDespachador()`, `OrderRepository.findAssignedToDelivery(userId)`,
  `OrderRepository.assignDelivery(orderId, deliveryUserId)`;
  `assignDeliveryToOrder(deps, orderId, deliveryUserId): Promise<Order>`,
  `markOrderInPrep(deps, orderId): Promise<Order>`, `markOrderReady(deps, orderId): Promise<Order>`,
  `markOrderDelivered(deps, orderId, actingUserId): Promise<Order>`.

- [ ] **Step 1: Extender `Order` y `OrderRepository`**

En `packages/domain/src/orders/entities.ts`, agregar a la interfaz `Order`:

```ts
  assignedDeliveryUserId: string | null;
```

En `packages/domain/src/orders/ports.ts`, agregar a `OrderRepository`:

```ts
  findQueueForDespachador(): Promise<Order[]>;
  findAssignedToDelivery(deliveryUserId: string): Promise<Order[]>;
  assignDelivery(orderId: string, deliveryUserId: string): Promise<void>;
```

- [ ] **Step 2: Escribir los tests de las transiciones**

Agregar a `packages/domain/src/orders/use-cases.test.ts`:

```ts
import { assignDeliveryToOrder, markOrderInPrep, markOrderReady, markOrderDelivered } from "./use-cases";

function makeFakeOrderRepo(orders: Order[]): OrderRepository {
  const store = new Map(orders.map((o) => [o.id, o]));
  return {
    create: async (data) => {
      const order = { ...data, id: `order-${store.size + 1}` };
      store.set(order.id, order);
      return order;
    },
    findById: async (id) => store.get(id) ?? null,
    attachPaymentIntent: async () => {},
    markAsPaid: async (id) => {
      const o = store.get(id);
      if (o) store.set(id, { ...o, paymentStatus: "paid" });
    },
    listAll: async () => [...store.values()],
    listByCustomerId: async () => [],
    updateFulfillmentStatus: async (id, status) => {
      const o = store.get(id);
      if (o) store.set(id, { ...o, fulfillmentStatus: status });
    },
    updatePaymentStatus: async () => {},
    findQueueForDespachador: async () =>
      [...store.values()].filter((o) => o.paymentStatus === "paid" && ["received", "in_prep"].includes(o.fulfillmentStatus)),
    findAssignedToDelivery: async (userId) =>
      [...store.values()].filter((o) => o.assignedDeliveryUserId === userId && o.fulfillmentStatus === "out_for_delivery"),
    assignDelivery: async (id, deliveryUserId) => {
      const o = store.get(id);
      if (o) store.set(id, { ...o, assignedDeliveryUserId: deliveryUserId, fulfillmentStatus: "out_for_delivery" });
    },
  };
}

const baseOrder: Order = {
  id: "order-1",
  customerId: null,
  customerName: "Cliente",
  customerEmail: "cliente@example.com",
  customerPhone: "555-0100",
  fulfillmentType: "self_delivery",
  deliveryAddress: "Calle Falsa 123",
  stopId: null,
  paymentStatus: "paid",
  fulfillmentStatus: "received",
  subtotalCents: 1000,
  discountCents: 0,
  deliveryFeeCents: 0,
  totalCents: 1000,
  channel: "web",
  stripePaymentIntentId: null,
  assignedDeliveryUserId: null,
  items: [],
};

describe("markOrderInPrep / markOrderReady", () => {
  it("mueve received -> in_prep -> ready_for_pickup", async () => {
    const repo = makeFakeOrderRepo([baseOrder]);

    await markOrderInPrep({ orders: repo }, "order-1");
    expect((await repo.findById("order-1"))?.fulfillmentStatus).toBe("in_prep");

    await markOrderReady({ orders: repo }, "order-1");
    expect((await repo.findById("order-1"))?.fulfillmentStatus).toBe("ready_for_pickup");
  });

  it("rechaza marcar ready si no esta in_prep", async () => {
    const repo = makeFakeOrderRepo([baseOrder]);
    await expect(markOrderReady({ orders: repo }, "order-1")).rejects.toThrow();
  });
});

describe("assignDeliveryToOrder", () => {
  it("asigna y pasa a out_for_delivery cuando esta ready_for_pickup", async () => {
    const repo = makeFakeOrderRepo([{ ...baseOrder, fulfillmentStatus: "ready_for_pickup" }]);

    const updated = await assignDeliveryToOrder({ orders: repo }, "order-1", "delivery-1");

    expect(updated.assignedDeliveryUserId).toBe("delivery-1");
    expect(updated.fulfillmentStatus).toBe("out_for_delivery");
  });

  it("rechaza si la orden no esta ready_for_pickup", async () => {
    const repo = makeFakeOrderRepo([baseOrder]);
    await expect(assignDeliveryToOrder({ orders: repo }, "order-1", "delivery-1")).rejects.toThrow();
  });
});

describe("markOrderDelivered", () => {
  it("marca delivered si el actingUserId es el asignado", async () => {
    const repo = makeFakeOrderRepo([
      { ...baseOrder, fulfillmentStatus: "out_for_delivery", assignedDeliveryUserId: "delivery-1" },
    ]);

    const updated = await markOrderDelivered({ orders: repo }, "order-1", "delivery-1");

    expect(updated.fulfillmentStatus).toBe("delivered");
  });

  it("rechaza si el actingUserId no es el asignado", async () => {
    const repo = makeFakeOrderRepo([
      { ...baseOrder, fulfillmentStatus: "out_for_delivery", assignedDeliveryUserId: "delivery-1" },
    ]);

    await expect(markOrderDelivered({ orders: repo }, "order-1", "delivery-2")).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Correr los tests y confirmar que fallan**

Run: `pnpm --filter @workspace/domain exec vitest run src/orders/use-cases.test.ts`
Expected: FAIL — funciones no definidas.

- [ ] **Step 4: Implementar en `use-cases.ts`**

Agregar al final de `packages/domain/src/orders/use-cases.ts`:

```ts
export async function markOrderInPrep(deps: { orders: OrderRepository }, orderId: string): Promise<Order> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.fulfillmentStatus !== "received") {
    throw new Error(`Cannot move to in_prep from status: ${order.fulfillmentStatus}`);
  }
  await deps.orders.updateFulfillmentStatus(orderId, "in_prep");
  return { ...order, fulfillmentStatus: "in_prep" };
}

export async function markOrderReady(deps: { orders: OrderRepository }, orderId: string): Promise<Order> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.fulfillmentStatus !== "in_prep") {
    throw new Error(`Cannot move to ready_for_pickup from status: ${order.fulfillmentStatus}`);
  }
  await deps.orders.updateFulfillmentStatus(orderId, "ready_for_pickup");
  return { ...order, fulfillmentStatus: "ready_for_pickup" };
}

export async function assignDeliveryToOrder(
  deps: { orders: OrderRepository },
  orderId: string,
  deliveryUserId: string,
): Promise<Order> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.fulfillmentStatus !== "ready_for_pickup") {
    throw new Error(`Cannot assign delivery from status: ${order.fulfillmentStatus}`);
  }
  await deps.orders.assignDelivery(orderId, deliveryUserId);
  return { ...order, assignedDeliveryUserId: deliveryUserId, fulfillmentStatus: "out_for_delivery" };
}

export async function markOrderDelivered(
  deps: { orders: OrderRepository },
  orderId: string,
  actingUserId: string,
): Promise<Order> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.fulfillmentStatus !== "out_for_delivery") {
    throw new Error(`Cannot mark delivered from status: ${order.fulfillmentStatus}`);
  }
  if (order.assignedDeliveryUserId !== actingUserId) {
    throw new Error("Only the assigned delivery user can mark this order as delivered");
  }
  await deps.orders.updateFulfillmentStatus(orderId, "delivered");
  return { ...order, fulfillmentStatus: "delivered" };
}
```

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `pnpm --filter @workspace/domain exec vitest run src/orders/use-cases.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/orders/entities.ts packages/domain/src/orders/ports.ts packages/domain/src/orders/use-cases.ts packages/domain/src/orders/use-cases.test.ts
git commit -m "Agrega transiciones de fulfillment por rol y asignacion de delivery"
```

---

## Task 6: DB — repositorio de órdenes actualizado

**Files:**
- Modify: `packages/db/src/repositories/order-repository.ts`
- Modify: `packages/db/src/repositories/order-repository.test.ts`

**Interfaces:**
- Consumes: `OrderRepository` de Task 5, `ordersTable.assignedDeliveryUserId` de Task 1.
- Produces: `DrizzleOrderRepository` conforme a la interfaz ampliada.

- [ ] **Step 1: Escribir los tests de los métodos nuevos**

Agregar a `packages/db/src/repositories/order-repository.test.ts` (reusar el helper existente de
creación de orden de prueba del mismo archivo si existe; si no, crear una orden mínima inline con
`repo.create`):

```ts
describe("findQueueForDespachador", () => {
  it("devuelve solo ordenes paid + received/in_prep", async () => {
    const repo = new DrizzleOrderRepository();
    const paidReceived = await repo.create({ ...minimalOrderInput, paymentStatus: "paid", fulfillmentStatus: "received" });
    await repo.create({ ...minimalOrderInput, paymentStatus: "pending", fulfillmentStatus: "received" });
    await repo.create({ ...minimalOrderInput, paymentStatus: "paid", fulfillmentStatus: "delivered" });

    const queue = await repo.findQueueForDespachador();

    expect(queue.map((o) => o.id)).toContain(paidReceived.id);
    expect(queue.every((o) => o.paymentStatus === "paid")).toBe(true);
    expect(queue.every((o) => ["received", "in_prep"].includes(o.fulfillmentStatus))).toBe(true);
  });
});

describe("assignDelivery / findAssignedToDelivery", () => {
  it("asigna un delivery y lo devuelve en su listado", async () => {
    const repo = new DrizzleOrderRepository();
    const order = await repo.create({ ...minimalOrderInput, paymentStatus: "paid", fulfillmentStatus: "ready_for_pickup" });

    await repo.assignDelivery(order.id, "delivery-user-id");
    await repo.updateFulfillmentStatus(order.id, "out_for_delivery");

    const assigned = await repo.findAssignedToDelivery("delivery-user-id");
    expect(assigned.map((o) => o.id)).toContain(order.id);
  });
});
```

Si el archivo no tiene todavía un `minimalOrderInput` compartido, definirlo al tope del archivo
con los campos obligatorios de `Omit<Order, "id">` usados por los tests preexistentes de
`create`/`findById` (copiar la forma exacta que ya usan esos tests para no divergir).

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `pnpm --filter @workspace/db exec vitest run src/repositories/order-repository.test.ts`
Expected: FAIL — `findQueueForDespachador is not a function`.

- [ ] **Step 3: Implementar en el repositorio**

En `packages/db/src/repositories/order-repository.ts`, agregar al final de la clase (antes de
`attachItems`):

```ts
  async findQueueForDespachador(): Promise<Order[]> {
    const rows = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.paymentStatus, "paid"),
          or(eq(ordersTable.fulfillmentStatus, "received"), eq(ordersTable.fulfillmentStatus, "in_prep")),
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
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `pnpm --filter @workspace/db exec vitest run src/repositories/order-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/repositories/order-repository.ts packages/db/src/repositories/order-repository.test.ts
git commit -m "Implementa cola de despachador y asignacion de delivery en DrizzleOrderRepository"
```

---

## Task 7: Notificaciones push — puerto, adaptador Expo y logs

**Files:**
- Create: `packages/domain/src/notifications/staff-ports.ts`
- Modify: `packages/domain/src/notifications/index.ts`
- Modify: `packages/notifications/src/expo/expo-notification-adapter.ts`
- Modify: `packages/notifications/src/expo/expo-notification-adapter.test.ts`
- Create: `packages/db/src/repositories/push-token-repository.ts`
- Create: `packages/db/src/repositories/push-log-repository.ts`
- Modify: `packages/db/src/repositories/index.ts`
- Modify: `packages/notifications/package.json` (agregar `expo-server-sdk`)

**Interfaces:**
- Consumes: `pushTokensTable`/`pushLogsTable` de Task 1.
- Produces: `StaffNotificationPort.notifyNewOrderInQueue(despachadorUserIds, order)`,
  `StaffNotificationPort.notifyDeliveryAssigned(deliveryUserId, order)`;
  `PushTokenRepository`, `PushLogRepository` — usados por los Route Handlers de Task 8 y las
  Server Actions de Task 11.

- [ ] **Step 1: Definir el puerto de notificación a staff**

```ts
// packages/domain/src/notifications/staff-ports.ts
export interface StaffNotificationPort {
  notifyNewOrderInQueue(despachadorUserIds: string[], order: { id: string; customerName: string }): Promise<void>;
  notifyDeliveryAssigned(deliveryUserId: string, order: { id: string; deliveryAddress: string | null }): Promise<void>;
}

export interface PushTokenRepository {
  upsert(userId: string, token: string): Promise<void>;
  findByUserId(userId: string): Promise<string | null>;
  findByUserIds(userIds: string[]): Promise<{ userId: string; token: string }[]>;
}

export type PushLogStatus = "sent" | "failed" | "blocked";

export interface PushLog {
  id: string;
  to: string;
  type: "new_order_in_queue" | "delivery_assigned";
  status: PushLogStatus;
  errorMessage: string | null;
  createdAt: Date;
}

export interface PushLogRepository {
  create(entry: Omit<PushLog, "id" | "createdAt">): Promise<PushLog>;
  listAll(): Promise<PushLog[]>;
}
```

En `packages/domain/src/notifications/index.ts`, agregar:

```ts
export * from "./staff-ports";
```

- [ ] **Step 2: Agregar `expo-server-sdk` como dependencia**

Run: `pnpm --filter @workspace/notifications add expo-server-sdk`
Expected: se agrega a `packages/notifications/package.json` y al lockfile.

- [ ] **Step 3: Escribir el test del adaptador**

Reemplazar el contenido de `packages/notifications/src/expo/expo-notification-adapter.test.ts` con:

```ts
import { describe, it, expect, vi } from "vitest";
import { ExpoNotificationAdapter } from "./expo-notification-adapter";
import type { PushTokenRepository, PushLogRepository } from "@workspace/domain/notifications";

function makeDeps() {
  const sentPushes: unknown[] = [];
  const logs: unknown[] = [];
  const pushTokens: PushTokenRepository = {
    upsert: async () => {},
    findByUserId: async () => "ExponentPushToken[fake]",
    findByUserIds: async (ids) => ids.map((userId) => ({ userId, token: "ExponentPushToken[fake]" })),
  };
  const pushLogs: PushLogRepository = {
    create: async (entry) => {
      logs.push(entry);
      return { ...entry, id: "log-1", createdAt: new Date() };
    },
    listAll: async () => [],
  };
  return { pushTokens, pushLogs, sentPushes, logs };
}

describe("ExpoNotificationAdapter.notifyDeliveryAssigned", () => {
  it("loguea failed si el usuario no tiene push token registrado", async () => {
    const deps = makeDeps();
    deps.pushTokens.findByUserId = async () => null;
    const adapter = new ExpoNotificationAdapter(deps.pushTokens, deps.pushLogs);

    await adapter.notifyDeliveryAssigned("delivery-1", { id: "order-1", deliveryAddress: "Calle 123" });

    expect(deps.logs).toHaveLength(1);
    expect((deps.logs[0] as { status: string }).status).toBe("blocked");
  });
});
```

(El caso de éxito con `expo-server-sdk` real se verifica manualmente contra el push token de un
dispositivo de prueba — mockear la librería de Expo en Vitest agrega complejidad de red que no
aporta al contrato del puerto; el contrato relevante para tests unitarios es el logging de
éxito/fallo, no el transporte.)

- [ ] **Step 4: Correr el test y confirmar que falla**

Run: `pnpm --filter @workspace/notifications exec vitest run src/expo/expo-notification-adapter.test.ts`
Expected: FAIL — el constructor todavía no acepta `(pushTokens, pushLogs)`.

- [ ] **Step 5: Implementar el adaptador**

```ts
// packages/notifications/src/expo/expo-notification-adapter.ts
import { Expo } from "expo-server-sdk";
import type { NotificationPort } from "@workspace/domain/notifications";
import type {
  StaffNotificationPort,
  PushTokenRepository,
  PushLogRepository,
} from "@workspace/domain/notifications";
import type { Locale } from "@workspace/domain/shared";

const expo = new Expo();

export class ExpoNotificationAdapter implements NotificationPort, StaffNotificationPort {
  constructor(
    private readonly pushTokens: PushTokenRepository,
    private readonly pushLogs: PushLogRepository,
  ) {}

  async sendOrderConfirmation(
    order: { customerEmail: string; totalCents: number; id: string },
    locale: Locale,
  ): Promise<void> {
    throw new Error("Not implemented — customer push notifications are out of scope for Phase 7");
  }

  async sendEventQuoteRequestReceipt(booking: { clientEmail: string; id: string }, locale: Locale): Promise<void> {
    throw new Error("Not implemented — customer push notifications are out of scope for Phase 7");
  }

  async notifyNewOrderInQueue(
    despachadorUserIds: string[],
    order: { id: string; customerName: string },
  ): Promise<void> {
    const tokens = await this.pushTokens.findByUserIds(despachadorUserIds);
    for (const { userId, token } of tokens) {
      await this.sendOne(userId, token, "new_order_in_queue", {
        title: "Nueva orden en cola",
        body: `Pedido de ${order.customerName} listo para preparar`,
      });
    }
  }

  async notifyDeliveryAssigned(
    deliveryUserId: string,
    order: { id: string; deliveryAddress: string | null },
  ): Promise<void> {
    const token = await this.pushTokens.findByUserId(deliveryUserId);
    if (!token) {
      await this.pushLogs.create({ to: deliveryUserId, type: "delivery_assigned", status: "blocked", errorMessage: "No push token registered" });
      return;
    }
    await this.sendOne(deliveryUserId, token, "delivery_assigned", {
      title: "Entrega asignada",
      body: order.deliveryAddress ? `Entregar en ${order.deliveryAddress}` : "Nueva entrega asignada",
    });
  }

  private async sendOne(
    userId: string,
    token: string,
    type: "new_order_in_queue" | "delivery_assigned",
    message: { title: string; body: string },
  ): Promise<void> {
    if (!Expo.isExpoPushToken(token)) {
      await this.pushLogs.create({ to: userId, type, status: "blocked", errorMessage: "Invalid Expo push token" });
      return;
    }
    try {
      await expo.sendPushNotificationsAsync([{ to: token, ...message }]);
      await this.pushLogs.create({ to: userId, type, status: "sent", errorMessage: null });
    } catch (error) {
      await this.pushLogs.create({
        to: userId,
        type,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
```

- [ ] **Step 6: Correr el test y confirmar que pasa**

Run: `pnpm --filter @workspace/notifications exec vitest run src/expo/expo-notification-adapter.test.ts`
Expected: PASS.

- [ ] **Step 7: Repositorios de DB para tokens y logs**

```ts
// packages/db/src/repositories/push-token-repository.ts
import { eq, inArray } from "drizzle-orm";
import type { PushTokenRepository } from "@workspace/domain/notifications";
import { db } from "../index";
import { pushTokensTable } from "../schema";

export class DrizzlePushTokenRepository implements PushTokenRepository {
  async upsert(userId: string, token: string): Promise<void> {
    await db
      .insert(pushTokensTable)
      .values({ userId, token })
      .onConflictDoUpdate({ target: pushTokensTable.userId, set: { token } });
  }

  async findByUserId(userId: string): Promise<string | null> {
    const [row] = await db.select().from(pushTokensTable).where(eq(pushTokensTable.userId, userId));
    return row?.token ?? null;
  }

  async findByUserIds(userIds: string[]): Promise<{ userId: string; token: string }[]> {
    if (userIds.length === 0) return [];
    const rows = await db.select().from(pushTokensTable).where(inArray(pushTokensTable.userId, userIds));
    return rows.map((row) => ({ userId: row.userId, token: row.token }));
  }
}
```

```ts
// packages/db/src/repositories/push-log-repository.ts
import { desc } from "drizzle-orm";
import type { PushLog, PushLogRepository } from "@workspace/domain/notifications";
import { db } from "../index";
import { pushLogsTable } from "../schema";

export class DrizzlePushLogRepository implements PushLogRepository {
  async create(entry: Omit<PushLog, "id" | "createdAt">): Promise<PushLog> {
    const [inserted] = await db.insert(pushLogsTable).values(entry).returning();
    return inserted as PushLog;
  }

  async listAll(): Promise<PushLog[]> {
    return (await db.select().from(pushLogsTable).orderBy(desc(pushLogsTable.createdAt))) as PushLog[];
  }
}
```

En `packages/db/src/repositories/index.ts`, agregar:

```ts
export * from "./push-token-repository";
export * from "./push-log-repository";
```

- [ ] **Step 8: Typecheck de los tres paquetes tocados**

Run: `pnpm --filter @workspace/domain --filter @workspace/notifications --filter @workspace/db run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/domain/src/notifications packages/notifications/src/expo packages/notifications/package.json packages/db/src/repositories/push-token-repository.ts packages/db/src/repositories/push-log-repository.ts packages/db/src/repositories/index.ts pnpm-lock.yaml
git commit -m "Implementa notificaciones push a staff via Expo con log de envios"
```

---

## Task 8: Web — helper de JWT mobile y HMAC de build

**Files:**
- Create: `apps/web/src/lib/mobile-auth.ts`
- Create: `apps/web/src/lib/mobile-auth.test.ts`
- Modify: `apps/web/package.json` (agregar `jose`)
- Modify: `apps/web/.env.local` (documentar, no commitear — ver Step en la Task 15)

**Interfaces:**
- Produces: `signMobileJwt(payload: { sub: string; role: "despachador" | "delivery" }): Promise<string>`,
  `verifyMobileJwt(token: string): Promise<{ sub: string; role: string } | null>`,
  `verifyAppSignature(req: Request, rawBody: string): boolean`.

- [ ] **Step 1: Agregar `jose`**

Run: `pnpm --filter @workspace/web add jose`
Expected: se agrega a `apps/web/package.json` y al lockfile.

- [ ] **Step 2: Escribir el test**

```ts
// apps/web/src/lib/mobile-auth.test.ts
import { describe, it, expect } from "vitest";
import { signMobileJwt, verifyMobileJwt, verifyAppSignature } from "./mobile-auth";
import { createHmac } from "node:crypto";

describe("signMobileJwt / verifyMobileJwt", () => {
  it("firma y verifica un JWT valido", async () => {
    const token = await signMobileJwt({ sub: "user-1", role: "despachador" });
    const payload = await verifyMobileJwt(token);
    expect(payload?.sub).toBe("user-1");
    expect(payload?.role).toBe("despachador");
  });

  it("rechaza un token invalido", async () => {
    const payload = await verifyMobileJwt("token-basura");
    expect(payload).toBeNull();
  });
});

describe("verifyAppSignature", () => {
  it("acepta una firma HMAC correcta", () => {
    const secret = process.env.EXPO_PUBLIC_APP_SECRET ?? "test-secret";
    process.env.EXPO_PUBLIC_APP_SECRET = secret;
    const body = JSON.stringify({ email: "a@a.com", pin: "123456" });
    const signature = createHmac("sha256", secret).update(body).digest("hex");

    expect(verifyAppSignature(signature, body)).toBe(true);
  });

  it("rechaza una firma incorrecta", () => {
    process.env.EXPO_PUBLIC_APP_SECRET = "test-secret";
    expect(verifyAppSignature("firma-incorrecta", "{}")).toBe(false);
  });
});
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `pnpm --filter @workspace/web exec vitest run src/lib/mobile-auth.test.ts`
Expected: FAIL — el módulo `./mobile-auth` no existe.

- [ ] **Step 4: Implementar**

```ts
// apps/web/src/lib/mobile-auth.ts
import { SignJWT, jwtVerify } from "jose";
import { createHmac, timingSafeEqual } from "node:crypto";

const MOBILE_JWT_TTL = "12h";

function getMobileJwtSecret(): Uint8Array {
  const secret = process.env.MOBILE_JWT_SECRET;
  if (!secret) throw new Error("MOBILE_JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signMobileJwt(payload: { sub: string; role: "despachador" | "delivery" }): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(MOBILE_JWT_TTL)
    .sign(getMobileJwtSecret());
}

export async function verifyMobileJwt(token: string): Promise<{ sub: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getMobileJwtSecret());
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") return null;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export function verifyAppSignature(signature: string, rawBody: string): boolean {
  const secret = process.env.EXPO_PUBLIC_APP_SECRET;
  if (!secret) throw new Error("EXPO_PUBLIC_APP_SECRET is not set");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `pnpm --filter @workspace/web exec vitest run src/lib/mobile-auth.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/mobile-auth.ts apps/web/src/lib/mobile-auth.test.ts apps/web/package.json pnpm-lock.yaml
git commit -m "Agrega firma/verificacion de JWT mobile y HMAC de build"
```

---

## Task 9: Web — `requireStaff` y guard de sesión ampliado

**Files:**
- Create: `apps/web/src/lib/require-staff.ts`
- Modify: `apps/web/src/lib/require-admin.ts` (opcional — ver Step 3)

**Interfaces:**
- Consumes: `auth()` de `@/auth` (ya existe).
- Produces: `requireStaff(allowedRoles: ("despachador" | "delivery")[]): Promise<{ userId: string; role: string }>`.

- [ ] **Step 1: Implementar el guard**

```ts
// apps/web/src/lib/require-staff.ts
import { auth } from "@/auth";
import type { UserRole } from "@workspace/domain/users";

export async function requireStaff(allowedRoles: UserRole[]): Promise<{ userId: string; role: UserRole }> {
  const session = await auth();
  if (!session || !session.user.id || !allowedRoles.includes(session.user.role)) {
    throw new Error("Forbidden");
  }
  return { userId: session.user.id, role: session.user.role };
}
```

- [ ] **Step 2: Verificar el tipo de `session.user`**

Run: `grep -n "role" apps/web/src/auth.config.ts apps/web/src/*.d.ts apps/web/src/**/*.d.ts 2>/dev/null`
Confirmar que `session.user.role` ya está tipado como `UserRole` (declarado vía module
augmentation de `next-auth` en algún `.d.ts` de Fase 4) y que `session.user.id` existe. Si el tipo
de `id` falta en la augmentation, agregar `id: string;` al bloque `interface User`/`Session` de
ese archivo.

- [ ] **Step 3: No modificar `require-admin.ts`**

`requireAdmin()` sigue exactamente igual — sigue siendo el guard exclusivo de `role === "admin"`
para `/admin/**`. `requireStaff` es un guard nuevo y separado para `/dispatch` y `/delivery`.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @workspace/web run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/require-staff.ts
git commit -m "Agrega requireStaff para las secciones web de despachador y delivery"
```

---

## Task 10: Web — Route Handlers de la API mobile

**Files:**
- Create: `apps/web/src/app/api/mobile/auth/login/route.ts`
- Create: `apps/web/src/app/api/mobile/auth/me/route.ts`
- Create: `apps/web/src/app/api/mobile/orders/queue/route.ts`
- Create: `apps/web/src/app/api/mobile/orders/assigned/route.ts`
- Create: `apps/web/src/app/api/mobile/orders/[id]/status/route.ts`
- Create: `apps/web/src/app/api/mobile/orders/[id]/assign/route.ts`
- Create: `apps/web/src/app/api/mobile/orders/[id]/deliver/route.ts`
- Create: `apps/web/src/app/api/mobile/push-token/route.ts`
- Create: `apps/web/src/app/api/mobile/_lib/require-mobile-auth.ts`
- Create: `apps/web/src/app/api/mobile/auth/login/route.test.ts`

**Interfaces:**
- Consumes: `signMobileJwt`/`verifyMobileJwt`/`verifyAppSignature` (Task 8),
  `authenticateStaffByPin`, `markOrderInPrep`, `markOrderReady`, `assignDeliveryToOrder`,
  `markOrderDelivered` (Task 3/5), `DrizzleUserRepository`, `DrizzleOrderRepository`,
  `DrizzlePushTokenRepository`.
- Produces: los 8 endpoints REST documentados en la spec, Sección 3.

- [ ] **Step 1: Middleware de auth mobile compartido**

```ts
// apps/web/src/app/api/mobile/_lib/require-mobile-auth.ts
import { verifyMobileJwt } from "@/lib/mobile-auth";
import { DrizzleUserRepository } from "@workspace/db/repositories";

export async function requireMobileAuth(
  req: Request,
): Promise<{ userId: string; role: "despachador" | "delivery" } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length);
  const payload = await verifyMobileJwt(token);
  if (!payload || (payload.role !== "despachador" && payload.role !== "delivery")) return null;

  const user = await new DrizzleUserRepository().findById(payload.sub);
  if (!user || !user.isActive) return null;

  return { userId: user.id, role: payload.role };
}
```

- [ ] **Step 2: Login**

```ts
// apps/web/src/app/api/mobile/auth/login/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateStaffByPin } from "@workspace/domain/users";
import { DrizzleUserRepository } from "@workspace/db/repositories";
import { signMobileJwt, verifyAppSignature } from "@/lib/mobile-auth";

const bodySchema = z.object({ email: z.string().email(), pin: z.string().regex(/^\d{6}$/) });

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-app-signature");
  if (!signature || !verifyAppSignature(signature, rawBody)) {
    return NextResponse.json({ error: "Invalid app signature" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const user = await authenticateStaffByPin(new DrizzleUserRepository(), parsed.data.email, parsed.data.pin);
  if (!user || (user.role !== "despachador" && user.role !== "delivery")) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signMobileJwt({ sub: user.id, role: user.role });
  return NextResponse.json({ token, role: user.role, name: user.name });
}
```

- [ ] **Step 3: Test de login (con y sin firma válida)**

```ts
// apps/web/src/app/api/mobile/auth/login/route.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "node:crypto";
import { POST } from "./route";

beforeAll(() => {
  process.env.EXPO_PUBLIC_APP_SECRET = "test-secret";
  process.env.MOBILE_JWT_SECRET = "test-jwt-secret";
});

function sign(body: string): string {
  return createHmac("sha256", "test-secret").update(body).digest("hex");
}

describe("POST /api/mobile/auth/login", () => {
  it("rechaza sin firma HMAC", async () => {
    const body = JSON.stringify({ email: "a@a.com", pin: "123456" });
    const req = new Request("http://localhost/api/mobile/auth/login", { method: "POST", body });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("rechaza credenciales invalidas incluso con firma valida", async () => {
    const body = JSON.stringify({ email: "no-existe@sweetsin.test", pin: "123456" });
    const req = new Request("http://localhost/api/mobile/auth/login", {
      method: "POST",
      body,
      headers: { "x-app-signature": sign(body) },
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });
});
```

(Este test requiere `DATABASE_URL` como el resto de `packages/db` — correr junto a la suite de
integración, no en un typecheck aislado.)

- [ ] **Step 4: Correr el test de login**

Run: `pnpm --filter @workspace/web exec vitest run src/app/api/mobile/auth/login/route.test.ts`
Expected: PASS.

- [ ] **Step 5: `GET /api/mobile/auth/me`**

```ts
// apps/web/src/app/api/mobile/auth/me/route.ts
import { NextResponse } from "next/server";
import { requireMobileAuth } from "../../_lib/require-mobile-auth";

export async function GET(req: Request): Promise<Response> {
  const session = await requireMobileAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(session);
}
```

- [ ] **Step 6: Cola de despachador y órdenes asignadas de delivery**

```ts
// apps/web/src/app/api/mobile/orders/queue/route.ts
import { NextResponse } from "next/server";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { requireMobileAuth } from "../../_lib/require-mobile-auth";

export async function GET(req: Request): Promise<Response> {
  const session = await requireMobileAuth(req);
  if (!session || session.role !== "despachador") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orders = await new DrizzleOrderRepository().findQueueForDespachador();
  return NextResponse.json({ orders });
}
```

```ts
// apps/web/src/app/api/mobile/orders/assigned/route.ts
import { NextResponse } from "next/server";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { requireMobileAuth } from "../../_lib/require-mobile-auth";

export async function GET(req: Request): Promise<Response> {
  const session = await requireMobileAuth(req);
  if (!session || session.role !== "delivery") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orders = await new DrizzleOrderRepository().findAssignedToDelivery(session.userId);
  return NextResponse.json({ orders });
}
```

- [ ] **Step 7: Transiciones de estado, asignación y entrega**

```ts
// apps/web/src/app/api/mobile/orders/[id]/status/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { markOrderInPrep, markOrderReady } from "@workspace/domain/orders";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { requireMobileAuth } from "../../../_lib/require-mobile-auth";

const bodySchema = z.object({ status: z.enum(["in_prep", "ready_for_pickup"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await requireMobileAuth(req);
  if (!session || session.role !== "despachador") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const repo = new DrizzleOrderRepository();
  try {
    const order =
      parsed.data.status === "in_prep" ? await markOrderInPrep({ orders: repo }, id) : await markOrderReady({ orders: repo }, id);
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Conflict" }, { status: 409 });
  }
}
```

```ts
// apps/web/src/app/api/mobile/orders/[id]/assign/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { assignDeliveryToOrder } from "@workspace/domain/orders";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { requireMobileAuth } from "../../../_lib/require-mobile-auth";

const bodySchema = z.object({ deliveryUserId: z.string().uuid() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await requireMobileAuth(req);
  if (!session || session.role !== "despachador") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    const order = await assignDeliveryToOrder({ orders: new DrizzleOrderRepository() }, id, parsed.data.deliveryUserId);
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Conflict" }, { status: 409 });
  }
}
```

```ts
// apps/web/src/app/api/mobile/orders/[id]/deliver/route.ts
import { NextResponse } from "next/server";
import { markOrderDelivered } from "@workspace/domain/orders";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { requireMobileAuth } from "../../../_lib/require-mobile-auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await requireMobileAuth(req);
  if (!session || session.role !== "delivery") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  try {
    const order = await markOrderDelivered({ orders: new DrizzleOrderRepository() }, id, session.userId);
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Conflict" }, { status: 409 });
  }
}
```

- [ ] **Step 8: Registro de push token**

```ts
// apps/web/src/app/api/mobile/push-token/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { DrizzlePushTokenRepository } from "@workspace/db/repositories";
import { requireMobileAuth } from "../_lib/require-mobile-auth";

const bodySchema = z.object({ token: z.string().min(1) });

export async function POST(req: Request): Promise<Response> {
  const session = await requireMobileAuth(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await new DrizzlePushTokenRepository().upsert(session.userId, parsed.data.token);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 9: Typecheck completo de `apps/web`**

Run: `pnpm --filter @workspace/web run typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/api/mobile
git commit -m "Agrega los Route Handlers REST de la API mobile de despachador y delivery"
```

---

## Task 11: Web — panel admin de staff (`/admin/staff`)

**Files:**
- Create: `apps/web/src/app/actions/admin-staff.ts`
- Create: `apps/web/src/app/[locale]/admin/staff/page.tsx`
- Create: `apps/web/src/app/[locale]/admin/staff/staff-table.tsx`
- Create: `apps/web/src/app/[locale]/admin/staff/new-staff-form.tsx`
- Modify: `apps/web/src/app/[locale]/admin/layout.tsx` (agregar el link de navegación a `/admin/staff`, siguiendo el mismo patrón que el link a `/admin/email-logs`)

**Interfaces:**
- Consumes: `registerStaffUser`, `resetStaffPin`, `listActiveStaff` (Task 3, ya existía
  parcialmente), `requireAdmin` (sin cambios).
- Produces: `listStaffAction(): Promise<User[]>`, `createStaffAction(input): Promise<{ plainPin: string }>`,
  `resetStaffPinAction(userId): Promise<{ plainPin: string }>`, `toggleStaffActiveAction(userId, isActive): Promise<void>`.

- [ ] **Step 1: Revisar el patrón de página admin existente**

Run: `cat apps/web/src/app/[locale]/admin/email-logs/page.tsx apps/web/src/app/actions/admin-orders.ts`
Usar exactamente esa estructura (Server Component que llama a la Server Action en el server, tabla
client component si hace falta interactividad) para `admin-staff.ts` y `admin/staff/page.tsx` —
no introducir un patrón nuevo de fetching.

- [ ] **Step 2: Server Actions**

```ts
// apps/web/src/app/actions/admin-staff.ts
"use server";

import { registerStaffUser, resetStaffPin, listActiveStaff } from "@workspace/domain/users";
import type { User, UserRole } from "@workspace/domain/users";
import { DrizzleUserRepository } from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";

export async function listStaffAction(): Promise<User[]> {
  await requireAdmin();
  const repo = new DrizzleUserRepository();
  const [despachadores, deliveries] = await Promise.all([
    listActiveStaff(repo, "despachador"),
    listActiveStaff(repo, "delivery"),
  ]);
  return [...despachadores, ...deliveries];
}

export async function createStaffAction(input: {
  name: string;
  email: string;
  role: Extract<UserRole, "despachador" | "delivery">;
  password: string;
}): Promise<{ plainPin: string }> {
  await requireAdmin();
  const { plainPin } = await registerStaffUser(new DrizzleUserRepository(), input);
  return { plainPin };
}

export async function resetStaffPinAction(userId: string): Promise<{ plainPin: string }> {
  await requireAdmin();
  const plainPin = await resetStaffPin(new DrizzleUserRepository(), userId);
  return { plainPin };
}

export async function toggleStaffActiveAction(userId: string, isActive: boolean): Promise<void> {
  await requireAdmin();
  await new DrizzleUserRepository().update(userId, { isActive });
}
```

`listActiveStaff` solo devuelve usuarios activos — para que el admin también pueda reactivar a
alguien desactivado, agregar en este mismo Task un método de listado que no filtre por
`isActive` si hace falta ver inactivos en la tabla: extender `UserRepository.listActiveByRole`
con un segundo parámetro opcional `includeInactive?: boolean` en `packages/domain/src/users/ports.ts`
y su implementación en `DrizzleUserRepository`, o — más simple y sin tocar la interfaz existente —
agregar un método nuevo `listByRole(role): Promise<User[]>` sin el filtro de `isActive`, usado
solo por `listStaffAction`. Usar esta segunda opción (no romper la firma que ya consume
`listActiveStaff` en otros lados).

- [ ] **Step 3: Página del panel**

```tsx
// apps/web/src/app/[locale]/admin/staff/page.tsx
import { listStaffAction } from "@/app/actions/admin-staff";
import { StaffTable } from "./staff-table";
import { NewStaffForm } from "./new-staff-form";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const staff = await listStaffAction();
  return (
    <div>
      <h1>Staff</h1>
      <NewStaffForm />
      <StaffTable staff={staff} />
    </div>
  );
}
```

`NewStaffForm` (client component) llama a `createStaffAction` y `StaffTable` expone los botones
de "resetear PIN" (`resetStaffPinAction`) y toggle de `isActive` (`toggleStaffActiveAction`);
ambos muestran el `plainPin` devuelto en un modal/alert una sola vez, sin persistirlo en el
estado del cliente más allá de esa sesión de UI. Seguir el estilo de componentes/formularios ya
usado en `apps/web/src/app/[locale]/admin/trailer-stops/new/page.tsx` (Fase 5) para no introducir
un patrón de formulario nuevo.

- [ ] **Step 4: Link de navegación**

En `apps/web/src/app/[locale]/admin/layout.tsx`, agregar el link a `/admin/staff` junto al de
`/admin/email-logs`, con el mismo componente de navegación ya usado ahí.

- [ ] **Step 5: Typecheck y build**

Run: `pnpm --filter @workspace/web run typecheck`
Expected: PASS.

- [ ] **Step 6: Verificación manual**

Levantar `pnpm --filter @workspace/web run dev`, loguear como admin, ir a `/admin/staff`, crear un
despachador de prueba, confirmar que se muestra el PIN una sola vez, resetear el PIN y confirmar
que cambia, desactivar y reactivar el usuario.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/actions/admin-staff.ts apps/web/src/app/[locale]/admin/staff apps/web/src/app/[locale]/admin/layout.tsx packages/domain/src/users/ports.ts packages/domain/src/users/use-cases.ts packages/db/src/repositories/user-repository.ts
git commit -m "Agrega el panel admin de gestion de staff con generacion y reset de PIN"
```

---

## Task 12: Web — Server Actions y páginas de `/dispatch` y `/delivery`

**Files:**
- Create: `apps/web/src/app/actions/dispatch.ts`
- Create: `apps/web/src/app/actions/delivery.ts`
- Create: `apps/web/src/app/[locale]/dispatch/page.tsx`
- Create: `apps/web/src/app/[locale]/dispatch/queue-list.tsx`
- Create: `apps/web/src/app/[locale]/delivery/page.tsx`
- Create: `apps/web/src/app/[locale]/delivery/assigned-list.tsx`
- Modify: `apps/web/src/auth.ts` (permitir login de `despachador`/`delivery` — ya lo permite
  `authenticateUser`, que no filtra por rol; solo confirmar, no requiere cambio de código)

**Interfaces:**
- Consumes: `requireStaff` (Task 9), `markOrderInPrep`, `markOrderReady`,
  `assignDeliveryToOrder`, `markOrderDelivered` (Task 5), `listActiveStaff` (para el selector de
  repartidor).

- [ ] **Step 1: Confirmar que el login web ya funciona para despachador/delivery**

`authenticateUser` (Task existente, sin cambios) no filtra por `role` — cualquier usuario con
`passwordHash` puede loguear vía `/login`. El único cambio necesario es a dónde redirige después
del login: revisar `apps/web/src/app/[locale]/login/login-form.tsx` (o equivalente) y, si redirige
siempre a `/admin`, ramificar por `session.user.role` (`admin` → `/admin`, `despachador` →
`/dispatch`, `delivery` → `/delivery`).

- [ ] **Step 2: Server Actions de dispatch**

```ts
// apps/web/src/app/actions/dispatch.ts
"use server";

import { markOrderInPrep, markOrderReady, assignDeliveryToOrder } from "@workspace/domain/orders";
import type { Order } from "@workspace/domain/orders";
import { listActiveStaff } from "@workspace/domain/users";
import type { User } from "@workspace/domain/users";
import { DrizzleOrderRepository, DrizzleUserRepository } from "@workspace/db/repositories";
import { requireStaff } from "@/lib/require-staff";

export async function listQueueAction(): Promise<Order[]> {
  await requireStaff(["despachador"]);
  return new DrizzleOrderRepository().findQueueForDespachador();
}

export async function listDeliveryStaffAction(): Promise<User[]> {
  await requireStaff(["despachador"]);
  return listActiveStaff(new DrizzleUserRepository(), "delivery");
}

export async function markInPrepAction(orderId: string): Promise<void> {
  await requireStaff(["despachador"]);
  await markOrderInPrep({ orders: new DrizzleOrderRepository() }, orderId);
}

export async function markReadyAction(orderId: string): Promise<void> {
  await requireStaff(["despachador"]);
  await markOrderReady({ orders: new DrizzleOrderRepository() }, orderId);
}

export async function assignDeliveryAction(orderId: string, deliveryUserId: string): Promise<void> {
  await requireStaff(["despachador"]);
  await assignDeliveryToOrder({ orders: new DrizzleOrderRepository() }, orderId, deliveryUserId);
}
```

- [ ] **Step 3: Server Actions de delivery**

```ts
// apps/web/src/app/actions/delivery.ts
"use server";

import { markOrderDelivered } from "@workspace/domain/orders";
import type { Order } from "@workspace/domain/orders";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { requireStaff } from "@/lib/require-staff";

export async function listAssignedAction(): Promise<Order[]> {
  const { userId } = await requireStaff(["delivery"]);
  return new DrizzleOrderRepository().findAssignedToDelivery(userId);
}

export async function markDeliveredAction(orderId: string): Promise<void> {
  const { userId } = await requireStaff(["delivery"]);
  await markOrderDelivered({ orders: new DrizzleOrderRepository() }, orderId, userId);
}
```

- [ ] **Step 4: Páginas**

```tsx
// apps/web/src/app/[locale]/dispatch/page.tsx
import { listQueueAction, listDeliveryStaffAction } from "@/app/actions/dispatch";
import { QueueList } from "./queue-list";

export const dynamic = "force-dynamic";

export default async function DispatchPage() {
  const [orders, deliveryStaff] = await Promise.all([listQueueAction(), listDeliveryStaffAction()]);
  return <QueueList orders={orders} deliveryStaff={deliveryStaff} />;
}
```

```tsx
// apps/web/src/app/[locale]/delivery/page.tsx
import { listAssignedAction } from "@/app/actions/delivery";
import { AssignedList } from "./assigned-list";

export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  const orders = await listAssignedAction();
  return <AssignedList orders={orders} />;
}
```

`queue-list.tsx` y `assigned-list.tsx` son client components: listan las órdenes, exponen botones
que llaman a `markInPrepAction`/`markReadyAction`/`assignDeliveryAction` (dispatch) o
`markDeliveredAction` (delivery), y llaman `router.refresh()` después de cada acción — mismo
patrón ya usado en `apps/web/src/app/[locale]/admin/orders/[id]/page.tsx` para refrescar tras una
Server Action.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @workspace/web run typecheck`
Expected: PASS.

- [ ] **Step 6: Verificación manual**

Crear un despachador y un delivery de prueba desde `/admin/staff` (Task 11), loguear como cada
uno en `/login`, confirmar que despachador ve `/dispatch` y puede mover una orden de prueba
`received → in_prep → ready_for_pickup → asignar delivery`, y que ese delivery la ve en
`/delivery` y puede marcarla `delivered`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/actions/dispatch.ts apps/web/src/app/actions/delivery.ts apps/web/src/app/[locale]/dispatch apps/web/src/app/[locale]/delivery
git commit -m "Agrega las paginas y Server Actions web de dispatch y delivery"
```

---

## Task 13: Conectar las notificaciones push a las transiciones de orden

**Files:**
- Modify: `packages/domain/src/orders/use-cases.ts` (firma de `markOrderInPrep`/`assignDeliveryToOrder` amplía sus `deps`)
- Modify: `packages/domain/src/orders/use-cases.test.ts`
- Modify: `apps/web/src/app/api/mobile/orders/[id]/status/route.ts`
- Modify: `apps/web/src/app/api/mobile/orders/[id]/assign/route.ts`
- Modify: `apps/web/src/app/actions/dispatch.ts`

**Interfaces:**
- Consumes: `StaffNotificationPort` (Task 7), `listActiveStaff` (para obtener los `despachador` activos al notificar cola nueva).
- Produces: side-effect de notificación dentro de los casos de uso existentes, sin bloquear la transición si falla.

- [ ] **Step 1: Escribir el test del side-effect (no bloqueante)**

Agregar a `packages/domain/src/orders/use-cases.test.ts`:

```ts
describe("assignDeliveryToOrder con notificacion", () => {
  it("notifica al delivery asignado y no falla si la notificacion falla", async () => {
    const repo = makeFakeOrderRepo([{ ...baseOrder, fulfillmentStatus: "ready_for_pickup" }]);
    const notify = vi.fn().mockRejectedValue(new Error("push service down"));

    const updated = await assignDeliveryToOrder(
      { orders: repo, notifications: { notifyDeliveryAssigned: notify, notifyNewOrderInQueue: vi.fn() } },
      "order-1",
      "delivery-1",
    );

    expect(updated.assignedDeliveryUserId).toBe("delivery-1");
    expect(notify).toHaveBeenCalledWith("delivery-1", expect.objectContaining({ id: "order-1" }));
  });
});
```

Agregar `import { vi } from "vitest";` al tope del archivo si no está ya importado.

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `pnpm --filter @workspace/domain exec vitest run src/orders/use-cases.test.ts`
Expected: FAIL — `assignDeliveryToOrder` no acepta `deps.notifications` todavía, o lanza porque
el mock de notificación rechaza.

- [ ] **Step 3: Ampliar `assignDeliveryToOrder` para notificar sin bloquear**

En `packages/domain/src/orders/use-cases.ts`, actualizar la firma e implementación:

```ts
import type { StaffNotificationPort } from "../notifications";

export async function assignDeliveryToOrder(
  deps: { orders: OrderRepository; notifications?: StaffNotificationPort },
  orderId: string,
  deliveryUserId: string,
): Promise<Order> {
  const order = await deps.orders.findById(orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.fulfillmentStatus !== "ready_for_pickup") {
    throw new Error(`Cannot assign delivery from status: ${order.fulfillmentStatus}`);
  }
  await deps.orders.assignDelivery(orderId, deliveryUserId);
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
```

Aplicar el mismo patrón (parámetro `notifications?` opcional, `try/catch` mudo alrededor del
`await`) a `markOrderInPrep` cuando la orden pasa de `pending`/`received` — en este proyecto la
notificación de "nueva orden en cola" dispara cuando `fulfillment_status` llega a `received`, lo
cual hoy ocurre en el webhook de Stripe / confirmación de orden de invitado (Fase 3/6), no en
`markOrderInPrep`. Por eso este Task **no** toca `confirmOrderPayment` — se deja para un ajuste
futuro fuera de este plan si se decide notificar en ese punto; documentarlo como nota en el PR en
vez de expandir el alcance de esta tarea.

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `pnpm --filter @workspace/domain exec vitest run src/orders/use-cases.test.ts`
Expected: PASS.

- [ ] **Step 5: Inyectar el adaptador real en los adaptadores de entrada**

En `apps/web/src/app/api/mobile/orders/[id]/assign/route.ts`, construir las dependencias con el
adaptador real:

```ts
import { ExpoNotificationAdapter } from "@workspace/notifications/expo";
import { DrizzlePushTokenRepository, DrizzlePushLogRepository } from "@workspace/db/repositories";
```

y reemplazar `{ orders: new DrizzleOrderRepository() }` por:

```ts
{
  orders: new DrizzleOrderRepository(),
  notifications: new ExpoNotificationAdapter(new DrizzlePushTokenRepository(), new DrizzlePushLogRepository()),
}
```

Aplicar el mismo cambio en `apps/web/src/app/actions/dispatch.ts`, función `assignDeliveryAction`.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @workspace/domain --filter @workspace/web run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/domain/src/orders/use-cases.ts packages/domain/src/orders/use-cases.test.ts apps/web/src/app/api/mobile/orders/[id]/assign/route.ts apps/web/src/app/actions/dispatch.ts
git commit -m "Conecta la notificacion push de delivery asignado a assignDeliveryToOrder"
```

---

## Task 14: `apps/mobile` — scaffold Expo con login PIN y colas

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/App.tsx`
- Create: `apps/mobile/src/api/client.ts`
- Create: `apps/mobile/src/auth/session.ts`
- Create: `apps/mobile/src/screens/LoginScreen.tsx`
- Create: `apps/mobile/src/screens/DespachadorQueueScreen.tsx`
- Create: `apps/mobile/src/screens/DeliveryQueueScreen.tsx`
- Create: `apps/mobile/src/navigation/index.tsx`
- Modify: `pnpm-workspace.yaml` (agregar `apps/mobile` si el glob `apps/*` no lo cubre ya)

Sin tests automatizados (spec, diferido). Cada paso es de implementación + verificación manual
con Expo Go.

- [ ] **Step 1: Confirmar que el workspace ya incluye `apps/mobile`**

Run: `cat pnpm-workspace.yaml`
Si el patrón es `apps/*`, no hace falta tocar el archivo. Si lista rutas explícitas, agregar
`apps/mobile`.

- [ ] **Step 2: Scaffolding de Expo**

Run: `pnpm dlx create-expo-app@latest apps/mobile --template blank-typescript`
Expected: crea `apps/mobile` con `App.tsx`, `package.json`, `tsconfig.json`, `app.json` base.

- [ ] **Step 3: Dependencias adicionales**

Run: `pnpm --filter apps/mobile add @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context expo-secure-store expo-notifications crypto-js`
Run: `pnpm --filter apps/mobile add -D @types/crypto-js`

- [ ] **Step 4: Cliente de API con HMAC y JWT**

```ts
// apps/mobile/src/api/client.ts
import HmacSHA256 from "crypto-js/hmac-sha256";
import Hex from "crypto-js/enc-hex";
import { getToken } from "../auth/session";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://sweetsin.example.com";
const APP_SECRET = process.env.EXPO_PUBLIC_APP_SECRET ?? "";

function signBody(body: string): string {
  return HmacSHA256(body, APP_SECRET).toString(Hex);
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  if (path === "/api/mobile/auth/login" && typeof init.body === "string") {
    headers.set("X-App-Signature", signBody(init.body));
  }

  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}
```

- [ ] **Step 5: Sesión con `expo-secure-store`**

```ts
// apps/mobile/src/auth/session.ts
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "sweetsin_mobile_jwt";

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
```

- [ ] **Step 6: Pantalla de login**

```tsx
// apps/mobile/src/screens/LoginScreen.tsx
import { useState } from "react";
import { View, TextInput, Button, Text } from "react-native";
import { apiFetch } from "../api/client";
import { saveToken } from "../auth/session";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (role: "despachador" | "delivery") => void }) {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const res = await apiFetch("/api/mobile/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, pin }),
    });
    if (!res.ok) {
      setError("Email o PIN incorrecto");
      return;
    }
    const data = (await res.json()) as { token: string; role: "despachador" | "delivery" };
    await saveToken(data.token);
    onLoggedIn(data.role);
  }

  return (
    <View>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput placeholder="PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={6} secureTextEntry />
      {error && <Text>{error}</Text>}
      <Button title="Entrar" onPress={handleSubmit} />
    </View>
  );
}
```

- [ ] **Step 7: Pantallas de cola**

```tsx
// apps/mobile/src/screens/DespachadorQueueScreen.tsx
import { useEffect, useState } from "react";
import { View, Text, Button, FlatList } from "react-native";
import { apiFetch } from "../api/client";

type QueueOrder = { id: string; customerName: string; fulfillmentStatus: string };

export function DespachadorQueueScreen() {
  const [orders, setOrders] = useState<QueueOrder[]>([]);

  async function loadQueue() {
    const res = await apiFetch("/api/mobile/orders/queue");
    if (res.ok) {
      const data = (await res.json()) as { orders: QueueOrder[] };
      setOrders(data.orders);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  async function advance(orderId: string, status: "in_prep" | "ready_for_pickup") {
    await apiFetch(`/api/mobile/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    loadQueue();
  }

  return (
    <FlatList
      data={orders}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View>
          <Text>{item.customerName} — {item.fulfillmentStatus}</Text>
          {item.fulfillmentStatus === "received" && <Button title="Empezar preparacion" onPress={() => advance(item.id, "in_prep")} />}
          {item.fulfillmentStatus === "in_prep" && <Button title="Marcar listo" onPress={() => advance(item.id, "ready_for_pickup")} />}
        </View>
      )}
    />
  );
}
```

```tsx
// apps/mobile/src/screens/DeliveryQueueScreen.tsx
import { useEffect, useState } from "react";
import { View, Text, Button, FlatList } from "react-native";
import { apiFetch } from "../api/client";

type AssignedOrder = { id: string; deliveryAddress: string | null };

export function DeliveryQueueScreen() {
  const [orders, setOrders] = useState<AssignedOrder[]>([]);

  async function loadAssigned() {
    const res = await apiFetch("/api/mobile/orders/assigned");
    if (res.ok) {
      const data = (await res.json()) as { orders: AssignedOrder[] };
      setOrders(data.orders);
    }
  }

  useEffect(() => {
    loadAssigned();
  }, []);

  async function deliver(orderId: string) {
    await apiFetch(`/api/mobile/orders/${orderId}/deliver`, { method: "PATCH" });
    loadAssigned();
  }

  return (
    <FlatList
      data={orders}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View>
          <Text>{item.deliveryAddress ?? "Direccion no especificada"}</Text>
          <Button title="Marcar entregado" onPress={() => deliver(item.id)} />
        </View>
      )}
    />
  );
}
```

- [ ] **Step 8: Navegación raíz**

```tsx
// apps/mobile/src/navigation/index.tsx
import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../screens/LoginScreen";
import { DespachadorQueueScreen } from "../screens/DespachadorQueueScreen";
import { DeliveryQueueScreen } from "../screens/DeliveryQueueScreen";
import { getToken, clearToken } from "../auth/session";
import { apiFetch } from "../api/client";

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const [role, setRole] = useState<"despachador" | "delivery" | null | "loading">("loading");

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return setRole(null);
      const res = await apiFetch("/api/mobile/auth/me");
      if (!res.ok) {
        await clearToken();
        return setRole(null);
      }
      const data = (await res.json()) as { role: "despachador" | "delivery" };
      setRole(data.role);
    })();
  }, []);

  if (role === "loading") return null;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {role === null && <Stack.Screen name="Login" options={{ headerShown: false }}>{() => <LoginScreen onLoggedIn={setRole} />}</Stack.Screen>}
        {role === "despachador" && <Stack.Screen name="Cola" component={DespachadorQueueScreen} />}
        {role === "delivery" && <Stack.Screen name="Entregas" component={DeliveryQueueScreen} />}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

```tsx
// apps/mobile/App.tsx
import { RootNavigator } from "./src/navigation";

export default function App() {
  return <RootNavigator />;
}
```

- [ ] **Step 9: Env vars de build**

Documentar en un `apps/mobile/.env.example` (commiteable, sin secretos reales):

```
EXPO_PUBLIC_API_BASE_URL=https://sweetsin.example.com
EXPO_PUBLIC_APP_SECRET=
```

El valor real de `EXPO_PUBLIC_APP_SECRET` debe ser el mismo string que `EXPO_PUBLIC_APP_SECRET`
en `apps/web/.env.local` — ambos lados verifican/firman con el mismo secreto compartido.

- [ ] **Step 10: Verificación manual**

Run: `pnpm --filter apps/mobile run start`
Con `apps/web` corriendo en dev y `EXPO_PUBLIC_API_BASE_URL` apuntando a esa URL (usar un túnel
tipo `ngrok` o la IP local de la red, no `localhost`, para que el dispositivo/emulador Expo
alcance el backend), loguear con el despachador de prueba creado en el Task 11, confirmar que la
cola carga, avanzar una orden a `ready_for_pickup`, loguear como el delivery de prueba y marcarla
`delivered`.

- [ ] **Step 11: Commit**

```bash
git add apps/mobile pnpm-workspace.yaml
git commit -m "Agrega el scaffold de apps/mobile con login por PIN y colas de despachador/delivery"
```

---

## Task 15: Documentación — env vars y CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** ninguna — solo documentación.

- [ ] **Step 1: Agregar las env vars nuevas a la sección "Run & Operate"**

Agregar a la lista de variables requeridas en `CLAUDE.md`:

```
- Variables de la API mobile (Fase 7): `MOBILE_JWT_SECRET`, `EXPO_PUBLIC_APP_SECRET` (`apps/web/.env.local`) — sin ellas, los Route Handlers de `/api/mobile/**` lanzan al arrancar en vez de operar con un secreto por defecto inseguro.
```

- [ ] **Step 2: Agregar una entrada a "Architecture decisions" documentando la Fase 7**

Agregar un bullet nuevo siguiendo el estilo de los bullets de Fase 5/6 ya existentes, resumiendo:
apps/mobile como cliente Expo hablando con Route Handlers REST de apps/web (no un backend
separado), auth por PIN con lockout, `/dispatch`/`/delivery` como páginas web nuevas y separadas
de `/admin/orders`, y la desviación deliberada de `push_logs` como tabla separada de `email_logs`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Documenta la Fase 7 en CLAUDE.md"
```

---

## Self-Review (completado durante la escritura de este plan)

- **Cobertura de la spec:** las 8 secciones de la spec tienen tarea — dominio (Task 2/3/5),
  DB (Task 1/4/6), notificaciones push (Task 7/13), API mobile (Task 8/9/10), apps/mobile
  (Task 14), testing (integrado en cada task con TDD), gestión de staff (Task 11), credenciales
  web de staff (Task 9/12). La única desviación (Task 7, `push_logs` vs `notification_logs`) está
  documentada explícitamente en Global Constraints con su motivo.
- **Placeholders:** ninguno — cada step de código trae la implementación completa, no
  descripciones.
- **Consistencia de tipos:** `Order.assignedDeliveryUserId`, `User.failedPinAttempts`/
  `pinLockedUntil`, y las firmas de `markOrderInPrep`/`markOrderReady`/`assignDeliveryToOrder`/
  `markOrderDelivered` se usan de forma idéntica en Tasks 2, 3, 5, 6, 10, 12 y 13.
