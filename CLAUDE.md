# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/web run dev` — run the Next.js 15 app (sitio público + panel admin). Scaffold vacío hasta Fase 2.
- `pnpm --filter @workspace/web-legacy run dev` — run the discarded Vite prototype (reference only, not deployed).
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm run test` — Vitest suite across `packages/domain` and `packages/db` (the latter needs `packages/db/.env` with `DATABASE_URL` — hits the real Postgres instance)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm run deploy:migrate` — frozen install + DB schema push (run on deploy)
- Required env: `DATABASE_URL` — Postgres connection string (`packages/db/.env`, gitignored). `apps/web-legacy` also needs `PORT`/`BASE_PATH` in its own `.env` if you run it.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web: **Next.js 15** (sitio público + panel admin) — reemplaza el prototipo Vite + React
- Arquitectura: **Hexagonal estricta** (Puertos y Adaptadores) — ver Architecture decisions
- DB: PostgreSQL + Drizzle ORM (`packages/db`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Notificaciones: transporte nativo (SMTP propio / Expo Notifications) — **sin proveedores de terceros tipo Resend**
- Mobile (Fase 7, hito separado): Expo — apps de despachador/delivery con login por PIN
- Testing: Vitest en `packages/domain` (obligatorio) y `packages/db` (integración contra DB real)
- ~~API: Express 5~~ / ~~API codegen: Orval (from OpenAPI spec)~~ — descartados y eliminados en Fase 1

## Where things live

- `apps/web` — **Next.js 15**: sitio público + panel admin. Actúa como adaptador de entrada/salida del núcleo hexagonal (Server Actions / Route Handlers inyectando repositorios de `packages/db` en los casos de uso de `packages/domain`). Scaffold vacío hasta Fase 2.
- `apps/web-legacy` — prototipo Vite + React descartado, mantenido solo como referencia visual/de copy durante la migración. No se deploya más. Se elimina en Fase 8.
- `apps/mobile` — *(planeado, Fase 7, hito separado)* Expo — apps de despachador/delivery
- `packages/domain` — núcleo hexagonal: entidades, puertos (interfaces) y casos de uso en TypeScript puro. Cero imports de Next.js, Drizzle, Stripe, Expo, etc.
- `packages/db` — schemas de Drizzle, migraciones, instancia de conexión a Postgres
- `packages/notifications` — adaptadores de notificaciones 100% nativos (SMTP propio, Expo Push) — sin servicios de terceros. Esqueleto vacío hasta Fase 6.
- `attached_assets/` — reference material (logos, prompts, design system docs); not wired into the build

## Architecture decisions

- **Migración de stack (decisión de owner, congelada):** el prototipo original (Vite + React en `apps/web`, Express 5 en `apps/api`, contrato OpenAPI + Orval) se trató como descartable. El stack definitivo es Next.js 15 + Arquitectura Hexagonal estricta. `apps/api` y el pipeline Orval/OpenAPI se eliminaron por completo en Fase 1; el prototipo Vite quedó como referencia en `apps/web-legacy` hasta Fase 8.
- **Hexagonal estricta:** `packages/domain` contiene entidades, puertos y casos de uso en TypeScript puro — cero dependencias de framework, DB o proveedores externos. Motivo: el motor de reglas de negocio (descuentos por volumen, stock, estados de pedido) necesita máxima testabilidad aislada y reutilización entre superficies (web, mobile, webhooks).
- **Roles y autenticación:** `users.role` enum (`admin | despachador | delivery | customer`), sin tablas de permisos granulares — autorización vía guards por rol a nivel de endpoint. Web: `admin` en `/admin/*`, `customer` vía Auth.js. Mobile (Expo, Fase 7): `despachador`/`delivery` autenticados por PIN de 6 dígitos (hash bcrypt/argon2) + validación de integridad del cliente (Play Integrity/DeviceCheck o HMAC de build) + rate limiting, con JWT de sesión de TTL corto revocable vía `is_active`.
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
    español, un solo resumen de una línea (subject; nunca cuerpo/descripción
    ni líneas en blanco debajo), y jamás con firmas (`Co-Authored-By`,
    `Claude-Session`) ni metadata de IA.
  - Ejemplo: `git commit -m "Documenta migración de stack a Next.js 15 y arquitectura hexagonal"`
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
- **Idioma y formato de razonamiento (no negociable):** absolutamente todo
  el procesamiento de Claude va en español — **sin excepción, incluido el
  bloque de pensamiento/thinking extendido que el cliente muestra en la
  UI**, no solo la respuesta visible final. Toda explicación previa a
  ejecutar comandos, leer archivos o escribir código sigue esta estructura
  de 4 pasos:
  1. **Evaluación de Impacto** — qué archivos, interfaces, dependencias y
     flujos de UI/UX se ven afectados por el requerimiento actual.
  2. **Resolución de Conflictos** — cómo se integra el cambio con la
     arquitectura existente (acoplamientos, manejo de estado,
     refactorización de interfaces, mutaciones de DOM a evitar, etc.).
  3. **Mentoría Técnica** — el *porqué* de la decisión: patrones de diseño
     aplicados, buenas prácticas, o cómo funciona internamente la
     herramienta/framework en juego (ej. por qué Server Component vs
     Client Component acá, cómo resuelve Drizzle esta query). El objetivo
     es que el usuario aprenda mientras se desarrolla — actuar como un
     Tech Lead guiando a un developer, no solo como un ejecutor de tareas.
  4. **Plan de Acción** — pasos exactos de implementación y herramientas a
     invocar.
  Mantener rigor técnico de Senior Software Engineer con la claridad de un
  buen mentor.
- Si alguna de estas reglas está por violarse (p. ej. a punto de firmar un
  commit, o de crear una función que ya existe en otro archivo), detenerse
  y avisar en vez de proceder.

## Gotchas

- `packages/db/drizzle.config.ts` must use a plain relative string (`"./src/schema/index.ts"`) for `schema`, never `path.join(__dirname, ...)` — on Windows that produces backslashes, and drizzle-kit's internal glob doesn't match them, failing with "No schema files found" even though the file exists.
- Vitest doesn't auto-load `.env` the way `drizzle-kit` does — `packages/db/vitest.config.ts` calls `process.loadEnvFile()` before anything imports `../index` (which throws immediately if `DATABASE_URL` is missing).
- `apps/web`'s `tsconfig.json` gets auto-patched by `next build`/`next dev` (adds `allowJs`, `strict: false`, `esModuleInterop`) — harmless here since `tsconfig.base.json` already pins the individual strict-family flags explicitly (those always win over the `strict` umbrella regardless of which file sets them), but don't be surprised by the diff.
- `apps/web-legacy/vite.config.ts` still requires `PORT` and `BASE_PATH` at runtime (throws if missing) — only matters if you run it locally for reference; it's not deployed.
- Dev and production currently point at the **same** Postgres instance (EasyPanel-managed, on the VPS) — there is no separate local/dev database. Be careful running destructive Drizzle commands (`push --force`) locally.

## Deploy (EasyPanel)

> ⚠️ Topología provisoria post-Fase 1, a rediseñar en Fase 8: `apps/api` ya no existe (su servicio en EasyPanel debe pausarse/eliminarse manualmente — el build va a seguir fallando con "open Dockerfile: no such file or directory" hasta que se haga). `apps/web-legacy` (el viejo prototipo Vite) conserva su `Dockerfile` pero ya no se deploya.

- `apps/web/Dockerfile` → Next.js. Build context = repo root. Runtime temporal con `next start` (reutiliza el stage de build) en vez de `output: "standalone"` — se optimiza cuando se revise la topología completa en Fase 8. Sirve el scaffold vacío hasta Fase 2.
- Postgres: managed by EasyPanel (separate service in the same project).
- No CI/tests configured yet — verify with `pnpm run typecheck`, `pnpm run test` and `pnpm run build` before deploying.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- No mockup-sandbox / scripts packages — removed as non-essential to the deployable app
