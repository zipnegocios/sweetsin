# Fase 6 — Notificaciones nativas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el esqueleto vacío de `packages/notifications` con un adaptador SMTP real (nodemailer) que envía confirmaciones de orden y recibos de cotización de evento en inglés o español según la preferencia del destinatario, agregar esa preferencia a la cuenta del cliente, y loguear cada intento de envío en una tabla consultable desde el panel admin.

**Architecture:** El puerto `NotificationPort` (ya existente en `packages/domain/src/notifications`) gana un parámetro `locale`. `SmtpNotificationAdapter` (nuevo, en `packages/notifications`) lo implementa con nodemailer, validando credenciales de forma lazy (nunca al importar el módulo) y lanzando un error dedicado si faltan. La resolución del locale (sesión logueada → preferencia guardada; invitado → locale de la página) y el registro del intento de envío en `email_logs` viven en la capa de wiring de `apps/web` (Server Actions), no en el adaptador — mismo patrón hexagonal ya usado en todo el proyecto (dominio puro, adaptadores en su paquete, orquestación en `apps/web`).

**Tech Stack:** nodemailer (cliente SMTP), Drizzle ORM (`email_logs`, columna `preferred_locale` en `users`), Auth.js v5 (JWT con revalidación por request ya existente), next-intl (`useLocale()`), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-fase-6-notificaciones-nativas-design.md`

## Global Constraints

- Sin credenciales SMTP reales: el adaptador debe señalar el bloqueo explícitamente (lanzar `SmtpNotConfiguredError`), nunca simular un envío exitoso — mismo patrón congelado para Stripe en Fase 3.
- Los emails son texto plano, dos plantillas por método (EN/ES) — sin motor de templates nuevo.
- Fuera de alcance: bandeja de entrada/IMAP/webhooks entrantes, filtros/paginación en `/admin/email-logs`, conexión real de Expo push, asociar la orden a `customerId` cuando hay sesión.
- Un fallo de envío o de log nunca bloquea la persistencia de la orden/cotización — siempre `try/catch` silencioso (solo logueado).
- Reutilización: no crear ningún helper/tipo que ya exista (`Locale` se define una sola vez, en `packages/domain/src/shared`, y se reusa desde `users` y `notifications`).
- Reglas de commit del proyecto: cada tarea termina en `git add` + mensaje de commit en español, una sola línea, sin firmas — el owner corre `git commit` manualmente.
- Todo el razonamiento y las explicaciones van en español (regla de `CLAUDE.md`), aunque el código y los comentarios sigan en inglés donde ya es la convención del repo (identificadores, mensajes de error de dominio).

---

### Task 1: Dominio — tipo `Locale` compartido + `preferredLocale` en `User`

**Files:**
- Modify: `packages/domain/src/shared/types.ts`
- Modify: `packages/domain/src/shared/index.ts` (sin cambios de contenido — ya hace `export * from "./types"`, se verifica que siga exportando `Locale`)
- Modify: `packages/domain/src/users/entities.ts`
- Modify: `packages/domain/src/users/ports.ts`
- Test: `packages/domain/src/users/use-cases.test.ts` (fixtures existentes, ver Step 4)

**Interfaces:**
- Produces: `export type Locale = "en" | "es";` desde `@workspace/domain/shared`. `User.preferredLocale: Locale`. `UserRepository.update(id: string, data: Partial<Pick<User, "preferredLocale">>): Promise<User>`.

- [ ] **Step 1: Agregar el tipo `Locale` compartido**

En `packages/domain/src/shared/types.ts`, agregar al final:

```ts
export type Locale = "en" | "es";
```

- [ ] **Step 2: Agregar `preferredLocale` a la entidad `User`**

En `packages/domain/src/users/entities.ts`:

```ts
import type { Locale } from "../shared";

export type UserRole = "admin" | "despachador" | "delivery" | "customer";

export interface User {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  pinHash: string | null;
  passwordHash: string | null;
  isActive: boolean;
  preferredLocale: Locale;
}
```

- [ ] **Step 3: Agregar `update` al puerto `UserRepository`**

En `packages/domain/src/users/ports.ts`:

```ts
import type { User, UserRole } from "./entities";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  listActiveByRole(role: UserRole): Promise<User[]>;
  create(user: Omit<User, "id">): Promise<User>;
  update(id: string, data: Partial<Pick<User, "preferredLocale">>): Promise<User>;
}
```

- [ ] **Step 4: Arreglar los fixtures existentes que ahora no compilan**

`preferredLocale` es un campo requerido nuevo — todos los objetos `User` literales en `packages/domain/src/users/use-cases.test.ts` necesitan el campo. En ese archivo, agregar `preferredLocale: "en",` a cada objeto `User` literal dentro de `fakeUserRepo(...)` (los que arman `Existing`, `Active Despachador`, `Inactive Despachador`, `Delivery`, `Jane Admin` en sus 3 apariciones). También agregar el método `update` al objeto que devuelve `fakeUserRepo` (aunque ningún test lo llame todavía, debe implementar la interfaz completa):

```ts
async update(id, data) {
  const user = users.find((u) => u.id === id);
  if (!user) throw new Error(`User not found: ${id}`);
  Object.assign(user, data);
  return user;
},
```

- [ ] **Step 5: Correr el test suite de dominio para confirmar que compila y pasa**

Run: `pnpm --filter @workspace/domain run test`
Expected: PASS (todos los tests existentes de `users`, sin ninguno nuevo todavía).

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/shared/types.ts packages/domain/src/users/entities.ts packages/domain/src/users/ports.ts packages/domain/src/users/use-cases.test.ts
```

Sugerir al owner: `git commit -m "Agrega preferredLocale a la entidad User y el tipo Locale compartido"`

---

### Task 2: Dominio — caso de uso `updateUserPreferredLocale` + `registerCustomer` con locale

**Files:**
- Modify: `packages/domain/src/users/use-cases.ts`
- Modify: `packages/domain/src/users/use-cases.test.ts`
- Modify: `apps/web/src/app/actions/register.ts` (consumidor directo de `registerCustomer`)

**Interfaces:**
- Consumes: `UserRepository` de la Task 1 (con `update`), `Locale` de `@workspace/domain/shared`.
- Produces: `updateUserPreferredLocale(repo: UserRepository, userId: string, locale: Locale): Promise<User>`. `registerCustomer(repo, input: { name: string; email: string; password: string; preferredLocale: Locale })`.

- [ ] **Step 1: Escribir el test que falla para `updateUserPreferredLocale`**

Agregar a `packages/domain/src/users/use-cases.test.ts`:

```ts
import { registerCustomer, listActiveStaff, authenticateUser, updateUserPreferredLocale } from "./use-cases";

// ...

describe("updateUserPreferredLocale", () => {
  it("updates the user's preferred locale", async () => {
    const repo = fakeUserRepo([
      { id: "u1", name: "Jane Doe", email: "jane@example.com", role: "customer", pinHash: null, passwordHash: null, isActive: true, preferredLocale: "en" },
    ]);

    const updated = await updateUserPreferredLocale(repo, "u1", "es");

    expect(updated.preferredLocale).toBe("es");
  });

  it("throws when the user does not exist", async () => {
    const repo = fakeUserRepo([]);

    await expect(updateUserPreferredLocale(repo, "missing", "es")).rejects.toThrow("User not found: missing");
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm --filter @workspace/domain run test -- use-cases.test.ts`
Expected: FAIL con `updateUserPreferredLocale is not a function` (o similar, no exportada todavía).

- [ ] **Step 3: Implementar `updateUserPreferredLocale` y actualizar `registerCustomer`**

En `packages/domain/src/users/use-cases.ts`:

