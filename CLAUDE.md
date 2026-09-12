# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

> ⚠️ **En transición de stack** (ver Architecture decisions). Los comandos de abajo son del prototipo Vite/Express, vigentes hasta ejecutar la migración a Next.js 15 — se reemplazan cuando el nuevo scaffold esté armado.

- `pnpm --filter @workspace/web run dev` — run the frontend (Vite) — *prototipo, a reemplazar*
- `pnpm --filter @workspace/api run dev` — run the API server (port 5000) — *prototipo, a reemplazar*
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm run deploy:migrate` — frozen install + DB schema push (run on deploy)
- Required env: `DATABASE_URL` — Postgres connection string, `PORT`, `BASE_PATH` (frontend) — *válido solo para el prototipo Vite/Express*

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web: **Next.js 15** (sitio público + panel admin) — reemplaza el prototipo Vite + React
- Arquitectura: **Hexagonal estricta** (Puertos y Adaptadores) — ver Architecture decisions
- DB: PostgreSQL + Drizzle ORM (`packages/db`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Notificaciones: transporte nativo (SMTP propio / Expo Notifications) — **sin proveedores de terceros tipo Resend**
- Mobile (Fase 1, hito separado): Expo — apps de despachador/delivery con login por PIN
- Build: esbuild (CJS bundle) — aplica mientras exista código del stack anterior
- ~~API: Express 5~~ / ~~API codegen: Orval (from OpenAPI spec)~~ — descartados, ver Architecture decisions

## Where things live

- `apps/web` — **Next.js 15**: sitio público + panel admin. Actúa como adaptador de entrada/salida del núcleo hexagonal (Server Actions / Route Handlers inyectando repositorios de `packages/db` en los casos de uso de `packages/domain`)
- `apps/mobile` — *(planeado, Fase 1, hito separado)* Expo — apps de despachador/delivery
- `packages/domain` — núcleo hexagonal: entidades, puertos (interfaces) y casos de uso en TypeScript puro. Cero imports de Next.js, Drizzle, Stripe, Expo, etc.
- `packages/db` — schemas de Drizzle, migraciones, instancia de conexión a Postgres
- `packages/notifications` — adaptadores de notificaciones 100% nativos (SMTP propio, Expo Push) — sin servicios de terceros
- `attached_assets/` — reference material (logos, prompts, design system docs); not wired into the build
- ⚠️ `apps/api` (Express) y `lib/api-spec` / `lib/api-zod` / `lib/api-client-react` (pipeline Orval/OpenAPI) — **prototipo descartado**, pendiente de eliminación en la fase de implementación

## Architecture decisions

- **Migración de stack (decisión de owner, congelada):** el prototipo original (Vite + React en `apps/web`, Express 5 en `apps/api`, contrato OpenAPI + Orval) se trata como descartable. El stack definitivo es Next.js 15 + Arquitectura Hexagonal estricta. El código viejo se elimina/reescribe durante la implementación, no antes de aprobar el spec/plan.
- **Hexagonal estricta:** `packages/domain` contiene entidades, puertos y casos de uso en TypeScript puro — cero dependencias de framework, DB o proveedores externos. Motivo: el motor de reglas de negocio (descuentos por volumen, stock, estados de pedido) necesita máxima testabilidad aislada y reutilización entre superficies (web, mobile, webhooks).
- **Roles y autenticación:** `users.role` enum (`admin | despachador | delivery | customer`), sin tablas de permisos granulares — autorización vía guards por rol a nivel de endpoint. Web: `admin` en `/admin/*`, `customer` vía Auth.js. Mobile (Expo, Fase 1): `despachador`/`delivery` autenticados por PIN de 6 dígitos (hash bcrypt/argon2) + validación de integridad del cliente (Play Integrity/DeviceCheck o HMAC de build) + rate limiting, con JWT de sesión de TTL corto revocable vía `is_active`.
- **Ciclo de vida de una orden:** `payment_status` (`pending|paid|failed|refunded`) y `fulfillment_status` (`pending|received|in_prep|ready_for_pickup|out_for_delivery|delivered|cancelled`) son campos independientes — el pago (gestionado vía webhooks de Stripe) nunca se mezcla con el estado de preparación/entrega. Solo `paid` + `received` entran a la cola activa del despachador.
- **Fulfillment:** pickup + self-delivery (fee fijo). Courier/Uber Direct queda fuera de alcance por ahora.
- **Pagos:** Stripe real (PaymentIntent + webhook) es la decisión congelada, aunque las credenciales todavía no están disponibles — se construye listo para conectar, sin mockear el flujo en silencio.
- **Notificaciones:** sin proveedores de terceros (explícitamente sin Resend). Emails transaccionales por SMTP propio; push a mobile vía Expo Notifications. Vive en `packages/notifications`.

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

- **Reutilización y minimalismo (no negociable):** antes de crear cualquier
  util/helper/componente/lógica nueva, revisar el codebase existente para
  evitar duplicar funciones, tipos, schemas o estilos. Escribir solo el
  código estrictamente necesario — sin abstracciones especulativas,
  optimizaciones prematuras ni boilerplate innecesario.
- **MCP tools:** no lanzar ni conectar el Chrome DevTools MCP salvo que el
  usuario lo pida explícitamente. Priorizar inspección por terminal,
  análisis estático, linting, logs y tests unitarios.
- **Reglas de commits de git (no negociable):**
  - Claude nunca ejecuta `git commit` por su cuenta — solo hace `git add`
    de los archivos relevantes y sugiere en el chat el comando exacto de
    commit para que el usuario lo ejecute manualmente en su terminal.
  - Los mensajes de commit que Claude sugiera van exclusivamente en
    inglés, un solo resumen de una línea (subject; nunca cuerpo/descripción
    ni líneas en blanco debajo), y jamás con firmas (`Co-Authored-By`,
    `Claude-Session`) ni metadata de IA.
  - Ejemplo: `git commit -m "chore: update CLAUDE.md with Next.js 15 and Hexagonal architecture"`
- **Estrategia de branching (no negociable):** trabajar directamente sobre
  `main`. No crear branches de feature, no abrir Pull Requests, no
  preguntar si abrir uno. Nunca cambiar ni crear branches
  (`git checkout -b`, `git branch`, etc.) sin pedido explícito del usuario.
  Commitear seguido, directo en `main`.
- **Cierre de sesión / handoff:** antes de cerrar o terminar una sesión de
  trabajo, generar o actualizar `handoff.md` en la raíz del proyecto con
  exactamente estas 5 secciones: Objetivo, Estado actual, Archivos y
  cambios, Intentos fallidos (nunca borrar entradas previas, solo agregar),
  Próximos pasos.
- Si alguna de estas reglas está por violarse (p. ej. a punto de firmar un
  commit, o de crear una función que ya existe en otro archivo), detenerse
  y avisar en vez de proceder.

## Gotchas

> ⚠️ Las siguientes notas describen el **prototipo Vite/Express**, superseded por la migración a Next.js 15 — se reemplazan cuando el nuevo scaffold esté armado:
- `apps/web/vite.config.ts` and `apps/api` both require `PORT` at runtime (and `apps/web` also requires `BASE_PATH`) — they throw if missing. Local dev reads them from each app's `.env` (gitignored); production (EasyPanel) sets them as real container env vars, no `.env` file needed (`--env-file-if-exists` / Vite's `loadEnv` both no-op if the file is absent).
- `BASE_PATH` is baked into the built frontend assets' URLs at build time (Vite `base`) — it must match the path the app is actually served from in prod (`/` unless served under a subpath).
- `lib/db`, `lib/api-zod`, `lib/api-client-react` export raw `.ts` source (no build step) — consumed directly by Vite/esbuild via workspace linking.

Sigue vigente con el nuevo stack:
- Dev and production currently point at the **same** Postgres instance (EasyPanel-managed, on the VPS) — there is no separate local/dev database. Be careful running destructive Drizzle commands (`push --force`) locally.

## Deploy (EasyPanel)

> ⚠️ Topología pendiente de rediseño: la migración a Next.js 15 probablemente colapsa `apps/api` (Express) dentro de `apps/web`, y sumará un servicio/pipeline propio para `apps/mobile` (Expo) en su hito correspondiente. Lo de abajo describe la topología del prototipo, a revisar durante la implementación.

- Two services, each built from this repo with **build context = repo root**, not the app subfolder:
  - `apps/api/Dockerfile` → backend. Env vars: `DATABASE_URL`, `PORT` (5000), `NODE_ENV=production`.
  - `apps/web/Dockerfile` → frontend, built to static files and served by nginx. Build arg `BASE_PATH` (defaults to `/`).
- Postgres: managed by EasyPanel (separate service in the same project) — sigue vigente con el nuevo stack.
- No CI/tests configured yet — verify with `pnpm run typecheck` before deploying.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- No mockup-sandbox / scripts packages — removed as non-essential to the deployable app
