# Fase 4 — Autenticación y Panel Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auth.js (Credentials + JWT) para `admin` y `customer`, panel admin completo sobre el dominio de órdenes (tabla con filtros/búsqueda/ordenamiento, detalle, cambio de `fulfillment_status`/`payment_status`), y para `customer`: login, historial de pedidos, y merge automático del carrito de invitado (`mergeGuestCart`, construido en Fase 3 sin wiring) al iniciar sesión.

**Architecture:** Hexagonal estricta, mismo patrón que Fases 1-3. `packages/domain` gana `hashPassword`/`verifyPassword`/`authenticateUser` (TypeScript puro + `bcryptjs`, sin dependencias de framework) y extiende `OrderRepository` con `listAll`/`listByCustomerId`/`updateFulfillmentStatus`/`updatePaymentStatus`. `apps/web` es el único lugar que conoce Auth.js — `packages/domain` nunca importa `next-auth`.

**Tech Stack:** `next-auth@5` (Auth.js v5, Credentials provider, JWT session — **sin** `@auth/drizzle-adapter**: el Credentials provider de Auth.js no persiste sesión en base de datos por diseño, confirmado en la doc oficial ("By default, the Credentials provider does not persist data in the database") — usar database sessions con Credentials requeriría un workaround no oficial documentado solo en un GitHub Discussion, sobre una librería que además sigue en beta (`5.0.0-beta.32`, sin release estable tras varios años). JWT sessions es el camino soportado oficialmente), `bcryptjs` (hashing puro JS — evita compilar un binario nativo en el `Dockerfile` Alpine, a diferencia de `bcrypt`).

**Spec:** `docs/superpowers/plan-desarrollo.md`, sección "Fase 4 — Autenticación y panel admin básico".

## Global Constraints

- **Login de `admin` y `customer`: Credentials (email + password), no magic link.** Magic link requeriría enviar emails reales — `packages/notifications` (SMTP propio) sigue siendo esqueleto vacío hasta Fase 6. Decisión del owner, 2026-09-13.
- **Estrategia de sesión: JWT, no database sessions** (ver Tech Stack arriba — limitación de diseño de Auth.js con Credentials, no una preferencia). `maxAge: 7 días`. Revocación: el callback `jwt` de Auth.js re-consulta `usersTable.isActive` por `token.sub` en cada request protegido y retorna `null` (invalida el token) si el usuario fue desactivado — mismo patrón que la decisión ya tomada para mobile ("JWT de sesión de TTL corto revocable vía `is_active`"), no un mecanismo nuevo.
- **Sin `@auth/drizzle-adapter`:** JWT-only con un único provider Credentials no requiere adapter en absoluto — Auth.js no necesita persistir `accounts`/`sessions`/`verificationTokens`. No se crean esas tablas.
- **`passwordHash` vive en la tabla `users` existente** (columna nueva, mismo patrón que `pinHash` ya usado para PIN de mobile) — no se crea una tabla de credenciales separada.
- **Semilla del primer admin vía variables de entorno** (`ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`) — nunca una contraseña hardcodeada en el repo. Si no están declaradas, el seed loguea un warning y sigue sin crear el admin (no rompe el resto del seed).
- **Alcance del panel admin: completo dentro del dominio de órdenes** (decisión del owner, 2026-09-13) — tabla con filtros (`fulfillment_status`, `payment_status`, `channel`, rango de fechas), búsqueda por nombre/email de cliente, ordenamiento, vista de detalle por orden (items, cliente, dirección), cambio de `fulfillment_status` y `payment_status`. **`trailer_stops`/`stock`/`event_bookings` NO se tocan — siguen siendo Fase 5**, tal como ya estaba secuenciado en el roadmap.
- **Alcance de `customer`: completo** (decisión del owner, 2026-09-13) — login, historial de pedidos (`listByCustomerId`), y merge automático de `mergeGuestCart` (Fase 3) al iniciar sesión. Checkout de invitado (Fase 3) sigue funcionando sin cambios para quien no se loguea.
- **Filtros de la tabla admin vía `searchParams` de la URL** (patrón Server Component nativo de Next.js 15, sin JS de cliente para el filtrado en sí) — consistente con el resto de `apps/web`, que ya es mayormente Server Components.
- **Panel admin bilingüe, dentro del locale routing de next-intl:** `/[locale]/admin/**` (no una ruta `/admin` separada fuera del sistema de locales) — el roadmap pide explícitamente "Panel admin bilingüe, usando `packages/i18n`".
- **Sin validación de máquina de estados para las transiciones de `fulfillment_status`/`payment_status`** en esta fase — cualquier cambio es válido. YAGNI; se puede endurecer más adelante si aparece un caso real de transición inválida que cause un problema.
- **Idioma y razonamiento:** regla ya vigente en `CLAUDE.md` — no se repite en cada tarea de este plan.
- **Commits:** un commit por tarea. Quien ejecute el plan nunca corre `git commit` — solo `git add` de los archivos relevantes y sugiere el comando exacto (español, una línea, sin firmas).
- **Branching:** directo sobre `main`, sin branches ni PRs.

---

### Tarea 1: `packages/domain/src/users` — contraseñas y `authenticateUser`

**Files:**
- Create: `packages/domain/src/users/auth.ts`
- Create: `packages/domain/src/users/auth.test.ts`
- Modify: `packages/domain/src/users/entities.ts`
- Modify: `packages/domain/src/users/ports.ts`
- Modify: `packages/domain/src/users/use-cases.ts`
- Modify: `packages/domain/src/users/use-cases.test.ts`
- Modify: `packages/domain/package.json`

**Interfaces:**
- Produces: `hashPassword(password: string): Promise<string>`, `verifyPassword(password: string, hash: string): Promise<boolean>`, `authenticateUser(repo: UserRepository, email: string, password: string): Promise<User | null>`. `User.passwordHash: string | null` (campo nuevo). `registerCustomer` gana un parámetro `password` obligatorio.

- [ ] **Step 1: Instalar `bcryptjs`**

Run: `pnpm --filter @workspace/domain add bcryptjs && pnpm --filter @workspace/domain add -D @types/bcryptjs`
Expected: ambos agregados a `packages/domain/package.json`

- [ ] **Step 2: Agregar `passwordHash` a la entidad**

```ts
// packages/domain/src/users/entities.ts
export type UserRole = "admin" | "despachador" | "delivery" | "customer";

export interface User {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  pinHash: string | null;
  passwordHash: string | null;
  isActive: boolean;
}
```

- [ ] **Step 3: Escribir los tests de hashing (fallan primero)**

```ts
// packages/domain/src/users/auth.test.ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./auth";

describe("hashPassword / verifyPassword", () => {
  it("hashes a password and verifies it back correctly", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toBe("correct horse battery staple");

    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });
});
```

- [ ] **Step 4: Correr el test y confirmar que falla**

Run: `pnpm --filter @workspace/domain run test -- auth`
Expected: FAIL con "Cannot find module './auth'"

- [ ] **Step 5: Implementar el hashing**

```ts
// packages/domain/src/users/auth.ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 6: Correr el test y confirmar que pasa**

Run: `pnpm --filter @workspace/domain run test -- auth`
Expected: PASS

- [ ] **Step 7: Escribir los tests de `authenticateUser` (fallan primero)**

Agregar al final de `packages/domain/src/users/use-cases.test.ts` (crear el archivo si no existe; si existe, mantener los tests presentes y agregar imports/fakes que falten):

```ts
import { describe, it, expect } from "vitest";
import { authenticateUser, registerCustomer } from "./use-cases";
import { hashPassword } from "./auth";
import type { User, UserRole } from "./entities";
import type { UserRepository } from "./ports";

function fakeUserRepo(initial: User[] = []): UserRepository & { created: Omit<User, "id">[] } {
  const users = [...initial];
  const created: Omit<User, "id">[] = [];
  return {
    created,
    async findById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async findByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async listActiveByRole(role: UserRole) {
      return users.filter((u) => u.role === role && u.isActive);
    },
    async create(user) {
      created.push(user);
      const inserted = { ...user, id: `user-${created.length}` };
      users.push(inserted);
      return inserted;
    },
  };
}

describe("authenticateUser", () => {
  it("returns the user when email and password match an active account", async () => {
    const passwordHash = await hashPassword("s3cret!");
    const repo = fakeUserRepo([
      { id: "u1", name: "Jane Admin", email: "jane@sweetsin.com.au", role: "admin", pinHash: null, passwordHash, isActive: true },
    ]);

    const user = await authenticateUser(repo, "jane@sweetsin.com.au", "s3cret!");

    expect(user?.id).toBe("u1");
  });

  it("returns null when the password does not match", async () => {
    const passwordHash = await hashPassword("s3cret!");
    const repo = fakeUserRepo([
      { id: "u1", name: "Jane Admin", email: "jane@sweetsin.com.au", role: "admin", pinHash: null, passwordHash, isActive: true },
    ]);

    expect(await authenticateUser(repo, "jane@sweetsin.com.au", "wrong")).toBeNull();
  });

  it("returns null for an inactive user even with the correct password", async () => {
    const passwordHash = await hashPassword("s3cret!");
    const repo = fakeUserRepo([
      { id: "u1", name: "Jane Admin", email: "jane@sweetsin.com.au", role: "admin", pinHash: null, passwordHash, isActive: false },
    ]);

    expect(await authenticateUser(repo, "jane@sweetsin.com.au", "s3cret!")).toBeNull();
  });

  it("returns null for a user with no password set (staff PIN accounts)", async () => {
    const repo = fakeUserRepo([
      { id: "u1", name: "Delivery Bot", email: null, role: "delivery", pinHash: "some-pin-hash", passwordHash: null, isActive: true },
    ]);

    expect(await authenticateUser(repo, "unused@example.com", "anything")).toBeNull();
  });

  it("returns null when no user exists with that email", async () => {
    const repo = fakeUserRepo([]);

    expect(await authenticateUser(repo, "nobody@example.com", "anything")).toBeNull();
  });
});

describe("registerCustomer", () => {
  it("hashes the password before persisting the new customer", async () => {
    const repo = fakeUserRepo([]);

    const user = await registerCustomer(repo, { name: "New Customer", email: "new@example.com", password: "hunter2" });

    expect(user.role).toBe("customer");
    expect(repo.created[0].passwordHash).not.toBe("hunter2");
    expect(repo.created[0].passwordHash).not.toBeNull();
  });
});
```

- [ ] **Step 8: Correr los tests y confirmar que fallan**

Run: `pnpm --filter @workspace/domain run test -- users`
Expected: FAIL — `authenticateUser` no existe, y `registerCustomer` no acepta `password` (error de tipos)

- [ ] **Step 9: Extender el puerto (sin cambios de forma, solo para referencia — `findByEmail` ya existe desde Fase 1)**

`packages/domain/src/users/ports.ts` no necesita cambios — `findById`/`findByEmail`/`listActiveByRole`/`create` ya cubren todo lo que `authenticateUser` y `registerCustomer` necesitan.

- [ ] **Step 10: Implementar `authenticateUser` y actualizar `registerCustomer`**

```ts
// packages/domain/src/users/use-cases.ts
import type { UserRepository } from "./ports";
import type { User, UserRole } from "./entities";
import { hashPassword, verifyPassword } from "./auth";

export async function listActiveStaff(
  repo: UserRepository,
  role: Exclude<UserRole, "customer">,
): Promise<User[]> {
  return repo.listActiveByRole(role);
}

export async function registerCustomer(
  repo: UserRepository,
  input: { name: string; email: string; password: string },
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
```

- [ ] **Step 11: Exponer `auth.ts` desde el índice del subdominio**

En `packages/domain/src/users/index.ts`, confirmar que ya reexporta todo con `export * from "./use-cases"` (ya existente desde Fase 1); agregar:

```ts
export * from "./auth";
```

- [ ] **Step 12: Correr los tests y confirmar que pasan**

Run: `pnpm --filter @workspace/domain run test -- users`
Expected: PASS (6 tests de `authenticateUser`/`registerCustomer` + 2 de `hashPassword`/`verifyPassword`)

- [ ] **Step 13: Verificar que el paquete completo sigue tipando limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 14: Commit**

```bash
git add packages/domain/src/users packages/domain/package.json
```

Comando sugerido: `git commit -m "Agrega hashing de password y authenticateUser al dominio de usuarios"`

---

### Tarea 2: `packages/db` — columna `password_hash` y repositorio

**Files:**
- Modify: `packages/db/src/schema/users.ts`
- Modify: `packages/db/src/repositories/user-repository.test.ts`
- Create: `packages/db/src/repositories/user-repository.test.ts` (si no existe)

**Interfaces:**
- Consumes: `authenticateUser`, `registerCustomer` de `@workspace/domain/users` (Tarea 1).

- [ ] **Step 1: Agregar la columna al schema**

```ts
// packages/db/src/schema/users.ts
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Aplicar el schema contra Postgres**

Run: `pnpm --filter @workspace/db run push`
Expected: drizzle-kit reporta la columna `password_hash` agregada a `users`. Confirmar en el output que no propone borrar ninguna columna existente antes de aceptar.

- [ ] **Step 3: Escribir el test de integración (falla primero — `findByEmail` ya existe, pero no hay test que ejercite `authenticateUser` contra Postgres real)**

Si `packages/db/src/repositories/user-repository.test.ts` no existe, crearlo:

```ts
// packages/db/src/repositories/user-repository.test.ts
import { describe, it, expect } from "vitest";
import { authenticateUser, registerCustomer } from "@workspace/domain/users";
import { DrizzleUserRepository } from "./user-repository";

describe("DrizzleUserRepository + authenticateUser", () => {
  it("registers a customer with a hashed password and authenticates with the real password", async () => {
    const repo = new DrizzleUserRepository();
    const email = `auth-test-${Date.now()}@example.com`;

    await registerCustomer(repo, { name: "Auth Test Customer", email, password: "correcthorse" });

    const authenticated = await authenticateUser(repo, email, "correcthorse");
    expect(authenticated?.email).toBe(email);

    const rejected = await authenticateUser(repo, email, "wrongpassword");
    expect(rejected).toBeNull();
  });
});
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `pnpm --filter @workspace/db run test -- user-repository`
Expected: PASS. (Si fallara por falta de la columna, revisar que el Step 2 se haya aplicado correctamente.)

- [ ] **Step 5: Verificar que el monorepo sigue tipando limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/users.ts packages/db/src/repositories/user-repository.test.ts
```

Comando sugerido: `git commit -m "Agrega la columna password_hash a users y prueba authenticateUser contra Postgres real"`

---

### Tarea 3: Instalar Auth.js y `bcryptjs` en `apps/web`

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Instalar los paquetes**

Run: `pnpm --filter @workspace/web add next-auth@beta bcryptjs && pnpm --filter @workspace/web add -D @types/bcryptjs`
Expected: `next-auth` (`5.0.0-beta.x`) y `bcryptjs` agregados a `dependencies`, `@types/bcryptjs` a `devDependencies` de `apps/web/package.json`

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
```

Comando sugerido: `git commit -m "Instala next-auth y bcryptjs en apps/web"`

---

### Tarea 4: `apps/web/src/auth.ts` — configuración de Auth.js

**Files:**
- Create: `apps/web/src/auth.ts`
- Create: `apps/web/src/types/next-auth.d.ts`

**Interfaces:**
- Consumes: `authenticateUser` de `@workspace/domain/users` (Tarea 1), `DrizzleUserRepository` de `@workspace/db/repositories`.
- Produces: `handlers`, `auth`, `signIn`, `signOut` (exports de Auth.js), `Session.user.role`.

La revocación de sesión pasa por el callback `jwt`, no por `session` — retornar `null` desde `jwt` es un mecanismo oficialmente soportado por Auth.js para invalidar un token; retornar `null` desde `session` no lo es (hay un issue abierto sin resolver pidiendo esa capacidad). Por eso la re-consulta de `isActive` contra la DB vive en `jwt`, que corre en cada request donde se llama `auth()`.

- [ ] **Step 1: Declarar los tipos de sesión extendidos**

```ts
// apps/web/src/types/next-auth.d.ts
import type { UserRole } from "@workspace/domain/users";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: UserRole;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
  }
}
```

- [ ] **Step 2: Implementar la configuración**

```ts
// apps/web/src/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateUser } from "@workspace/domain/users";
import { DrizzleUserRepository } from "@workspace/db/repositories";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const user = await authenticateUser(new DrizzleUserRepository(), email, password);
        if (!user) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Login recién ocurrido: `user` viene de authorize().
        token.role = (user as { role: typeof token.role }).role;
        return token;
      }

      // Request subsecuente: revalidar contra la DB para poder revocar
      // la sesión si el usuario fue desactivado, sin esperar a que
      // expire el JWT (mismo patrón que la revocación vía is_active ya
      // usada para las sesiones de mobile).
      if (!token.sub) return null;
      const dbUser = await new DrizzleUserRepository().findById(token.sub);
      if (!dbUser || !dbUser.isActive) return null;
      token.role = dbUser.role;
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.role) session.user.role = token.role;
      return session;
    },
  },
});
```

- [ ] **Step 3: Generar y declarar `AUTH_SECRET`**

Auth.js v5 lee `process.env.AUTH_SECRET` automáticamente (no hace falta pasarlo en la config) para firmar los JWT — en dev, si falta, Auth.js autogenera uno temporal con un warning en consola; **en producción falla explícitamente si no está declarado**. Generarlo una vez:

```bash
openssl rand -base64 32
```

Agregar el resultado a `apps/web/.env.local` (gitignored):

```
AUTH_SECRET=<el valor generado>
```

- [ ] **Step 4: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/auth.ts apps/web/src/types/next-auth.d.ts
```

Comando sugerido: `git commit -m "Configura Auth.js con Credentials, sesion JWT y revocacion via is_active"`

(`.env.local` no se commitea — está gitignored, mismo patrón que `DATABASE_URL`/`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)

---

### Tarea 5: Route Handler de Auth.js

**Files:**
- Create: `apps/web/src/app/api/auth/[...nextauth]/route.ts`

**Interfaces:**
- Consumes: `handlers` de `@/auth` (Tarea 4).

- [ ] **Step 1: Implementar el Route Handler**

```ts
// apps/web/src/app/api/auth/[...nextauth]/route.ts
export { GET, POST } from "@/auth";
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/api/auth/[...nextauth]/route.ts"
```

Comando sugerido: `git commit -m "Agrega el Route Handler de Auth.js"`

---

### Tarea 6: Semilla del primer usuario admin

**Files:**
- Modify: `packages/db/src/seed.ts`

**Interfaces:**
- Consumes: `hashPassword` de `@workspace/domain/users` (Tarea 1).

- [ ] **Step 1: Agregar la carga condicional del admin**

En `packages/db/src/seed.ts`, ampliar el destructure dinámico y agregar el bloque al final de `main()`, antes de `await pool.end();`:

```ts
const { productsTable, trailerStopsTable, settingsTable, usersTable } = await import("./schema");
const { hashPassword } = await import("@workspace/domain/users");
```

```ts
  const adminEmail = process.env.ADMIN_SEED_EMAIL;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await hashPassword(adminPassword);
    await db
      .insert(usersTable)
      .values({ name: "Admin", email: adminEmail, role: "admin", passwordHash, isActive: true })
      .onConflictDoUpdate({ target: usersTable.email, set: { passwordHash, isActive: true } });
    console.log(`Ensured admin user: ${adminEmail}.`);
  } else {
    console.log("ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD not set — skipping admin seed.");
  }

  await pool.end();
```

- [ ] **Step 2: Correr el seed con las variables declaradas**

Run (reemplazar con un email/password reales que el owner vaya a usar para loguearse):
```bash
ADMIN_SEED_EMAIL="admin@sweetsin.com.au" ADMIN_SEED_PASSWORD="<elegir una contraseña real acá>" pnpm --filter @workspace/db run seed
```
Expected: output incluye `Ensured admin user: admin@sweetsin.com.au.`

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/seed.ts
```

Comando sugerido: `git commit -m "Agrega la carga condicional del primer usuario admin al seed"`

---

### Tarea 7: Middleware combinado — next-intl + protección de `/admin`

**Files:**
- Modify: `apps/web/src/middleware.ts`

**Interfaces:**
- Consumes: `auth` de `@/auth` (Tarea 4), `routing` de `@/i18n/routing`.

Auth.js v5 soporta usar `auth` como wrapper de middleware (`export default auth((req) => {...})`, con `req.auth` exponiendo la sesión) y next-intl documenta el patrón de "componer" su middleware llamándolo como función dentro de un middleware custom en vez de exportarlo directo. No existe un ejemplo oficial único que combine ambas librerías —  esta es la composición de los dos patrones oficiales de cada una; por eso el Step 3 (verificación manual) es obligatorio antes de construir nada más encima.

- [ ] **Step 1: Implementar el middleware combinado**

```ts
// apps/web/src/middleware.ts
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { auth } from "./auth";

const handleI18nRouting = createMiddleware(routing);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAdminRoute = /^\/(en|es)?\/?admin(\/|$)/.test(pathname);

  if (isAdminRoute) {
    const role = req.auth?.user?.role;
    if (!req.auth || role !== "admin") {
      const locale = pathname.startsWith("/es") ? "es" : "en";
      const loginUrl = new URL(`${locale === "en" ? "" : "/es"}/login`, req.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return handleI18nRouting(req);
});

export const config = {
  // Todo menos /api, /trpc, /_next, /_vercel y archivos con extensión (favicon.ico, etc.)
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Verificación manual obligatoria (bloqueante para el resto del plan)**

Con `pnpm --filter @workspace/web run dev` corriendo:
1. Visitar `/en` y `/es` — deben seguir funcionando normal (el sitio público no se rompió).
2. Visitar `/admin` sin estar logueado — debe redirigir a `/login?callbackUrl=%2Fadmin`.
3. Visitar `/es/admin` sin estar logueado — debe redirigir a `/es/login?callbackUrl=%2Fes%2Fadmin`.

Si alguno de estos tres falla, **detenerse y ajustar el middleware antes de continuar** — todo lo que sigue (Tareas 8+) asume que esta composición funciona.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/middleware.ts
```

Comando sugerido: `git commit -m "Combina el middleware de next-intl con la proteccion de /admin por rol"`

---

### Tarea 8: `packages/i18n` — namespace `auth`

**Files:**
- Modify: `packages/i18n/src/types.ts`
- Modify: `packages/i18n/src/dictionaries/en.ts`
- Modify: `packages/i18n/src/dictionaries/es.ts`

- [ ] **Step 1: Agregar el namespace al tipo `Dictionary`**

En `packages/i18n/src/types.ts`, agregar antes del cierre de la interfaz (después de `cart`):

```ts
  auth: {
    loginTitle: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    loginButton: string;
    loginError: string;
    logoutButton: string;
  };
```

- [ ] **Step 2: Agregar las traducciones en inglés**

En `packages/i18n/src/dictionaries/en.ts`, agregar (mismo nivel que `cart`):

```ts
  auth: {
    loginTitle: "Sign in",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Password",
    loginButton: "Sign in",
    loginError: "Incorrect email or password.",
    logoutButton: "Sign out",
  },
```

- [ ] **Step 3: Agregar las traducciones en español**

En `packages/i18n/src/dictionaries/es.ts`, agregar (mismo nivel que `cart`):

```ts
  auth: {
    loginTitle: "Iniciar sesión",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Contraseña",
    loginButton: "Iniciar sesión",
    loginError: "Email o contraseña incorrectos.",
    logoutButton: "Cerrar sesión",
  },
```

- [ ] **Step 4: Correr el test de paridad de claves**

Run: `pnpm --filter @workspace/i18n run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/src/types.ts packages/i18n/src/dictionaries/en.ts packages/i18n/src/dictionaries/es.ts
```

Comando sugerido: `git commit -m "Agrega el namespace auth a los diccionarios de i18n"`

---

### Tarea 9: Server Actions de sesión — `signInAction`/`signOutAction`

**Files:**
- Create: `apps/web/src/app/actions/auth.ts`

**Interfaces:**
- Consumes: `signIn`, `signOut` de `@/auth` (Tarea 4).
- Produces: `signInAction(input: { email: string; password: string }): Promise<{ error: string } | { redirectTo: string }>`, `signOutAction(): Promise<void>`.

`signIn` de Auth.js lanza un `AuthError` (subclase `CredentialsSignin`) cuando `authorize()` devuelve `null` — se captura acá para devolver un error tipado al formulario en vez de dejar que la excepción llegue cruda al cliente.

- [ ] **Step 1: Implementar las Server Actions**

```ts
// apps/web/src/app/actions/auth.ts
"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { DrizzleUserRepository } from "@workspace/db/repositories";

export interface SignInInput {
  email: string;
  password: string;
}

export async function signInAction(input: SignInInput): Promise<{ error: string } | { role: string }> {
  try {
    await signIn("credentials", { email: input.email, password: input.password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "invalid_credentials" };
    }
    throw error;
  }

  const user = await new DrizzleUserRepository().findByEmail(input.email);
  return { role: user?.role ?? "customer" };
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirect: false });
}
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/actions/auth.ts
```

Comando sugerido: `git commit -m "Agrega signInAction y signOutAction"`

---

### Tarea 10: Página `/[locale]/login`

**Files:**
- Create: `apps/web/src/app/[locale]/login/page.tsx`
- Create: `apps/web/src/components/auth/login-form.tsx`

**Interfaces:**
- Consumes: `signInAction` de `@/app/actions/auth` (Tarea 9).

El formulario redirige según el rol devuelto por `signInAction`: `admin` va a `/admin`, cualquier otro rol (`customer` en la práctica — `despachador`/`delivery` no tienen login web) vuelve al `callbackUrl` si vino uno, o a la home.

- [ ] **Step 1: Implementar el formulario**

```tsx
// apps/web/src/components/auth/login-form.tsx
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { signInAction } from "@/app/actions/auth";

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const result = await signInAction({ email, password });
      if ("error" in result) {
        setError(t("loginError"));
        return;
      }
      const callbackUrl = searchParams.get("callbackUrl");
      router.push(result.role === "admin" ? "/admin" : callbackUrl || "/");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm mx-auto">
      <h1 className="font-serif font-bold text-navy text-2xl mb-4">{t("loginTitle")}</h1>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("emailPlaceholder")}
        type="email"
        className="w-full bg-cream border border-navy/12 rounded-2xl px-5 py-3.5 text-sm text-navy outline-none focus:border-sin-red"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t("passwordPlaceholder")}
        type="password"
        className="w-full bg-cream border border-navy/12 rounded-2xl px-5 py-3.5 text-sm text-navy outline-none focus:border-sin-red"
      />
      {error && <p className="text-sin-red text-[12px]">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-sin-red text-white py-3.5 rounded-2xl font-bold text-[15px] disabled:opacity-50"
      >
        {t("loginButton")}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Implementar la página**

```tsx
// apps/web/src/app/[locale]/login/page.tsx
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen flex items-center justify-center bg-cream px-6">
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 3: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 4: Verificación manual**

Con el dev server corriendo, ir a `/login`, loguearse con el admin sembrado en la Tarea 6. Confirmar que redirige a `/admin` (esa ruta todavía no existe — es esperado un 404 hasta la Tarea 14, lo que importa acá es que el login en sí funcione y redirija).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/[locale]/login" apps/web/src/components/auth/login-form.tsx
```

Comando sugerido: `git commit -m "Agrega la pagina de login"`

---

### Tarea 11: Extender `OrderRepository` — `listAll`, `listByCustomerId`, cambio de estado

**Files:**
- Modify: `packages/domain/src/orders/ports.ts`
- Modify: `packages/domain/src/orders/use-cases.ts`
- Modify: `packages/domain/src/orders/use-cases.test.ts`

**Interfaces:**
- Produces: `OrderFilters { fulfillmentStatus?; paymentStatus?; channel?; dateFrom?: string; dateTo?: string; search?: string; sortBy?: "createdAt" | "totalCents"; sortDir?: "asc" | "desc" }`, `OrderRepository.listAll(filters): Promise<Order[]>`, `OrderRepository.listByCustomerId(customerId): Promise<Order[]>`, `OrderRepository.updateFulfillmentStatus(orderId, status): Promise<void>`, `OrderRepository.updatePaymentStatus(orderId, status): Promise<void>`, `listOrders(repo, filters): Promise<Order[]>`.

`listOrders` valida que, si se pasan ambos extremos del rango de fechas, `dateFrom <= dateTo` — única regla real que justifica un caso de uso en vez de que el Server Action llame al repositorio directo.

- [ ] **Step 1: Escribir los tests (fallan primero)**

Agregar al final de `packages/domain/src/orders/use-cases.test.ts`:

```ts
import { listOrders } from "./use-cases";
import type { OrderFilters } from "./ports";

function fakeOrderRepoForListing(orders: Order[]): OrderRepository & { listAllCalls: OrderFilters[] } {
  const listAllCalls: OrderFilters[] = [];
  return {
    listAllCalls,
    async create(o) {
      return { ...o, id: "unused" };
    },
    async findById(id) {
      return orders.find((o) => o.id === id) ?? null;
    },
    async attachPaymentIntent() {},
    async markAsPaid() {},
    async listAll(filters) {
      listAllCalls.push(filters);
      return orders;
    },
    async listByCustomerId() {
      return orders;
    },
    async updateFulfillmentStatus() {},
    async updatePaymentStatus() {},
  };
}

describe("listOrders", () => {
  it("passes the filters through to the repository", async () => {
    const repo = fakeOrderRepoForListing([]);
    const filters: OrderFilters = { fulfillmentStatus: "pending" };

    await listOrders(repo, filters);

    expect(repo.listAllCalls).toEqual([filters]);
  });

  it("throws when dateFrom is after dateTo", async () => {
    const repo = fakeOrderRepoForListing([]);

    await expect(
      listOrders(repo, { dateFrom: "2026-09-20", dateTo: "2026-09-01" }),
    ).rejects.toThrow("dateFrom must not be after dateTo");
  });

  it("allows a filter with only dateFrom or only dateTo", async () => {
    const repo = fakeOrderRepoForListing([]);

    await expect(listOrders(repo, { dateFrom: "2026-09-01" })).resolves.toEqual([]);
    await expect(listOrders(repo, { dateTo: "2026-09-01" })).resolves.toEqual([]);
  });
});
```

Actualizar también `fakeOrderRepoWithOrder` y `fakeOrderRepo` (ya existentes en el archivo) agregando los cuatro métodos nuevos del puerto para que sigan compilando:

```ts
    async listAll() {
      return [];
    },
    async listByCustomerId() {
      return [];
    },
    async updateFulfillmentStatus() {},
    async updatePaymentStatus() {},
```

(agregar estas líneas dentro de cada objeto que retornan `fakeOrderRepo()` y `fakeOrderRepoWithOrder()`, junto a los métodos existentes)

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `pnpm --filter @workspace/domain run test -- orders`
Expected: FAIL — `listOrders` no existe, y los fakes no implementan el puerto ampliado

- [ ] **Step 3: Extender el puerto**

```ts
// packages/domain/src/orders/ports.ts
import type { Order, OrderChannel, FulfillmentType, FulfillmentStatus, PaymentStatus } from "./entities";

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

export interface OrderFilters {
  fulfillmentStatus?: FulfillmentStatus;
  paymentStatus?: PaymentStatus;
  channel?: OrderChannel;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: "createdAt" | "totalCents";
  sortDir?: "asc" | "desc";
}

export interface OrderRepository {
  create(order: Omit<Order, "id">): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  attachPaymentIntent(orderId: string, stripePaymentIntentId: string): Promise<void>;
  markAsPaid(orderId: string): Promise<void>;
  listAll(filters: OrderFilters): Promise<Order[]>;
  listByCustomerId(customerId: string): Promise<Order[]>;
  updateFulfillmentStatus(orderId: string, status: FulfillmentStatus): Promise<void>;
  updatePaymentStatus(orderId: string, status: PaymentStatus): Promise<void>;
}
```

- [ ] **Step 4: Implementar `listOrders`**

Agregar al final de `packages/domain/src/orders/use-cases.ts`:

```ts
import type { OrderFilters } from "./ports";

export async function listOrders(repo: OrderRepository, filters: OrderFilters): Promise<Order[]> {
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    throw new Error("dateFrom must not be after dateTo");
  }
  return repo.listAll(filters);
}
```

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `pnpm --filter @workspace/domain run test -- orders`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/orders/ports.ts packages/domain/src/orders/use-cases.ts packages/domain/src/orders/use-cases.test.ts
```

Comando sugerido: `git commit -m "Extiende OrderRepository con listAll, listByCustomerId y cambio de estado"`

---

### Tarea 12: Implementar los métodos nuevos en `DrizzleOrderRepository`

**Files:**
- Modify: `packages/db/src/repositories/order-repository.ts`
- Modify: `packages/db/src/repositories/order-repository.test.ts`

**Interfaces:**
- Consumes: `OrderFilters`, puerto extendido (Tarea 11).

- [ ] **Step 1: Agregar los casos al test de integración (fallan primero)**

Agregar al final del `describe("DrizzleOrderRepository", ...)`:

```ts
  it("lists orders filtered by fulfillment status and sorted by total", async () => {
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
  });

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
```

Agregar el import de `DrizzleUserRepository` al principio de `order-repository.test.ts` si no está ya presente:

```ts
import { DrizzleUserRepository } from "./user-repository";
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `pnpm --filter @workspace/db run test -- order-repository`
Expected: FAIL — `orders.listAll is not a function`

- [ ] **Step 3: Implementar los métodos**

Agregar dentro de `class DrizzleOrderRepository`, después de `markAsPaid`:

```ts
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
```

Reemplazar la línea `import { eq } from "drizzle-orm";` del principio del archivo por:

```ts
import { eq, and, or, gte, lte, ilike, asc, desc } from "drizzle-orm";
```

Y reemplazar `import type { Order, OrderRepository } from "@workspace/domain/orders";` por:

```ts
import type { Order, OrderRepository, OrderFilters } from "@workspace/domain/orders";
```

`findById` puede quedar como está, o refactorizarse para usar el nuevo `attachItems` privado (opcional, no obligatorio para este plan — si se hace, verificar que el test existente de `findById` sigue pasando).

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `pnpm --filter @workspace/db run test -- order-repository`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/repositories/order-repository.ts packages/db/src/repositories/order-repository.test.ts
```

Comando sugerido: `git commit -m "Implementa listAll, listByCustomerId y cambio de estado en DrizzleOrderRepository"`

---

### Tarea 13: `packages/i18n` — namespace `admin`

**Files:**
- Modify: `packages/i18n/src/types.ts`
- Modify: `packages/i18n/src/dictionaries/en.ts`
- Modify: `packages/i18n/src/dictionaries/es.ts`

- [ ] **Step 1: Agregar el namespace al tipo `Dictionary`**

En `packages/i18n/src/types.ts`, agregar después de `auth`:

```ts
  admin: {
    ordersTitle: string;
    filterAll: string;
    filterFulfillmentStatus: string;
    filterPaymentStatus: string;
    filterChannel: string;
    filterDateFrom: string;
    filterDateTo: string;
    searchPlaceholder: string;
    applyFilters: string;
    columnCustomer: string;
    columnStatus: string;
    columnPayment: string;
    columnChannel: string;
    columnTotal: string;
    columnDate: string;
    viewDetail: string;
    backToOrders: string;
    detailItems: string;
    detailCustomer: string;
    detailAddress: string;
    saveStatus: string;
    statusSaved: string;
  };
```

- [ ] **Step 2: Agregar las traducciones en inglés**

```ts
  admin: {
    ordersTitle: "Orders",
    filterAll: "All",
    filterFulfillmentStatus: "Fulfillment status",
    filterPaymentStatus: "Payment status",
    filterChannel: "Channel",
    filterDateFrom: "From",
    filterDateTo: "To",
    searchPlaceholder: "Search by name or email…",
    applyFilters: "Apply",
    columnCustomer: "Customer",
    columnStatus: "Status",
    columnPayment: "Payment",
    columnChannel: "Channel",
    columnTotal: "Total",
    columnDate: "Date",
    viewDetail: "View",
    backToOrders: "← Back to orders",
    detailItems: "Items",
    detailCustomer: "Customer",
    detailAddress: "Address",
    saveStatus: "Save",
    statusSaved: "Saved",
  },
```

- [ ] **Step 3: Agregar las traducciones en español**

```ts
  admin: {
    ordersTitle: "Órdenes",
    filterAll: "Todas",
    filterFulfillmentStatus: "Estado de entrega",
    filterPaymentStatus: "Estado de pago",
    filterChannel: "Canal",
    filterDateFrom: "Desde",
    filterDateTo: "Hasta",
    searchPlaceholder: "Buscar por nombre o email…",
    applyFilters: "Aplicar",
    columnCustomer: "Cliente",
    columnStatus: "Estado",
    columnPayment: "Pago",
    columnChannel: "Canal",
    columnTotal: "Total",
    columnDate: "Fecha",
    viewDetail: "Ver",
    backToOrders: "← Volver a órdenes",
    detailItems: "Items",
    detailCustomer: "Cliente",
    detailAddress: "Dirección",
    saveStatus: "Guardar",
    statusSaved: "Guardado",
  },
```

- [ ] **Step 4: Correr el test de paridad y verificar typecheck**

Run: `pnpm --filter @workspace/i18n run test && pnpm run typecheck`
Expected: ambos PASS

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/src/types.ts packages/i18n/src/dictionaries/en.ts packages/i18n/src/dictionaries/es.ts
```

Comando sugerido: `git commit -m "Agrega el namespace admin a los diccionarios de i18n"`

---

### Tarea 14: Layout del panel admin

**Files:**
- Create: `apps/web/src/app/[locale]/admin/layout.tsx`

**Interfaces:**
- Consumes: `auth` de `@/auth` (Tarea 4), `signOutAction` de `@/app/actions/auth` (Tarea 9).

El middleware (Tarea 7) ya bloquea `/admin/**` para no-admins a nivel de red, pero este guard adicional a nivel de Server Component es defensa en profundidad barata — y es donde vive el nav/logout del panel.

- [ ] **Step 1: Implementar el layout**

```tsx
// apps/web/src/app/[locale]/admin/layout.tsx
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session || session.user.role !== "admin") {
    redirect({ href: "/login", locale });
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between px-6 py-4 border-b border-navy/10 bg-white">
        <span className="font-serif font-bold text-navy">Sweet Sin Admin</span>
        <form action={async () => { "use server"; await signOutAction(); redirect({ href: "/login", locale }); }}>
          <button type="submit" className="text-[13px] text-navy/50 hover:text-sin-red transition-colors">
            Sign out
          </button>
        </form>
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
```

`redirect` de `@/i18n/navigation` (helper locale-aware de next-intl, vía `createNavigation`) requiere `locale` explícito cuando se llama desde un Server Component fuera del árbol de render normal de next-intl (como este `redirect` temprano antes de renderizar) — por eso se pasa `{ href, locale }` en vez de solo el string.

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/[locale]/admin/layout.tsx"
```

Comando sugerido: `git commit -m "Agrega el layout protegido del panel admin"`

---

### Tarea 15: Server Actions del panel admin — listar y cambiar estado

**Files:**
- Create: `apps/web/src/app/actions/admin-orders.ts`

**Interfaces:**
- Consumes: `listOrders` de `@workspace/domain/orders` (Tarea 11), `DrizzleOrderRepository`, `auth` de `@/auth` (Tarea 4).
- Produces: `listOrdersAction(filters: OrderFilters): Promise<Order[]>`, `updateOrderStatusAction(input: { orderId: string; fulfillmentStatus?: FulfillmentStatus; paymentStatus?: PaymentStatus }): Promise<void>`.

Ambas Server Actions revalidan el rol server-side (`auth()`) además del guard del layout — una Server Action es invocable directamente vía su endpoint interno, no solo desde la página que la importa, así que no puede confiar únicamente en que el layout ya filtró el acceso.

- [ ] **Step 1: Implementar las Server Actions**

```ts
// apps/web/src/app/actions/admin-orders.ts
"use server";

import { listOrders } from "@workspace/domain/orders";
import type { Order, OrderFilters, FulfillmentStatus, PaymentStatus } from "@workspace/domain/orders";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { auth } from "@/auth";

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    throw new Error("Forbidden");
  }
}

export async function listOrdersAction(filters: OrderFilters): Promise<Order[]> {
  await requireAdmin();
  return listOrders(new DrizzleOrderRepository(), filters);
}

export async function updateOrderStatusAction(input: {
  orderId: string;
  fulfillmentStatus?: FulfillmentStatus;
  paymentStatus?: PaymentStatus;
}): Promise<void> {
  await requireAdmin();
  const repo = new DrizzleOrderRepository();
  if (input.fulfillmentStatus) await repo.updateFulfillmentStatus(input.orderId, input.fulfillmentStatus);
  if (input.paymentStatus) await repo.updatePaymentStatus(input.orderId, input.paymentStatus);
}
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/actions/admin-orders.ts
```

Comando sugerido: `git commit -m "Agrega las Server Actions del panel admin para listar y cambiar estado de ordenes"`

---

### Tarea 16: Página de la tabla de órdenes

**Files:**
- Create: `apps/web/src/app/[locale]/admin/orders/page.tsx`

**Interfaces:**
- Consumes: `listOrdersAction` de `@/app/actions/admin-orders` (Tarea 15).

Filtros vía `<form method="get">` — Server Component puro, sin JS de cliente para el filtrado. `searchParams` de Next.js 15 llega como `Promise`.

- [ ] **Step 1: Implementar la página**

```tsx
// apps/web/src/app/[locale]/admin/orders/page.tsx
import type { Locale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listOrdersAction } from "@/app/actions/admin-orders";
import type { FulfillmentStatus, PaymentStatus, OrderChannel } from "@workspace/domain/orders";

type SearchParams = Record<string, string | undefined>;

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const sp = await searchParams;

  const orders = await listOrdersAction({
    fulfillmentStatus: (sp.fulfillmentStatus as FulfillmentStatus) || undefined,
    paymentStatus: (sp.paymentStatus as PaymentStatus) || undefined,
    channel: (sp.channel as OrderChannel) || undefined,
    dateFrom: sp.dateFrom || undefined,
    dateTo: sp.dateTo || undefined,
    search: sp.search || undefined,
    sortBy: "createdAt",
    sortDir: "desc",
  });

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{t("ordersTitle")}</h1>

      <form method="get" className="flex flex-wrap gap-3 mb-6">
        <input name="search" defaultValue={sp.search ?? ""} placeholder={t("searchPlaceholder")} className="border border-navy/15 rounded-lg px-3 py-2 text-sm" />
        <select name="fulfillmentStatus" defaultValue={sp.fulfillmentStatus ?? ""} className="border border-navy/15 rounded-lg px-3 py-2 text-sm">
          <option value="">{t("filterFulfillmentStatus")}</option>
          {["pending", "received", "in_prep", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="paymentStatus" defaultValue={sp.paymentStatus ?? ""} className="border border-navy/15 rounded-lg px-3 py-2 text-sm">
          <option value="">{t("filterPaymentStatus")}</option>
          {["pending", "paid", "failed", "refunded"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select name="channel" defaultValue={sp.channel ?? ""} className="border border-navy/15 rounded-lg px-3 py-2 text-sm">
          <option value="">{t("filterChannel")}</option>
          <option value="web">web</option>
          <option value="whatsapp">whatsapp</option>
        </select>
        <input type="date" name="dateFrom" defaultValue={sp.dateFrom ?? ""} className="border border-navy/15 rounded-lg px-3 py-2 text-sm" />
        <input type="date" name="dateTo" defaultValue={sp.dateTo ?? ""} className="border border-navy/15 rounded-lg px-3 py-2 text-sm" />
        <button type="submit" className="bg-navy text-white rounded-lg px-4 py-2 text-sm">{t("applyFilters")}</button>
      </form>

      <table className="w-full text-sm bg-white rounded-xl overflow-hidden">
        <thead className="bg-navy/5 text-left">
          <tr>
            <th className="px-4 py-3">{t("columnCustomer")}</th>
            <th className="px-4 py-3">{t("columnStatus")}</th>
            <th className="px-4 py-3">{t("columnPayment")}</th>
            <th className="px-4 py-3">{t("columnChannel")}</th>
            <th className="px-4 py-3">{t("columnTotal")}</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t border-navy/5">
              <td className="px-4 py-3">{order.customerName}<br /><span className="text-navy/40 text-xs">{order.customerEmail}</span></td>
              <td className="px-4 py-3">{order.fulfillmentStatus}</td>
              <td className="px-4 py-3">{order.paymentStatus}</td>
              <td className="px-4 py-3">{order.channel}</td>
              <td className="px-4 py-3">${(order.totalCents / 100).toFixed(2)}</td>
              <td className="px-4 py-3">
                <Link href={`/admin/orders/${order.id}`} className="text-sin-red hover:underline">{t("viewDetail")}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/[locale]/admin/orders/page.tsx"
```

Comando sugerido: `git commit -m "Agrega la tabla de ordenes del panel admin con filtros"`

---

### Tarea 17: Página de detalle de orden

**Files:**
- Create: `apps/web/src/app/[locale]/admin/orders/[id]/page.tsx`
- Create: `apps/web/src/components/admin/order-status-form.tsx`

**Interfaces:**
- Consumes: `updateOrderStatusAction` de `@/app/actions/admin-orders` (Tarea 15), `DrizzleOrderRepository`.

- [ ] **Step 1: Implementar el formulario de cambio de estado (Client Component — necesita `useState` para feedback de "guardado")**

```tsx
// apps/web/src/components/admin/order-status-form.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updateOrderStatusAction } from "@/app/actions/admin-orders";
import type { FulfillmentStatus, PaymentStatus } from "@workspace/domain/orders";

const FULFILLMENT_STATUSES: FulfillmentStatus[] = [
  "pending", "received", "in_prep", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled",
];
const PAYMENT_STATUSES: PaymentStatus[] = ["pending", "paid", "failed", "refunded"];

export function OrderStatusForm({
  orderId,
  fulfillmentStatus,
  paymentStatus,
}: {
  orderId: string;
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: PaymentStatus;
}) {
  const t = useTranslations("admin");
  const [fulfillment, setFulfillment] = useState(fulfillmentStatus);
  const [payment, setPayment] = useState(paymentStatus);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaved(false);
    await updateOrderStatusAction({ orderId, fulfillmentStatus: fulfillment, paymentStatus: payment });
    setSaved(true);
  }

  return (
    <div className="flex items-end gap-3">
      <div>
        <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("filterFulfillmentStatus")}</label>
        <select
          value={fulfillment}
          onChange={(e) => setFulfillment(e.target.value as FulfillmentStatus)}
          className="border border-navy/15 rounded-lg px-3 py-2 text-sm"
        >
          {FULFILLMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("filterPaymentStatus")}</label>
        <select
          value={payment}
          onChange={(e) => setPayment(e.target.value as PaymentStatus)}
          className="border border-navy/15 rounded-lg px-3 py-2 text-sm"
        >
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <button onClick={handleSave} className="bg-sin-red text-white rounded-lg px-4 py-2 text-sm">{t("saveStatus")}</button>
      {saved && <span className="text-[12px] text-green-700">{t("statusSaved")}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Implementar la página de detalle**

```tsx
// apps/web/src/app/[locale]/admin/orders/[id]/page.tsx
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DrizzleOrderRepository } from "@workspace/db/repositories";
import { OrderStatusForm } from "@/components/admin/order-status-form";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const order = await new DrizzleOrderRepository().findById(id);
  if (!order) notFound();

  return (
    <div>
      <Link href="/admin/orders" className="text-[13px] text-navy/50 hover:text-sin-red mb-4 inline-block">{t("backToOrders")}</Link>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{order.customerName}</h1>

      <div className="bg-white rounded-xl p-5 mb-6">
        <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-2">{t("detailCustomer")}</h2>
        <p className="text-sm">{order.customerName} — {order.customerEmail} — {order.customerPhone}</p>
        {order.deliveryAddress && (
          <p className="text-sm mt-1">{t("detailAddress")}: {order.deliveryAddress}</p>
        )}
      </div>

      <div className="bg-white rounded-xl p-5 mb-6">
        <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-2">{t("detailItems")}</h2>
        <ul className="text-sm space-y-1">
          {order.items.map((item) => (
            <li key={item.productId}>{item.quantity}x — ${(item.unitPriceCents / 100).toFixed(2)} c/u</li>
          ))}
        </ul>
        <p className="text-sm font-bold mt-3">{t("columnTotal")}: ${(order.totalCents / 100).toFixed(2)}</p>
      </div>

      <div className="bg-white rounded-xl p-5">
        <OrderStatusForm orderId={order.id} fulfillmentStatus={order.fulfillmentStatus} paymentStatus={order.paymentStatus} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/[locale]/admin/orders/[id]" apps/web/src/components/admin/order-status-form.tsx
```

Comando sugerido: `git commit -m "Agrega la vista de detalle de orden con cambio de estado"`

---

### Tarea 18: Verificación manual del panel admin (bloqueante)

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Login y navegación**

Con `pnpm --filter @workspace/web run dev` corriendo: loguearse en `/login` con el admin sembrado (Tarea 6), confirmar redirect a `/admin`... — **`/admin` en sí no tiene página propia todavía** (solo `/admin/orders` y `/admin/orders/[id]`). Navegar manualmente a `/admin/orders`.

- [ ] **Step 2: Filtros y búsqueda**

Crear una orden de prueba real vía checkout de invitado (mismo procedimiento de Fase 3: email identificable, ej. `qa-fase4@example.com`). Confirmar que aparece en `/admin/orders`, que el filtro por `channel` la encuentra, y que la búsqueda por email la encuentra.

- [ ] **Step 3: Cambio de estado**

Abrir el detalle de esa orden, cambiar `fulfillmentStatus` a `in_prep` y `paymentStatus` a `paid`, guardar. Recargar la página y confirmar que el cambio persistió (query directa a `orders` o recargando el detalle).

- [ ] **Step 4: Limpiar el dato de prueba**

Borrar la orden de prueba de `qa-fase4@example.com` (y su `order_items`) de la DB — mismo procedimiento que en Fases 2 y 3.

Si algo de esto falla, **detenerse y arreglarlo antes de avanzar a la Tarea 19** — el resto del plan (customer) reutiliza el mismo patrón de Server Actions/filtros validado acá.

---

### Tarea 19: Extender `packages/domain/src/cart` — nada que hacer, ya existe

**Files:** ninguno

`CartRepository`/`syncCart`/`mergeGuestCart` ya están completos y probados desde Fase 3 (`packages/domain/src/cart`). Esta tarea existe solo para dejar registrado en el plan que no hace falta tocar el dominio del carrito — la Tarea 21 conecta el wiring que faltaba, sin modificar `packages/domain`.

- [ ] **Step 1: Confirmar que sigue en verde**

Run: `pnpm --filter @workspace/domain run test -- cart`
Expected: PASS (3 tests, sin cambios)

---

### Tarea 20: Server Action de registro de `customer`

**Files:**
- Create: `apps/web/src/app/actions/register.ts`

**Interfaces:**
- Consumes: `registerCustomer` de `@workspace/domain/users` (Tarea 1, ya actualizado con `password`).

- [ ] **Step 1: Implementar la Server Action**

```ts
// apps/web/src/app/actions/register.ts
"use server";

import { z } from "zod";
import { registerCustomer } from "@workspace/domain/users";
import { DrizzleUserRepository } from "@workspace/db/repositories";

const registerSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
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

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/actions/register.ts
```

Comando sugerido: `git commit -m "Agrega la Server Action de registro de customer"`

---

### Tarea 21: `packages/i18n` — namespace `account`

**Files:**
- Modify: `packages/i18n/src/types.ts`
- Modify: `packages/i18n/src/dictionaries/en.ts`
- Modify: `packages/i18n/src/dictionaries/es.ts`

- [ ] **Step 1: Agregar el namespace al tipo `Dictionary`**

Después de `admin`:

```ts
  account: {
    registerTitle: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    registerButton: string;
    registerError: string;
    haveAccount: string;
    loginLink: string;
    ordersTitle: string;
    noOrders: string;
    orderTotal: string;
    orderStatus: string;
  };
```

- [ ] **Step 2: Agregar las traducciones en inglés**

```ts
  account: {
    registerTitle: "Create your account",
    namePlaceholder: "Full name",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Password (min. 8 characters)",
    registerButton: "Create account",
    registerError: "That email is already registered.",
    haveAccount: "Already have an account?",
    loginLink: "Sign in",
    ordersTitle: "Your orders",
    noOrders: "You haven't placed any orders yet.",
    orderTotal: "Total",
    orderStatus: "Status",
  },
```

- [ ] **Step 3: Agregar las traducciones en español**

```ts
  account: {
    registerTitle: "Creá tu cuenta",
    namePlaceholder: "Nombre completo",
    emailPlaceholder: "Email",
    passwordPlaceholder: "Contraseña (mín. 8 caracteres)",
    registerButton: "Crear cuenta",
    registerError: "Ese email ya está registrado.",
    haveAccount: "¿Ya tenés cuenta?",
    loginLink: "Iniciar sesión",
    ordersTitle: "Tus pedidos",
    noOrders: "Todavía no hiciste ningún pedido.",
    orderTotal: "Total",
    orderStatus: "Estado",
  },
```

- [ ] **Step 4: Correr el test de paridad y typecheck**

Run: `pnpm --filter @workspace/i18n run test && pnpm run typecheck`
Expected: ambos PASS

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/src/types.ts packages/i18n/src/dictionaries/en.ts packages/i18n/src/dictionaries/es.ts
```

Comando sugerido: `git commit -m "Agrega el namespace account a los diccionarios de i18n"`

---

### Tarea 22: Página de registro de `customer`

**Files:**
- Create: `apps/web/src/app/[locale]/register/page.tsx`
- Create: `apps/web/src/components/auth/register-form.tsx`

**Interfaces:**
- Consumes: `registerCustomerAction` de `@/app/actions/register` (Tarea 20), `signInAction` de `@/app/actions/auth` (Tarea 9).

Tras registrarse, loguea automáticamente (llama `signInAction` con las mismas credenciales) para no pedirle al cliente que se loguee dos veces seguidas.

- [ ] **Step 1: Implementar el formulario**

```tsx
// apps/web/src/components/auth/register-form.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { registerCustomerAction } from "@/app/actions/register";
import { signInAction } from "@/app/actions/auth";

export function RegisterForm() {
  const t = useTranslations("account");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const result = await registerCustomerAction({ name, email, password });
      if ("error" in result) {
        setError(t("registerError"));
        return;
      }
      await signInAction({ email, password });
      router.push("/account/orders");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm mx-auto">
      <h1 className="font-serif font-bold text-navy text-2xl mb-4">{t("registerTitle")}</h1>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} className="w-full bg-cream border border-navy/12 rounded-2xl px-5 py-3.5 text-sm text-navy outline-none focus:border-sin-red" />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} type="email" className="w-full bg-cream border border-navy/12 rounded-2xl px-5 py-3.5 text-sm text-navy outline-none focus:border-sin-red" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("passwordPlaceholder")} type="password" className="w-full bg-cream border border-navy/12 rounded-2xl px-5 py-3.5 text-sm text-navy outline-none focus:border-sin-red" />
      {error && <p className="text-sin-red text-[12px]">{error}</p>}
      <button type="submit" disabled={isSubmitting} className="w-full bg-sin-red text-white py-3.5 rounded-2xl font-bold text-[15px] disabled:opacity-50">
        {t("registerButton")}
      </button>
      <p className="text-[13px] text-navy/50 text-center">
        {t("haveAccount")} <Link href="/login" className="text-sin-red hover:underline">{tAuth("loginTitle")}</Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Implementar la página**

```tsx
// apps/web/src/app/[locale]/register/page.tsx
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { RegisterForm } from "@/components/auth/register-form";

export default async function RegisterPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen flex items-center justify-center bg-cream px-6">
      <RegisterForm />
    </main>
  );
}
```

- [ ] **Step 3: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/[locale]/register" apps/web/src/components/auth/register-form.tsx
```

Comando sugerido: `git commit -m "Agrega la pagina de registro de customer"`

---

### Tarea 23: Server Action de merge de carrito al loguearse

**Files:**
- Create: `apps/web/src/app/actions/merge-cart.ts`

**Interfaces:**
- Consumes: `mergeGuestCart` de `@workspace/domain/cart` (Fase 3, ya existe), `DrizzleCartRepository`, `auth` de `@/auth` (Tarea 4).
- Produces: `mergeCartOnLoginAction(guestItems: { productId: string; quantity: number }[]): Promise<{ productId: string; quantity: number }[]>` — devuelve el carrito fusionado para que el cliente reemplace su `localStorage`.

- [ ] **Step 1: Implementar la Server Action**

```ts
// apps/web/src/app/actions/merge-cart.ts
"use server";

import { mergeGuestCart } from "@workspace/domain/cart";
import { DrizzleCartRepository } from "@workspace/db/repositories";
import { auth } from "@/auth";

export async function mergeCartOnLoginAction(
  guestItems: { productId: string; quantity: number }[],
): Promise<{ productId: string; quantity: number }[]> {
  const session = await auth();
  if (!session) return guestItems;

  const cart = await mergeGuestCart(new DrizzleCartRepository(), session.user.id, guestItems);
  return cart.items;
}
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/actions/merge-cart.ts
```

Comando sugerido: `git commit -m "Agrega la Server Action que fusiona el carrito de invitado al loguearse"`

---

### Tarea 24: Conectar el merge de carrito al flujo de login

**Files:**
- Modify: `apps/web/src/components/auth/login-form.tsx`

**Interfaces:**
- Consumes: `mergeCartOnLoginAction` de `@/app/actions/merge-cart` (Tarea 23), `STORAGE_KEY` (mismo valor literal usado en `cart-store.tsx` de Fase 3 — no se exporta como constante hoy, así que se repite el literal acá con una nota).

- [ ] **Step 1: Modificar `handleSubmit` para fusionar el carrito tras un login exitoso**

En `apps/web/src/components/auth/login-form.tsx`, agregar el import:

```ts
import { mergeCartOnLoginAction } from "@/app/actions/merge-cart";
```

Reemplazar el cuerpo de `handleSubmit`:

```tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const result = await signInAction({ email, password });
      if ("error" in result) {
        setError(t("loginError"));
        return;
      }

      if (result.role === "customer") {
        try {
          const raw = window.localStorage.getItem("sweet-sin-cart");
          const guestItems = raw ? JSON.parse(raw) : [];
          const merged = await mergeCartOnLoginAction(guestItems);
          window.localStorage.setItem("sweet-sin-cart", JSON.stringify(merged));
        } catch {
          // localStorage puede fallar (modo privado) — el login igual continúa,
          // el carrito server-side queda como fuente de verdad de todos modos.
        }
      }

      const callbackUrl = searchParams.get("callbackUrl");
      router.push(result.role === "admin" ? "/admin" : callbackUrl || "/");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }
```

`"sweet-sin-cart"` es el mismo `STORAGE_KEY` literal de `apps/web/src/lib/cart-store.tsx` (Fase 3) — no exportado como constante ahí hoy. Si se toca ese archivo en el futuro y se renombra la key, actualizar acá también.

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/auth/login-form.tsx
```

Comando sugerido: `git commit -m "Conecta el merge de carrito de invitado al login de customer"`

---

### Tarea 25: Página de historial de pedidos del cliente

**Files:**
- Create: `apps/web/src/app/[locale]/account/orders/page.tsx`

**Interfaces:**
- Consumes: `auth` de `@/auth` (Tarea 4), `DrizzleOrderRepository.listByCustomerId` (Tarea 12).

- [ ] **Step 1: Implementar la página**

```tsx
// apps/web/src/app/[locale]/account/orders/page.tsx
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { DrizzleOrderRepository } from "@workspace/db/repositories";

export default async function AccountOrdersPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");

  const session = await auth();
  if (!session) {
    redirect({ href: { pathname: "/login", query: { callbackUrl: "/account/orders" } }, locale });
  }

  const orders = await new DrizzleOrderRepository().listByCustomerId(session.user.id);

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
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
    </main>
  );
}
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/[locale]/account"
```

Comando sugerido: `git commit -m "Agrega el historial de pedidos del cliente"`

---

### Tarea 26: Verificación end-to-end

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Typecheck completo**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 2: Suite completa de tests**

Run: `pnpm run test`
Expected: todos los tests de `packages/domain`, `packages/db` e `packages/i18n` en verde, incluyendo los nuevos de `authenticateUser`, `listOrders`, y los métodos nuevos de `DrizzleOrderRepository`/`DrizzleUserRepository`.

- [ ] **Step 3: Build completo**

Run: `pnpm run build`
Expected: build de `apps/web` exitoso.

- [ ] **Step 4: Smoke test manual — login de customer, historial, merge de carrito**

Con `pnpm --filter @workspace/web run dev` corriendo:
1. Como invitado (sin loguearse), agregar 2 productos al carrito.
2. Ir a `/register`, crear una cuenta con un email identificable (ej. `qa-fase4-customer@example.com`).
3. Confirmar redirect a `/account/orders` (vacío, todavía sin pedidos) y que el carrito de invitado sigue teniendo los 2 productos (el merge no debería haber perdido nada — no había carrito server-side previo, así que `mergeGuestCart` usa los items de invitado tal cual).
4. Hacer logout, volver a loguearse con las mismas credenciales — confirmar que sigue funcionando.
5. Borrar el usuario de prueba de `users` (y cualquier `cart`/`cart_items` que haya generado) de la DB compartida dev=prod al terminar.

- [ ] **Step 5: Smoke test manual — revocación de sesión**

Loguearse como el customer de prueba del Step 4 (antes de borrarlo). En otra pestaña/sesión de DB, marcar `is_active = false` para ese usuario. Recargar cualquier página protegida (`/account/orders`) — debe expulsar a la sesión (redirect a login) sin esperar a que expire el JWT de 7 días. Revertir `is_active = true` o borrar el usuario de prueba al terminar.

- [ ] **Step 6: Commit**

Si esta tarea no modificó ningún archivo de código (solo verificó), no hay nada que commitear — pasar directamente a la Tarea 27.

---

### Tarea 27: Actualizar `CLAUDE.md` y `handoff.md`

**Files:**
- Modify: `CLAUDE.md`
- Modify: `handoff.md`

- [ ] **Step 1: Actualizar `CLAUDE.md`**

En **Run & Operate**, agregar:

```
- Para sembrar el primer admin: `ADMIN_SEED_EMAIL=... ADMIN_SEED_PASSWORD=... pnpm --filter @workspace/db run seed` — sin estas variables, el seed sigue corriendo normal pero no crea/actualiza ningún admin.
```

En **Architecture decisions**, agregar:

```
- **Autenticación (Fase 4):** Auth.js v5 (`next-auth@beta`), Credentials provider, sesión JWT (no database sessions — el Credentials provider de Auth.js no persiste sesión en DB por diseño, confirmado en la doc oficial; combinarlo con database sessions requeriría un workaround no oficial). Revocación vía re-consulta de `users.is_active` en el callback `jwt` en cada request — mismo patrón que la revocación ya decidida para mobile. `passwordHash` vive en la tabla `users` existente (mismo patrón que `pin_hash`). Sin `@auth/drizzle-adapter` — no hace falta con JWT-only + un solo provider Credentials.
```

En **Gotchas**, agregar:

```
- El middleware combinado (`apps/web/src/middleware.ts`) envuelve `createMiddleware(routing)` de next-intl dentro de `auth((req) => {...})` de Auth.js — no hay un ejemplo oficial único que combine ambas librerías; es la composición de los dos patrones documentados por separado. Si se toca este archivo, re-verificar manualmente los tres casos de la Tarea 7 de Fase 4 (sitio público, `/admin` sin sesión, `/es/admin` sin sesión) antes de dar el cambio por bueno.
- La revocación de sesión vive en el callback `jwt`, no en `session` — retornar `null` desde `session` no es un mecanismo soportado por Auth.js (hay un issue abierto pidiéndolo), retornar `null` desde `jwt` sí lo es.
```

- [ ] **Step 2: Reescribir `handoff.md`**

Actualizar **Objetivo** y **Estado actual** para reflejar Fase 4, agregar la sección de **Archivos y cambios** de esta fase, sumar los intentos fallidos que hayan surgido durante la ejecución real (numerados a continuación del último de Fase 3), y actualizar **Próximos pasos**: rotar `ADMIN_SEED_PASSWORD` si se compartió en texto plano durante el diagnóstico de algún incidente, y arrancar Fase 5 (inventario y calendario del trailer) solo cuando el owner lo pida explícitamente.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md handoff.md
```

Comando sugerido: `git commit -m "Documenta la Fase 4 en CLAUDE.md y handoff.md"`

---

### Tarea 28: Deploy a producción

**Files:** ninguno (operación de deploy)

- [ ] **Step 1: Push**

El owner ejecuta `git push` manualmente (Claude no lo hace por su cuenta).

- [ ] **Step 2: Declarar `AUTH_SECRET` en EasyPanel (obligatorio, a diferencia de dev)**

Declarar `AUTH_SECRET` (mismo valor generado en la Tarea 4, o uno nuevo generado igual con `openssl rand -base64 32` — no tiene que coincidir con el de dev) como variable de **runtime** del servicio `apps/web` en EasyPanel. A diferencia de `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`/`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, esta no es `NEXT_PUBLIC_*`, así que no hace falta declararla como `ARG`/`ENV` de build en el `Dockerfile` — alcanza con declararla como variable de entorno de runtime del servicio (Auth.js la lee al procesar cada request, no al buildear). Sin esta variable, Auth.js falla explícitamente en producción (a diferencia de dev, donde autogenera un secret temporal con un warning).

`ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` no son variables de runtime de `apps/web` — son solo para el comando de seed, que se corre manualmente una vez contra la DB de producción (misma DB compartida dev=prod), no hace falta declararlas en EasyPanel.

- [ ] **Step 3: Verificar el log de build y el sitio real**

Confirmar en el log de EasyPanel que el build pasa limpio, y verificar en `https://sweetsin.com.au/` que: `/login` carga, el admin sembrado puede loguearse y ver `/admin/orders` con órdenes reales, y que el checkout de invitado (Fase 3) sigue funcionando sin cambios.

---