```ts
import type { UserRepository } from "./ports";
import type { User, UserRole } from "./entities";
import type { Locale } from "../shared";
import { hashPassword, verifyPassword } from "./auth";

export async function listActiveStaff(
  repo: UserRepository,
  role: Exclude<UserRole, "customer">,
): Promise<User[]> {
  return repo.listActiveByRole(role);
}

export async function registerCustomer(
  repo: UserRepository,
  input: { name: string; email: string; password: string; preferredLocale: Locale },
): Promise<User> {
  const existing = await repo.findByEmail(input.email);
  if (existing) throw new Error(`User already exists with email: ${input.email}`);
  const passwordHash = await hashPassword(input.password);
  return repo.create({
    name: input.name,
    email: input.email,
    role: "customer",
    pinHash: null,
    passwordHash,
    isActive: true,
    preferredLocale: input.preferredLocale,
  });
}

export async function authenticateUser(
  repo: UserRepository,
  email: string,
  password: string,
): Promise<User | null> {
  const user = await repo.findByEmail(email);
  if (!user || !user.isActive || !user.passwordHash) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  return valid ? user : null;
}

export async function updateUserPreferredLocale(
  repo: UserRepository,
  userId: string,
  locale: Locale,
): Promise<User> {
  return repo.update(userId, { preferredLocale: locale });
}
```

Nota: los 3 tests existentes de `registerCustomer` en `use-cases.test.ts` llaman `registerCustomer(repo, { name, email, password })` sin `preferredLocale` — agregar `preferredLocale: "en"` a esos 3 call sites para que sigan compilando.

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pnpm --filter @workspace/domain run test -- use-cases.test.ts`
Expected: PASS (todos, incluidos los 2 nuevos de `updateUserPreferredLocale`).

- [ ] **Step 5: Actualizar el único consumidor real de `registerCustomer` fuera del dominio**

En `apps/web/src/app/actions/register.ts`, agregar `preferredLocale` al schema, la interfaz y la llamada:

```ts
"use server";

import { z } from "zod";
import { registerCustomer } from "@workspace/domain/users";
import { DrizzleUserRepository } from "@workspace/db/repositories";

const registerSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8),
  preferredLocale: z.enum(["en", "es"]),
});

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  preferredLocale: "en" | "es";
}

export async function registerCustomerAction(input: RegisterInput): Promise<{ error: string } | { ok: true }> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  try {
    await registerCustomer(new DrizzleUserRepository(), parsed.data);
    return { ok: true };
  } catch {
    return { error: "email_taken" };
  }
}
```

Y en `apps/web/src/components/auth/register-form.tsx`, importar `useLocale` de `next-intl` y mandarlo en la llamada:

```tsx
import { useLocale, useTranslations } from "next-intl";
// ...
const locale = useLocale();
// ...
const result = await registerCustomerAction({ name, email, password, preferredLocale: locale as "en" | "es" });
```

(`DrizzleUserRepository.create` todavía no existe con esta forma — se implementa en la Task 4; este paso deja el código de `apps/web` escrito y coherente con el tipo, aunque el build completo de `apps/web` no vaya a estar en verde hasta que la Task 4 esté hecha. `pnpm --filter @workspace/domain run test` sí debe pasar ahora mismo.)

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/users/use-cases.ts packages/domain/src/users/use-cases.test.ts apps/web/src/app/actions/register.ts apps/web/src/components/auth/register-form.tsx
```

Sugerir al owner: `git commit -m "Agrega el caso de uso updateUserPreferredLocale y preferredLocale al registro"`

---

### Task 3: DB — columna `preferred_locale` en `users`

**Files:**
- Modify: `packages/db/src/schema/users.ts`

**Interfaces:**
- Produces: `usersTable.preferredLocale` (columna `preferred_locale`, `text`, `not null`, default `'en'`).

- [ ] **Step 1: Agregar la columna al schema**

En `packages/db/src/schema/users.ts`:

```ts
import { pgEnum, pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "despachador", "delivery", "customer"]);

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").unique(),
  role: userRoleEnum("role").notNull(),
  pinHash: text("pin_hash"),
  passwordHash: text("password_hash"),
  isActive: boolean("is_active").notNull().default(true),
  preferredLocale: text("preferred_locale").notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Aplicar la migración contra la DB real (dev=prod)**

Run: `pnpm --filter @workspace/db run push`
Expected: drizzle-kit detecta la columna nueva `preferred_locale` en `users` y la aplica sin pedir confirmación destructiva (es una columna nueva con default, no hay pérdida de datos). Confirmar el output antes de seguir.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/users.ts
```

Sugerir al owner: `git commit -m "Agrega la columna preferred_locale a la tabla users"`

---

### Task 4: DB — `DrizzleUserRepository.update()` + seed del admin

**Files:**
- Modify: `packages/db/src/repositories/user-repository.ts`
- Test: `packages/db/src/repositories/user-repository.test.ts`
- Modify: `packages/db/src/seed.ts`

**Interfaces:**
- Consumes: `usersTable` de la Task 3, `UserRepository` de la Task 1.
- Produces: `DrizzleUserRepository.update(id, data): Promise<User>`.

- [ ] **Step 1: Ver el test file existente para seguir su patrón exacto**

Leer `packages/db/src/repositories/user-repository.test.ts` antes de escribir el test nuevo, para reusar su forma de crear un usuario de prueba y limpiarlo.

- [ ] **Step 2: Escribir el test que falla para `update`**

Agregar a `packages/db/src/repositories/user-repository.test.ts` (mismo patrón de creación/limpieza que ya usa el archivo, ajustando el prefijo de datos de prueba si hace falta):

```ts
describe("update", () => {
  it("updates the preferred locale and returns the updated user", async () => {
    const repo = new DrizzleUserRepository();
    const created = await repo.create({
      name: "Locale Test User",
      email: `locale-test-${Date.now()}@example.com`,
      role: "customer",
      pinHash: null,
      passwordHash: "irrelevant",
      isActive: true,
      preferredLocale: "en",
    });

    const updated = await repo.update(created.id, { preferredLocale: "es" });

    expect(updated.preferredLocale).toBe("es");
  });
});
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `pnpm --filter @workspace/db run test -- user-repository.test.ts`
Expected: FAIL (`update` no existe en `DrizzleUserRepository`).

- [ ] **Step 4: Implementar `update`**

En `packages/db/src/repositories/user-repository.ts`:

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

  async update(id: string, data: Partial<Pick<User, "preferredLocale">>): Promise<User> {
    const [updated] = await db.update(usersTable).set(data).where(eq(usersTable.id, id)).returning();
    if (!updated) throw new Error(`User not found: ${id}`);
    return updated;
  }
}
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `pnpm --filter @workspace/db run test -- user-repository.test.ts`
Expected: PASS.

- [ ] **Step 6: Sembrar `preferredLocale` en el admin del seed**

En `packages/db/src/seed.ts`, en el bloque de seed del admin (líneas ~96-107), agregar `preferredLocale: "en"` al `insert`/`onConflictDoUpdate`:

```ts
const adminEmail = process.env.ADMIN_SEED_EMAIL;
const adminPassword = process.env.ADMIN_SEED_PASSWORD;
if (adminEmail && adminPassword) {
  const passwordHash = await hashPassword(adminPassword);
  await db
    .insert(usersTable)
    .values({ name: "Admin", email: adminEmail, role: "admin", passwordHash, isActive: true, preferredLocale: "en" })
    .onConflictDoUpdate({ target: usersTable.email, set: { passwordHash, isActive: true } });
  console.log(`Ensured admin user: ${adminEmail}.`);
} else {
  console.log("ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD not set — skipping admin seed.");
}
```

(El `onConflictDoUpdate` no incluye `preferredLocale` en el `set` a propósito — si el admin ya cambió su preferencia desde `/account/settings`, re-correr el seed no debe pisarla; el default `"en"` del `insert` solo aplica la primera vez que se crea la fila.)

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/repositories/user-repository.ts packages/db/src/repositories/user-repository.test.ts packages/db/src/seed.ts
```

Sugerir al owner: `git commit -m "Implementa DrizzleUserRepository.update y siembra preferredLocale del admin"`

---

### Task 5: Auth.js — `preferredLocale` en la sesión

**Files:**
- Modify: `apps/web/src/types/next-auth.d.ts`
- Modify: `apps/web/src/auth.config.ts`
- Modify: `apps/web/src/auth.ts`

**Interfaces:**
- Consumes: `User.preferredLocale` (Task 1), `DrizzleUserRepository` (Task 4).
- Produces: `session.user.preferredLocale: "en" | "es"` disponible en cualquier Server Component/Server Action vía `await auth()`.

- [ ] **Step 1: Extender los tipos de sesión/JWT**

En `apps/web/src/types/next-auth.d.ts`:

```ts
import type { UserRole } from "@workspace/domain/users";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: UserRole;
      preferredLocale: "en" | "es";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    preferredLocale?: "en" | "es";
  }
}
```

- [ ] **Step 2: Poblar `preferredLocale` en el callback `session` (edge-safe, `auth.config.ts`)**

En `apps/web/src/auth.config.ts`, callback `session`:

```ts
session({ session, token }) {
  if (token.sub) session.user.id = token.sub;
  if (token.role) session.user.role = token.role as UserRole;
  if (token.preferredLocale) session.user.preferredLocale = token.preferredLocale as "en" | "es";
  return session;
},
```

- [ ] **Step 3: Poblar `preferredLocale` en el callback `jwt` (Node.js runtime, `auth.ts`), reusando la revalidación por DB ya existente**

En `apps/web/src/auth.ts`, el callback `jwt` ya revalida `role`/`isActive` contra la DB en cada request subsecuente — se agrega `preferredLocale` al mismo lugar, sin request extra:

```ts
async jwt({ token, user }) {
  if (user) {
    token.role = (user as { role: typeof token.role }).role;
    return token;
  }

  if (!token.sub) return null;
  const dbUser = await new DrizzleUserRepository().findById(token.sub);
  if (!dbUser || !dbUser.isActive) return null;
  token.role = dbUser.role;
  token.preferredLocale = dbUser.preferredLocale;
  return token;
},
```

Nota importante para la Task 8: como este callback vuelve a leer `preferredLocale` de la DB en **cada request** (ya es el patrón usado para poder revocar sesiones por `isActive`), no hace falta ningún `SessionProvider`/`useSession().update()` en el cliente para refrescar la preferencia tras guardarla — un simple `router.refresh()` (Server Action + revalidación de ruta) alcanza para que el próximo `auth()` la vea actualizada. Esto simplifica el diseño respecto a la spec (que mencionaba `update()` del hook de sesión como mecanismo) — se documenta esta decisión acá porque es una simplificación real, no un cambio de comportamiento.

- [ ] **Step 4: Verificar tipos**

Run: `pnpm run typecheck`
Expected: PASS para `apps/web` en lo que toca a estos 3 archivos (puede seguir habiendo errores pendientes de tareas futuras si algo de `register.ts`/`checkout.ts` todavía no está resuelto — confirmar que ningún error nuevo viene de estos 3 archivos).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/types/next-auth.d.ts apps/web/src/auth.config.ts apps/web/src/auth.ts
```

Sugerir al owner: `git commit -m "Agrega preferredLocale a la sesion de Auth.js"`

---

### Task 6: `apps/web` — layout compartido de cuenta + página de configuración

**Files:**
- Create: `apps/web/src/app/[locale]/account/layout.tsx`
- Modify: `apps/web/src/app/[locale]/account/orders/page.tsx`
- Create: `apps/web/src/app/[locale]/account/settings/page.tsx`
- Create: `apps/web/src/components/account/account-settings-form.tsx`
- Create: `apps/web/src/app/actions/account-settings.ts`
- Modify: `packages/i18n/src/types.ts`, `packages/i18n/src/dictionaries/en.ts`, `packages/i18n/src/dictionaries/es.ts`

**Interfaces:**
- Consumes: `auth()` (Task 5), `updateUserPreferredLocale` (Task 2), `DrizzleUserRepository` (Task 4).
- Produces: ruta `/account/settings`, Server Action `updatePreferredLocaleAction(locale: "en" | "es"): Promise<{ ok: true } | { error: string }>`.

- [ ] **Step 1: Agregar las claves de i18n nuevas**

En `packages/i18n/src/types.ts`, dentro de `account: { ... }`, agregar:

```ts
    navOrders: string;
    navSettings: string;
    settingsTitle: string;
    settingsLanguageLabel: string;
    settingsLanguageEn: string;
    settingsLanguageEs: string;
    settingsSaveButton: string;
    settingsSaved: string;
```

En `packages/i18n/src/dictionaries/en.ts`, dentro de `account: { ... }`, agregar antes del cierre:

```ts
    navOrders: "My orders",
    navSettings: "Settings",
    settingsTitle: "Account settings",
    settingsLanguageLabel: "Preferred language for emails",
    settingsLanguageEn: "English",
    settingsLanguageEs: "Spanish",
    settingsSaveButton: "Save",
    settingsSaved: "Saved.",
```

En `packages/i18n/src/dictionaries/es.ts`, dentro de `account: { ... }`, agregar antes del cierre:

```ts
    navOrders: "Mis pedidos",
    navSettings: "Configuración",
    settingsTitle: "Configuración de cuenta",
    settingsLanguageLabel: "Idioma preferido para los emails",
    settingsLanguageEn: "Inglés",
    settingsLanguageEs: "Español",
    settingsSaveButton: "Guardar",
    settingsSaved: "Guardado.",
```

- [ ] **Step 2: Correr el test de paridad de claves de `packages/i18n`**

Run: `pnpm --filter @workspace/i18n run test`
Expected: PASS (EN y ES tienen las mismas claves nuevas).

- [ ] **Step 3: Crear el layout compartido de `account/`**

`apps/web/src/app/[locale]/account/layout.tsx`:

```tsx
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { auth } from "@/auth";

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session) {
    return redirect({ href: { pathname: "/login", query: { callbackUrl: "/account/orders" } }, locale });
  }

  const t = await getTranslations("account");

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <nav className="flex gap-4 text-[13px] text-navy/60 mb-8">
        <Link href="/account/orders" className="hover:text-sin-red">{t("navOrders")}</Link>
        <Link href="/account/settings" className="hover:text-sin-red">{t("navSettings")}</Link>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Simplificar `account/orders/page.tsx` — quitar el guard y el wrapper duplicados**

```tsx
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { DrizzleOrderRepository } from "@workspace/db/repositories";

export default async function AccountOrdersPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");

  const session = await auth();
  const orders = await new DrizzleOrderRepository().listByCustomerId(session!.user.id);

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{t("ordersTitle")}</h1>
      {orders.length === 0 ? (
        <p className="text-navy/40 text-sm">{t("noOrders")}</p>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="bg-white rounded-xl p-4 border border-navy/10">
              <p className="text-sm font-medium text-navy">{t("orderTotal")}: ${(order.totalCents / 100).toFixed(2)}</p>
              <p className="text-[13px] text-navy/50">{t("orderStatus")}: {order.fulfillmentStatus}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

(`session!` es seguro acá: el layout padre ya redirige si no hay sesión, así que esta página nunca renderiza sin una. El `<main className="max-w-2xl mx-auto px-6 py-12">` original se quita porque ese contenedor ahora vive en el layout.)

- [ ] **Step 5: Server Action `updatePreferredLocaleAction`**

`apps/web/src/app/actions/account-settings.ts`:

```ts
"use server";

import { z } from "zod";
import { updateUserPreferredLocale } from "@workspace/domain/users";
import { DrizzleUserRepository } from "@workspace/db/repositories";
import { auth } from "@/auth";

const localeSchema = z.enum(["en", "es"]);

export async function updatePreferredLocaleAction(locale: string): Promise<{ ok: true } | { error: string }> {
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) return { error: "invalid_locale" };

  const session = await auth();
  if (!session) return { error: "unauthorized" };

  await updateUserPreferredLocale(new DrizzleUserRepository(), session.user.id, parsed.data);
  return { ok: true };
}
```

- [ ] **Step 6: Página de configuración + formulario**

`apps/web/src/app/[locale]/account/settings/page.tsx`:

```tsx
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { AccountSettingsForm } from "@/components/account/account-settings-form";

export default async function AccountSettingsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");

  const session = await auth();

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{t("settingsTitle")}</h1>
      <AccountSettingsForm currentLocale={session!.user.preferredLocale} />
    </div>
  );
}
```

`apps/web/src/components/account/account-settings-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { updatePreferredLocaleAction } from "@/app/actions/account-settings";

export function AccountSettingsForm({ currentLocale }: { currentLocale: "en" | "es" }) {
  const t = useTranslations("account");
  const router = useRouter();
  const [locale, setLocale] = useState(currentLocale);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    setSaved(false);
    try {
      const result = await updatePreferredLocaleAction(locale);
      if ("ok" in result) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-navy/10 max-w-sm">
      <p className="text-sm font-medium text-navy mb-3">{t("settingsLanguageLabel")}</p>
      <div className="space-y-2 mb-4">
        <label className="flex items-center gap-2 text-sm text-navy">
          <input type="radio" name="locale" value="en" checked={locale === "en"} onChange={() => setLocale("en")} />
          {t("settingsLanguageEn")}
        </label>
        <label className="flex items-center gap-2 text-sm text-navy">
          <input type="radio" name="locale" value="es" checked={locale === "es"} onChange={() => setLocale("es")} />
          {t("settingsLanguageEs")}
        </label>
      </div>
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="bg-sin-red text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
      >
        {t("settingsSaveButton")}
      </button>
      {saved && <p className="text-[13px] text-navy/50 mt-2">{t("settingsSaved")}</p>}
    </div>
  );
}
```

- [ ] **Step 7: Verificar tipos y build**

Run: `pnpm run typecheck && pnpm --filter @workspace/web run build`
Expected: PASS. (El build ejercita `generateStaticParams`/prerender — confirmar que `/account/settings` y `/account/orders` no quedan congeladas incorrectamente; ambas requieren sesión vía `auth()`, que ya vuelve dinámica cualquier ruta que lea cookies, mismo patrón que `/admin/*` desde Fase 4.)

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/[locale]/account apps/web/src/components/account apps/web/src/app/actions/account-settings.ts packages/i18n/src/types.ts packages/i18n/src/dictionaries/en.ts packages/i18n/src/dictionaries/es.ts
```

Sugerir al owner: `git commit -m "Agrega el layout compartido de cuenta y la pagina de configuracion de idioma"`

---

### Task 7: Dominio — `EmailLog` y `EmailLogRepository`, `NotificationPort` con locale

**Files:**
- Create: `packages/domain/src/notifications/entities.ts`
- Modify: `packages/domain/src/notifications/ports.ts`
- Modify: `packages/domain/src/notifications/index.ts`

**Interfaces:**
- Consumes: `Locale` de `@workspace/domain/shared`.
- Produces: `EmailLog`, `EmailLogType`, `EmailLogStatus`, `EmailLogRepository { create, listAll }`, `NotificationPort` con `locale: Locale` en cada método.

- [ ] **Step 1: Crear las entidades**

`packages/domain/src/notifications/entities.ts`:

```ts
import type { Locale } from "../shared";

export type EmailLogType = "order_confirmation" | "event_quote_receipt";
export type EmailLogStatus = "sent" | "failed" | "blocked";

export interface EmailLog {
  id: string;
  to: string;
  type: EmailLogType;
  locale: Locale;
  status: EmailLogStatus;
  errorMessage: string | null;
  createdAt: Date;
}
```

- [ ] **Step 2: Extender `ports.ts`**

```ts
import type { Locale } from "../shared";
import type { EmailLog } from "./entities";

export interface NotificationPort {
  sendOrderConfirmation(order: { customerEmail: string; totalCents: number; id: string }, locale: Locale): Promise<void>;
  sendEventQuoteRequestReceipt(booking: { clientEmail: string; id: string }, locale: Locale): Promise<void>;
}

export interface EmailLogRepository {
  create(entry: Omit<EmailLog, "id" | "createdAt">): Promise<EmailLog>;
  listAll(): Promise<EmailLog[]>;
}
```

- [ ] **Step 3: Exportar las entidades desde `index.ts`**

`packages/domain/src/notifications/index.ts`:

```ts
export * from "./entities";
export * from "./ports";
```

- [ ] **Step 4: Verificar que el dominio sigue compilando**

Run: `pnpm run typecheck:libs`
Expected: PASS. (Este cambio de firma de `NotificationPort` no tiene todavía ningún implementador en el repo — `packages/notifications/src/index.ts` solo exporta `{}` — así que no rompe nada existente.)

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/notifications
```

Sugerir al owner: `git commit -m "Agrega EmailLog y locale al puerto de notificaciones"`

---

### Task 8: DB — tabla `email_logs` + `DrizzleEmailLogRepository`

**Files:**
- Create: `packages/db/src/schema/email-logs.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/src/repositories/email-log-repository.ts`
- Test: `packages/db/src/repositories/email-log-repository.test.ts`
- Modify: `packages/db/src/repositories/index.ts`

**Interfaces:**
- Consumes: `EmailLog`, `EmailLogRepository` (Task 7).
- Produces: `DrizzleEmailLogRepository implements EmailLogRepository`.

- [ ] **Step 1: Schema**

`packages/db/src/schema/email-logs.ts`:

```ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const emailLogsTable = pgTable("email_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  to: text("to").notNull(),
  type: text("type").notNull(),
  locale: text("locale").notNull(),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

En `packages/db/src/schema/index.ts`, agregar:

```ts
export * from "./email-logs";
```

- [ ] **Step 2: Aplicar la migración**

Run: `pnpm --filter @workspace/db run push`
Expected: drizzle-kit crea la tabla `email_logs` nueva.

- [ ] **Step 3: Escribir el test que falla**

`packages/db/src/repositories/email-log-repository.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DrizzleEmailLogRepository } from "./email-log-repository";

describe("DrizzleEmailLogRepository", () => {
  it("creates an entry and lists it back", async () => {
    const repo = new DrizzleEmailLogRepository();
    const created = await repo.create({
      to: `email-log-test-${Date.now()}@example.com`,
      type: "order_confirmation",
      locale: "en",
      status: "sent",
      errorMessage: null,
    });

    expect(created.id).toBeTruthy();
    expect(created.status).toBe("sent");

    const all = await repo.listAll();
    expect(all.some((entry) => entry.id === created.id)).toBe(true);
  });

  it("stores a blocked entry with its error message", async () => {
    const repo = new DrizzleEmailLogRepository();
    const created = await repo.create({
      to: `email-log-test-${Date.now()}@example.com`,
      type: "event_quote_receipt",
      locale: "es",
      status: "blocked",
      errorMessage: "SMTP is not configured yet",
    });

    expect(created.status).toBe("blocked");
    expect(created.errorMessage).toBe("SMTP is not configured yet");
  });
});
```

- [ ] **Step 4: Correr el test para verificar que falla**

Run: `pnpm --filter @workspace/db run test -- email-log-repository.test.ts`
Expected: FAIL (el módulo `./email-log-repository` no existe).

- [ ] **Step 5: Implementar el repositorio**

`packages/db/src/repositories/email-log-repository.ts`:

```ts
import type { EmailLog, EmailLogRepository } from "@workspace/domain/notifications";
import { db } from "../index";
import { emailLogsTable } from "../schema";

export class DrizzleEmailLogRepository implements EmailLogRepository {
  async create(entry: Omit<EmailLog, "id" | "createdAt">): Promise<EmailLog> {
    const [inserted] = await db.insert(emailLogsTable).values(entry).returning();
    return inserted as EmailLog;
  }

  async listAll(): Promise<EmailLog[]> {
    return (await db.select().from(emailLogsTable)) as EmailLog[];
  }
}
```

(`as EmailLog` es necesario porque `type`/`locale`/`status` son `text` sin restricción a nivel de columna en Drizzle — igual patrón sería innecesario con `pgEnum`, pero no se usa acá porque estos 3 valores no necesitan la rigidez de un enum de Postgres para este volumen de datos; la restricción real vive en el tipo de TypeScript del dominio.)

En `packages/db/src/repositories/index.ts`, agregar:

```ts
export * from "./email-log-repository";
```

- [ ] **Step 6: Correr el test para verificar que pasa**

Run: `pnpm --filter @workspace/db run test -- email-log-repository.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/email-logs.ts packages/db/src/schema/index.ts packages/db/src/repositories/email-log-repository.ts packages/db/src/repositories/email-log-repository.test.ts packages/db/src/repositories/index.ts
```

Sugerir al owner: `git commit -m "Agrega la tabla email_logs y su repositorio"`

---

### Task 9: `packages/notifications` — setup del paquete + `SmtpNotConfiguredError`

**Files:**
- Modify: `packages/notifications/package.json`
- Create: `packages/notifications/vitest.config.ts`
- Create: `packages/notifications/src/smtp/errors.ts`
- Test: `packages/notifications/src/smtp/errors.test.ts`

**Interfaces:**
- Produces: `SmtpNotConfiguredError extends Error`.

- [ ] **Step 1: Agregar dependencias y script de test**

`packages/notifications/package.json`:

```json
{
  "name": "@workspace/notifications",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@workspace/domain": "workspace:*",
    "nodemailer": "^6.9.16"
  },
  "devDependencies": {
    "@types/nodemailer": "^6.4.17",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 2: `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 3: Instalar dependencias**

Run: `pnpm install`
Expected: instala `nodemailer`/`@types/nodemailer` en `packages/notifications`, sin tocar `pnpm-workspace.yaml` (ninguno de los dos necesita build nativo).

- [ ] **Step 4: Escribir el test que falla para el error dedicado**

`packages/notifications/src/smtp/errors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SmtpNotConfiguredError } from "./errors";

describe("SmtpNotConfiguredError", () => {
  it("is an Error with an explicit message", () => {
    const error = new SmtpNotConfiguredError();
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("SMTP is not configured yet");
  });
});
```

- [ ] **Step 5: Correr el test para verificar que falla**

Run: `pnpm --filter @workspace/notifications run test`
Expected: FAIL (el módulo `./errors` no existe).

- [ ] **Step 6: Implementar**

`packages/notifications/src/smtp/errors.ts`:

```ts
export class SmtpNotConfiguredError extends Error {
  constructor() {
    super("SMTP is not configured yet");
    this.name = "SmtpNotConfiguredError";
  }
}
```

- [ ] **Step 7: Correr el test para verificar que pasa**

Run: `pnpm --filter @workspace/notifications run test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/notifications/package.json packages/notifications/vitest.config.ts packages/notifications/src/smtp/errors.ts packages/notifications/src/smtp/errors.test.ts pnpm-lock.yaml
```

Sugerir al owner: `git commit -m "Agrega nodemailer y el error dedicado de SMTP sin configurar"`

---

### Task 10: `packages/notifications` — plantillas EN/ES

**Files:**
- Create: `packages/notifications/src/smtp/templates.ts`
- Test: `packages/notifications/src/smtp/templates.test.ts`

**Interfaces:**
- Consumes: `Locale` de `@workspace/domain/shared`.
- Produces: `renderOrderConfirmation(order: { id: string; totalCents: number }, locale: Locale): { subject: string; text: string }`, `renderEventQuoteReceipt(booking: { id: string }, locale: Locale): { subject: string; text: string }`.

- [ ] **Step 1: Escribir el test que falla**

`packages/notifications/src/smtp/templates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderOrderConfirmation, renderEventQuoteReceipt } from "./templates";

describe("renderOrderConfirmation", () => {
  it("renders in English", () => {
    const { subject, text } = renderOrderConfirmation({ id: "order-123", totalCents: 2500 }, "en");
    expect(subject).toContain("Sweet Sin");
    expect(text).toContain("order-123");
    expect(text).toContain("$25.00");
  });

  it("renders in Spanish", () => {
    const { subject, text } = renderOrderConfirmation({ id: "order-123", totalCents: 2500 }, "es");
    expect(subject).toContain("Sweet Sin");
    expect(text).toContain("order-123");
    expect(text).toContain("$25.00");
  });
});

describe("renderEventQuoteReceipt", () => {
  it("renders in English", () => {
    const { subject, text } = renderEventQuoteReceipt({ id: "booking-123" }, "en");
    expect(subject).toContain("Sweet Sin");
    expect(text).toContain("booking-123");
  });

  it("renders in Spanish", () => {
    const { subject, text } = renderEventQuoteReceipt({ id: "booking-123" }, "es");
    expect(subject).toContain("Sweet Sin");
    expect(text).toContain("booking-123");
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm --filter @workspace/notifications run test -- templates.test.ts`
Expected: FAIL (el módulo `./templates` no existe).

- [ ] **Step 3: Implementar**

`packages/notifications/src/smtp/templates.ts`:

```ts
import type { Locale } from "@workspace/domain/shared";

interface EmailContent {
  subject: string;
  text: string;
}

export function renderOrderConfirmation(
  order: { id: string; totalCents: number },
  locale: Locale,
): EmailContent {
  const total = `$${(order.totalCents / 100).toFixed(2)}`;

  if (locale === "es") {
    return {
      subject: "Sweet Sin — Confirmación de tu pedido",
      text: `¡Gracias por tu pedido!\n\nPedido: ${order.id}\nTotal: ${total}\n\nTe vemos pronto.\nSweet Sin`,
    };
  }

  return {
    subject: "Sweet Sin — Order confirmation",
    text: `Thanks for your order!\n\nOrder: ${order.id}\nTotal: ${total}\n\nSee you soon.\nSweet Sin`,
  };
}

export function renderEventQuoteReceipt(booking: { id: string }, locale: Locale): EmailContent {
  if (locale === "es") {
    return {
      subject: "Sweet Sin — Recibimos tu solicitud de cotización",
      text: `Recibimos tu solicitud de cotización para tu evento.\n\nSolicitud: ${booking.id}\n\nTe contactaremos pronto con los detalles.\nSweet Sin`,
    };
  }

  return {
    subject: "Sweet Sin — We received your event quote request",
    text: `We received your event quote request.\n\nRequest: ${booking.id}\n\nWe'll be in touch soon with the details.\nSweet Sin`,
  };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pnpm --filter @workspace/notifications run test -- templates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/notifications/src/smtp/templates.ts packages/notifications/src/smtp/templates.test.ts
```

Sugerir al owner: `git commit -m "Agrega las plantillas EN/ES de los emails de notificacion"`

---

### Task 11: `packages/notifications` — `SmtpNotificationAdapter`

**Files:**
- Create: `packages/notifications/src/smtp/smtp-notification-adapter.ts`
- Test: `packages/notifications/src/smtp/smtp-notification-adapter.test.ts`
- Modify: `packages/notifications/src/index.ts`

**Interfaces:**
- Consumes: `NotificationPort` (Task 7), `SmtpNotConfiguredError` (Task 9), `renderOrderConfirmation`/`renderEventQuoteReceipt` (Task 10), `nodemailer`.
- Produces: `SmtpNotificationAdapter implements NotificationPort`.

- [ ] **Step 1: Escribir el test que falla**

`packages/notifications/src/smtp/smtp-notification-adapter.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SmtpNotificationAdapter } from "./smtp-notification-adapter";
import { SmtpNotConfiguredError } from "./errors";

const ENV_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"] as const;

describe("SmtpNotificationAdapter", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it("throws SmtpNotConfiguredError when SMTP env vars are missing", async () => {
    const adapter = new SmtpNotificationAdapter();

    await expect(
      adapter.sendOrderConfirmation({ customerEmail: "a@example.com", totalCents: 1000, id: "order-1" }, "en"),
    ).rejects.toThrow(SmtpNotConfiguredError);
  });

  it("does not throw at construction time even without env vars", () => {
    expect(() => new SmtpNotificationAdapter()).not.toThrow();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm --filter @workspace/notifications run test -- smtp-notification-adapter.test.ts`
Expected: FAIL (el módulo no existe).

- [ ] **Step 3: Implementar el adaptador**

`packages/notifications/src/smtp/smtp-notification-adapter.ts`:

```ts
import nodemailer from "nodemailer";
import type { NotificationPort } from "@workspace/domain/notifications";
import type { Locale } from "@workspace/domain/shared";
import { SmtpNotConfiguredError } from "./errors";
import { renderOrderConfirmation, renderEventQuoteReceipt } from "./templates";

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

function readConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;

  if (!host || !port || !user || !password || !from) {
    throw new SmtpNotConfiguredError();
  }

  return { host, port: Number(port), user, password, from };
}

export class SmtpNotificationAdapter implements NotificationPort {
  async sendOrderConfirmation(
    order: { customerEmail: string; totalCents: number; id: string },
    locale: Locale,
  ): Promise<void> {
    const config = readConfig();
    const { subject, text } = renderOrderConfirmation(order, locale);
    await this.send(config, order.customerEmail, subject, text);
  }

  async sendEventQuoteRequestReceipt(booking: { clientEmail: string; id: string }, locale: Locale): Promise<void> {
    const config = readConfig();
    const { subject, text } = renderEventQuoteReceipt(booking, locale);
    await this.send(config, booking.clientEmail, subject, text);
  }

  private async send(config: SmtpConfig, to: string, subject: string, text: string): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      auth: { user: config.user, pass: config.password },
    });
    await transporter.sendMail({ from: config.from, to, subject, text });
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pnpm --filter @workspace/notifications run test -- smtp-notification-adapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Exportar desde el índice del paquete**

`packages/notifications/src/index.ts`:

```ts
export * from "./smtp/smtp-notification-adapter";
export * from "./smtp/errors";
```

- [ ] **Step 6: Correr toda la suite del paquete**

Run: `pnpm --filter @workspace/notifications run test`
Expected: PASS (todos los tests del paquete: errors, templates, adapter).

- [ ] **Step 7: Commit**

```bash
git add packages/notifications/src/smtp/smtp-notification-adapter.ts packages/notifications/src/smtp/smtp-notification-adapter.test.ts packages/notifications/src/index.ts
```

Sugerir al owner: `git commit -m "Implementa SmtpNotificationAdapter con validacion lazy de credenciales"`

---

### Task 12: `packages/notifications` — scaffold de `ExpoNotificationAdapter`

**Files:**
- Create: `packages/notifications/src/expo/expo-notification-adapter.ts`
- Test: `packages/notifications/src/expo/expo-notification-adapter.test.ts`
- Modify: `packages/notifications/src/index.ts`

**Interfaces:**
- Consumes: `NotificationPort` (Task 7).
- Produces: `ExpoNotificationAdapter implements NotificationPort` (sin uso real en esta fase).

- [ ] **Step 1: Escribir el test que falla**

`packages/notifications/src/expo/expo-notification-adapter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ExpoNotificationAdapter } from "./expo-notification-adapter";

describe("ExpoNotificationAdapter", () => {
  it("is not implemented until Phase 7", async () => {
    const adapter = new ExpoNotificationAdapter();
    await expect(
      adapter.sendOrderConfirmation({ customerEmail: "a@example.com", totalCents: 1000, id: "order-1" }, "en"),
    ).rejects.toThrow("Not implemented until Phase 7");
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm --filter @workspace/notifications run test -- expo-notification-adapter.test.ts`
Expected: FAIL (el módulo no existe).

- [ ] **Step 3: Implementar el scaffold**

`packages/notifications/src/expo/expo-notification-adapter.ts`:

```ts
import type { NotificationPort } from "@workspace/domain/notifications";

// Scaffold sin consumidor real — Fase 7 registra tokens de dispositivo y
// conecta esta clase. Cada método lanza a propósito para no simular un
// envío que todavía no puede pasar.
export class ExpoNotificationAdapter implements NotificationPort {
  async sendOrderConfirmation(): Promise<void> {
    throw new Error("Not implemented until Phase 7");
  }

  async sendEventQuoteRequestReceipt(): Promise<void> {
    throw new Error("Not implemented until Phase 7");
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pnpm --filter @workspace/notifications run test -- expo-notification-adapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Exportar desde el índice**

`packages/notifications/src/index.ts`, agregar:

```ts
export * from "./expo/expo-notification-adapter";
```

- [ ] **Step 6: Commit**

```bash
git add packages/notifications/src/expo packages/notifications/src/index.ts
```

Sugerir al owner: `git commit -m "Agrega el scaffold de ExpoNotificationAdapter sin consumidor real"`

---

### Task 13: Wiring — `placeOrderAction` (checkout)

**Files:**
- Modify: `apps/web/src/app/actions/checkout.ts`
- Modify: `apps/web/src/components/cart/checkout-modal.tsx`

**Interfaces:**
- Consumes: `auth()` (Task 5), `SmtpNotificationAdapter` (Task 11), `DrizzleEmailLogRepository` (Task 8), `SmtpNotConfiguredError` (Task 9).
- Produces: `PlaceOrderInput.locale: "en" | "es"` (nuevo campo requerido).

- [ ] **Step 1: Agregar `locale` a `PlaceOrderInput` y resolver el idioma final**

En `apps/web/src/app/actions/checkout.ts`:

```ts
"use server";

import { z } from "zod";
import { createOrder } from "@workspace/domain/orders";
import { DrizzleOrderRepository, DrizzleProductRepository, DrizzleSettingsRepository, DrizzleEmailLogRepository } from "@workspace/db/repositories";
import { SmtpNotificationAdapter, SmtpNotConfiguredError } from "@workspace/notifications";
import { auth } from "@/auth";

const checkoutSchema = z.object({
  fulfillmentType: z.enum(["pickup", "self_delivery"]),
  deliveryAddress: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.string().trim().email(),
  channel: z.enum(["web", "whatsapp"]),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1) })).min(1),
  locale: z.enum(["en", "es"]),
});

export interface PlaceOrderInput {
  fulfillmentType: "pickup" | "self_delivery";
  deliveryAddress?: string;
  name: string;
  phone: string;
  email: string;
  channel: "web" | "whatsapp";
  items: { productId: string; quantity: number }[];
  locale: "en" | "es";
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

  await notifyOrderConfirmation(order, parsed.locale);

  return { orderId: order.id, totalCents: order.totalCents };
}

async function notifyOrderConfirmation(
  order: { id: string; customerEmail: string; totalCents: number },
  pageLocale: "en" | "es",
): Promise<void> {
  const session = await auth();
  const locale = session?.user.preferredLocale ?? pageLocale;
  const emailLogs = new DrizzleEmailLogRepository();

  try {
    await new SmtpNotificationAdapter().sendOrderConfirmation(order, locale);
    await emailLogs.create({ to: order.customerEmail, type: "order_confirmation", locale, status: "sent", errorMessage: null });
  } catch (err) {
    await emailLogs.create({
      to: order.customerEmail,
      type: "order_confirmation",
      locale,
      status: err instanceof SmtpNotConfiguredError ? "blocked" : "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}
```

- [ ] **Step 2: Mandar `locale` desde `CheckoutModal`**

En `apps/web/src/components/cart/checkout-modal.tsx`, importar `useLocale`:

```tsx
import { useLocale, useTranslations } from "next-intl";
```

Dentro del componente, junto a `const t = useTranslations("cart");`:

```tsx
const locale = useLocale() as "en" | "es";
```

Y agregar `locale` a las dos llamadas a `placeOrderAction` (en `payWithWhatsApp` y en `startCardPayment`):

```tsx
const result = await placeOrderAction({
  fulfillmentType: fulfillment ?? "pickup",
  deliveryAddress,
  name: contact.name,
  phone: contact.phone,
  email: contact.email,
  channel: "whatsapp", // o "web" en startCardPayment
  items: orderItems,
  locale,
});
```

- [ ] **Step 3: Verificar tipos y build**

Run: `pnpm run typecheck && pnpm --filter @workspace/web run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/actions/checkout.ts apps/web/src/components/cart/checkout-modal.tsx
```

Sugerir al owner: `git commit -m "Conecta la confirmacion de orden por email con locale y log de envio"`

---

### Task 14: Wiring — `requestEventQuoteAction`

**Files:**
- Modify: `apps/web/src/app/actions/event-bookings.ts`
- Modify: `apps/web/src/components/sections/events.tsx`

**Interfaces:**
- Consumes: `requestEventQuote` (ya devuelve `Promise<EventBooking>`, sin cambios de firma necesarios), `auth()`, `SmtpNotificationAdapter`, `DrizzleEmailLogRepository`, `SmtpNotConfiguredError`.

- [ ] **Step 1: Capturar el `booking` devuelto y agregar `locale` al schema**

En `apps/web/src/app/actions/event-bookings.ts`:

```ts
"use server";

import { z } from "zod";
import { requestEventQuote } from "@workspace/domain/event-bookings";
import { DrizzleEventBookingRepository, DrizzleEmailLogRepository } from "@workspace/db/repositories";
import { SmtpNotificationAdapter, SmtpNotConfiguredError } from "@workspace/notifications";
import { auth } from "@/auth";

const eventQuoteSchema = z.object({
  name: z.string().trim().min(1),
  company: z.string().trim().optional(),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1),
  type: z.enum(["corporate", "wedding", "festival", "other"]),
  date: z.string().trim().min(1),
  guests: z.coerce.number().int().min(20),
  message: z.string().trim().min(1),
  locale: z.enum(["en", "es"]),
});

export interface EventQuoteFormState {
  status: "idle" | "success" | "error";
}

export async function requestEventQuoteAction(
  _prevState: EventQuoteFormState,
  formData: FormData,
): Promise<EventQuoteFormState> {
  const parsed = eventQuoteSchema.safeParse({
    name: formData.get("name"),
    company: formData.get("company") || undefined,
    email: formData.get("email"),
    phone: formData.get("phone"),
    type: formData.get("type"),
    date: formData.get("date"),
    guests: formData.get("guests"),
    message: formData.get("message"),
    locale: formData.get("locale"),
  });

  if (!parsed.success) {
    return { status: "error" };
  }

  const eventDate = new Date(`${parsed.data.date}T00:00:00`);
  if (Number.isNaN(eventDate.getTime())) {
    return { status: "error" };
  }

  const endOfDay = new Date(`${parsed.data.date}T23:59:59`);

  try {
    const booking = await requestEventQuote(new DrizzleEventBookingRepository(), {
      clientName: parsed.data.name,
      clientCompany: parsed.data.company ?? null,
      clientEmail: parsed.data.email,
      clientPhone: parsed.data.phone,
      eventType: parsed.data.type,
      eventDate,
      startTime: eventDate,
      endTime: endOfDay,
      location: "TBD",
      estimatedGuests: parsed.data.guests,
      notes: parsed.data.message,
    });

    await notifyEventQuoteReceipt(booking, parsed.data.locale);

    return { status: "success" };
  } catch {
    return { status: "error" };
  }
}

async function notifyEventQuoteReceipt(
  booking: { id: string; clientEmail: string },
  pageLocale: "en" | "es",
): Promise<void> {
  const session = await auth();
  const locale = session?.user.preferredLocale ?? pageLocale;
  const emailLogs = new DrizzleEmailLogRepository();

  try {
    await new SmtpNotificationAdapter().sendEventQuoteRequestReceipt(booking, locale);
    await emailLogs.create({ to: booking.clientEmail, type: "event_quote_receipt", locale, status: "sent", errorMessage: null });
  } catch (err) {
    await emailLogs.create({
      to: booking.clientEmail,
      type: "event_quote_receipt",
      locale,
      status: err instanceof SmtpNotConfiguredError ? "blocked" : "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}
```

(Nota: la spec original decía que `requestEventQuote` no devolvía el booking creado — al leer el código real de `packages/domain/src/event-bookings/use-cases.ts` se confirmó que **sí** lo devuelve, `Promise<EventBooking>`, desde Fase 5. No hace falta ningún cambio de firma en el dominio para esta tarea, solo capturar el valor de retorno que la Server Action venía ignorando.)

- [ ] **Step 2: Mandar `locale` como campo oculto desde `events.tsx`**

En `apps/web/src/components/sections/events.tsx`, importar `useLocale`:

```tsx
import { useLocale, useTranslations } from "next-intl";
```

Dentro de `Events()`, junto a `const t = useTranslations("events");`:

```tsx
const locale = useLocale();
```

Dentro del `<form action={formAction} className="space-y-4">`, agregar como primer hijo:

```tsx
<input type="hidden" name="locale" value={locale} />
```

- [ ] **Step 3: Verificar tipos y build**

Run: `pnpm run typecheck && pnpm --filter @workspace/web run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/actions/event-bookings.ts apps/web/src/components/sections/events.tsx
```

Sugerir al owner: `git commit -m "Conecta el recibo de cotizacion de evento por email con locale y log de envio"`

---

### Task 15: Panel admin — `/admin/email-logs`

**Files:**
- Create: `apps/web/src/app/actions/admin-email-logs.ts`
- Create: `apps/web/src/app/[locale]/admin/email-logs/page.tsx`
- Modify: `apps/web/src/app/[locale]/admin/layout.tsx`
- Modify: `packages/i18n/src/types.ts`, `packages/i18n/src/dictionaries/en.ts`, `packages/i18n/src/dictionaries/es.ts`

**Interfaces:**
- Consumes: `requireAdmin()`, `DrizzleEmailLogRepository.listAll()` (Task 8).
- Produces: ruta `/admin/email-logs`, `listEmailLogsAction(): Promise<EmailLog[]>`.

- [ ] **Step 1: Agregar las claves de i18n**

En `packages/i18n/src/types.ts`, dentro de `admin: { ... }`, agregar:

```ts
    navEmailLogs: string;
    emailLogsTitle: string;
    emailLogsColumnTo: string;
    emailLogsColumnType: string;
    emailLogsColumnLocale: string;
    emailLogsColumnStatus: string;
    emailLogsColumnDate: string;
    emailLogsEmpty: string;
```

En `packages/i18n/src/dictionaries/en.ts`, dentro de `admin: { ... }`:

```ts
    navEmailLogs: "Email logs",
    emailLogsTitle: "Email logs",
    emailLogsColumnTo: "To",
    emailLogsColumnType: "Type",
    emailLogsColumnLocale: "Locale",
    emailLogsColumnStatus: "Status",
    emailLogsColumnDate: "Date",
    emailLogsEmpty: "No emails logged yet.",
```

En `packages/i18n/src/dictionaries/es.ts`, dentro de `admin: { ... }`:

```ts
    navEmailLogs: "Logs de emails",
    emailLogsTitle: "Logs de emails",
    emailLogsColumnTo: "Destinatario",
    emailLogsColumnType: "Tipo",
    emailLogsColumnLocale: "Idioma",
    emailLogsColumnStatus: "Estado",
    emailLogsColumnDate: "Fecha",
    emailLogsEmpty: "Todavía no hay emails registrados.",
```

- [ ] **Step 2: Correr el test de paridad de `packages/i18n`**

Run: `pnpm --filter @workspace/i18n run test`
Expected: PASS.

- [ ] **Step 3: Server Action**

`apps/web/src/app/actions/admin-email-logs.ts`:

```ts
"use server";

import type { EmailLog } from "@workspace/domain/notifications";
import { DrizzleEmailLogRepository } from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";

export async function listEmailLogsAction(): Promise<EmailLog[]> {
  await requireAdmin();
  return new DrizzleEmailLogRepository().listAll();
}
```

- [ ] **Step 4: Página del listado**

`apps/web/src/app/[locale]/admin/email-logs/page.tsx`:

```tsx
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listEmailLogsAction } from "@/app/actions/admin-email-logs";

export default async function AdminEmailLogsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const logs = await listEmailLogsAction();

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{t("emailLogsTitle")}</h1>
      {logs.length === 0 ? (
        <p className="text-navy/40 text-sm">{t("emailLogsEmpty")}</p>
      ) : (
        <table className="w-full text-sm bg-white rounded-xl overflow-hidden">
          <thead className="bg-navy/5 text-left">
            <tr>
              <th className="px-4 py-3">{t("emailLogsColumnTo")}</th>
              <th className="px-4 py-3">{t("emailLogsColumnType")}</th>
              <th className="px-4 py-3">{t("emailLogsColumnLocale")}</th>
              <th className="px-4 py-3">{t("emailLogsColumnStatus")}</th>
              <th className="px-4 py-3">{t("emailLogsColumnDate")}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-navy/5">
                <td className="px-4 py-3">{log.to}</td>
                <td className="px-4 py-3">{log.type}</td>
                <td className="px-4 py-3">{log.locale}</td>
                <td className="px-4 py-3">{log.status}</td>
                <td className="px-4 py-3">{log.createdAt.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Agregar el link al nav del admin**

En `apps/web/src/app/[locale]/admin/layout.tsx`, dentro del `<nav>`, después del link de `navCalendar`:

```tsx
<Link href="/admin/email-logs" className="hover:text-sin-red">{t("navEmailLogs")}</Link>
```

- [ ] **Step 6: Verificar tipos y build**

Run: `pnpm run typecheck && pnpm --filter @workspace/web run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/actions/admin-email-logs.ts apps/web/src/app/[locale]/admin/email-logs apps/web/src/app/[locale]/admin/layout.tsx packages/i18n/src/types.ts packages/i18n/src/dictionaries/en.ts packages/i18n/src/dictionaries/es.ts
```

Sugerir al owner: `git commit -m "Agrega la pagina de logs de emails al panel admin"`

---

### Task 16: Documentación y verificación final

**Files:**
- Modify: `CLAUDE.md`
- Modify: `apps/web/.env.local` (gitignored, no se commitea — solo se documenta la variable en `CLAUDE.md`)

**Interfaces:** (ninguna — tarea de documentación y verificación end-to-end)

- [ ] **Step 1: Actualizar `CLAUDE.md`**

En la sección **Run & Operate**, agregar una línea junto a las de Stripe:

```
- Variables de SMTP pendientes de credenciales reales: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (`apps/web/.env.local`) — sin ellas, el checkout y la cotización de evento funcionan igual; cada intento de envío queda registrado en `email_logs` con `status: "blocked"`, nunca simula un envío exitoso.
```

En **Where things live**, actualizar la línea de `packages/notifications`:

```
- `packages/notifications` — adaptadores de notificaciones 100% nativos: `SmtpNotificationAdapter` (nodemailer, EN/ES, validación lazy de credenciales) implementado en Fase 6; `ExpoNotificationAdapter` sigue como scaffold sin consumidor real hasta Fase 7.
```

En **Architecture decisions**, agregar una entrada nueva:

```
- **Notificaciones e idioma (Fase 6):** `User.preferredLocale` persiste la preferencia de idioma del cliente, editable en `/account/settings`; se resuelve así en cada envío: sesión activa → `preferredLocale` guardado, invitado → locale de la página en el momento del envío (nunca se asocia el pedido a `customerId` por esto, esa decisión sigue congelada desde Fase 3/4). Cada intento de envío (éxito, fallo real, o bloqueo por falta de credenciales SMTP) se registra en `email_logs`, visible en `/admin/email-logs` — un fallo de notificación nunca bloquea la persistencia de la orden/cotización. El refresco de `preferredLocale` en la sesión no necesita `SessionProvider`/`useSession().update()` en el cliente: el callback `jwt` de Auth.js ya revalida `role`/`isActive` contra la DB en cada request (patrón de revocación de Fase 4), así que agregar `preferredLocale` a esa misma revalidación alcanza con un `router.refresh()` tras guardar.
```

En **Product**, actualizar la frase sobre notificaciones si existiera alguna que las mencione como pendientes (verificar el texto actual antes de editar — si no las menciona, no hace falta tocar esta sección).

- [ ] **Step 2: Verificación automatizada completa**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: PASS en los tres — típecheck completo del monorepo, toda la suite de Vitest (`domain`, `db`, `i18n`, `notifications` nuevo), y build completo de `apps/web`.

- [ ] **Step 3: Confirmar que ninguna ruta nueva quedó congelada**

Run: revisar `apps/web/.next/prerender-manifest.json` tras el build.
Expected: `/account/settings`, `/account/orders` y `/admin/email-logs` no aparecen en `routes` (estático) — todas dependen de `auth()`, que ya vuelve dinámica cualquier ruta que lea cookies, mismo patrón verificado en Fase 4/5.

- [ ] **Step 4: Smoke test manual (delegado al owner, igual que fases anteriores)**

Documentar en el chat, para que el owner lo corra contra `pnpm --filter @workspace/web run dev` o contra producción tras el deploy:
1. Sin `SMTP_*` configuradas: hacer un checkout de invitado en `/es` → confirmar que la orden se crea igual, y que aparece una fila en `/admin/email-logs` con `status: blocked`, `locale: es`.
2. Loguearse como cliente, ir a `/account/settings`, cambiar a español, guardar, y hacer un checkout estando en `/` (inglés) → confirmar que la fila en `/admin/email-logs` de esa orden queda con `locale: es` (la preferencia guardada gana sobre el locale de la página).
3. Pedir una cotización de evento en `/` → confirmar fila en `/admin/email-logs` con `type: event_quote_receipt`, `locale: en`.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
```

Sugerir al owner: `git commit -m "Documenta la Fase 6 en CLAUDE.md"`

---

## Self-Review (completado antes de entregar el plan)

- **Cobertura de la spec:** las 9 secciones de la spec (preferencia de idioma, DB, sesión, layout de cuenta, log de emails, DB de logs, panel admin, adaptadores, resolución de locale) tienen cada una al menos una tarea (Tasks 1-2, 3-4, 5, 6, 7, 8, 15, 9-12, 13-14 respectivamente). Testing y criterios de aceptación están cubiertos por los pasos de test de cada tarea + la Task 16.
- **Placeholders:** ninguno — cada paso de código trae el código completo, cada test trae sus assertions reales.
- **Consistencia de tipos:** `Locale` se define una sola vez (`packages/domain/src/shared/types.ts`) y se reusa en `users`, `notifications`, `packages/notifications`, y como `"en" | "es"` explícito en los tipos de `apps/web` que no importan del dominio (Server Actions con Zod). `EmailLog`/`EmailLogRepository`/`NotificationPort` mantienen los mismos nombres de campos (`to`, `type`, `locale`, `status`, `errorMessage`) en dominio, DB y wiring. Corrección real encontrada durante la escritura del plan: la spec decía que `requestEventQuote` no devolvía el `booking` creado — se verificó contra el código real (`packages/domain/src/event-bookings/use-cases.ts`) y sí lo devuelve desde Fase 5; la Task 14 no toca el dominio, solo corrige que la Server Action ignoraba ese retorno.

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-09-18-fase-6-notificaciones-nativas.md`. Dos opciones de ejecución:

**1. Subagent-Driven (recomendado)** - despacho un subagente fresco por tarea, con revisión entre tareas, iteración rápida.

**2. Inline Execution** - ejecuto las tareas en esta misma sesión con `executing-plans`, en lotes con checkpoints para revisión.

¿Cuál preferís?
