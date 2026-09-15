# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/web run dev` — run the Next.js 15 app (sitio público + panel admin). Scaffold vacío hasta Fase 2.
- `pnpm --filter @workspace/web-legacy run dev` — run the discarded Vite prototype (reference only, not deployed).
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm run test` — Vitest suite across `packages/domain` and `packages/db` (the latter needs `packages/db/.env` with `DATABASE_URL` — hits the real Postgres instance)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run seed` — carga/actualiza el contenido real de `products` y `trailer_stops` (idempotente; no crea duplicados)
- `pnpm run deploy:migrate` — frozen install + DB schema push (run on deploy)
- Required env: `DATABASE_URL` — Postgres connection string (`packages/db/.env`, gitignored). `apps/web-legacy` also needs `PORT`/`BASE_PATH` in its own `.env` if you run it. `apps/web` needs its own copy of `DATABASE_URL` **and** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `apps/web/.env.local` (gitignored) — Next.js doesn't read `packages/db/.env`, and `next build`/`next dev` fail as soon as any Server Component imports `@workspace/db/repositories` without it.
- Variables de Stripe pendientes de credenciales reales: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (`apps/web/.env.local`) y `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — sin ellas, el checkout de invitado (pickup/self-delivery, pago vía WhatsApp) funciona igual; el pago con tarjeta responde explícitamente "not available yet", nunca simula un pago exitoso.
- Para sembrar el primer admin: `ADMIN_SEED_EMAIL=... ADMIN_SEED_PASSWORD=... pnpm --filter @workspace/db run seed` — sin estas variables, el seed sigue corriendo normal pero no crea/actualiza ningún admin.

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
- `packages/i18n` — diccionarios ES/EN framework-free (sin lógica de UI, sin `next-intl`). Consumidos como `messages` de `next-intl` en `apps/web`; se reutilizan tal cual (los datos, no `next-intl`) en el panel admin (Fase 4) y en `apps/mobile` (Fase 7, con su propio adaptador nativo).
- `packages/db` — schemas de Drizzle, migraciones, instancia de conexión a Postgres, script de seed (`src/seed.ts`)
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
- **i18n:** `packages/i18n` solo expone diccionarios framework-free (datos puros). `apps/web` los consume con `next-intl` y routing por locale: `en` (default) en la raíz limpia `/` sin prefijo ni redirect (`localePrefix: "as-needed"`, preserva el link equity del dominio), `es` explícito en `/es` — decisión del owner (2026-09-12) por SEO bilingüe indexable (URLs y `hreflang` propios por idioma) y por aprovechar el SSR de los Server Components de Next 15, en vez de un Context client-side con `localStorage`. `apps/mobile` (Fase 7) no usa `next-intl` — consume los mismos diccionarios de `packages/i18n` con su propio adaptador nativo.
- **Carrito y checkout (Fase 3):** carrito de invitado 100% en `localStorage` (sin cuenta, `orders.customerId = null`); `CartRepository`/`syncCart`/`mergeGuestCart` server-side construidos y probados desde ya, pero sin ningún flujo de UI que los invoque todavía — se conectan en Fase 4 cuando exista sesión real de Auth.js. El fee de self-delivery vive en la tabla `settings` (fila única, no una constante en código) para poder editarse desde el panel admin sin tocar el dominio.
- **Autenticación (Fase 4):** Auth.js v5 (`next-auth@beta`), Credentials provider, sesión JWT (no database sessions — el Credentials provider de Auth.js no persiste sesión en DB por diseño, confirmado en la doc oficial; combinarlo con database sessions requeriría un workaround no oficial). Revocación vía re-consulta de `users.is_active` en el callback `jwt` en cada request — mismo patrón que la revocación ya decidida para mobile; además `authenticateUser` ya rechaza el login desde el inicio si `isActive` es `false`, no solo revoca sesiones ya activas. `passwordHash` vive en la tabla `users` existente (mismo patrón que `pin_hash`). Sin `@auth/drizzle-adapter` — no hace falta con JWT-only + un solo provider Credentials. Config partida en `auth.config.ts` (edge-safe, sin DB, con `trustHost: true`) + `auth.ts` (Node.js runtime, con el provider Credentials y la revalidación por DB) — ver Gotchas.
- **Merge de carrito de invitado (Fase 4):** `mergeCartOnLoginAction` solo está conectado al flujo de **login** (`login-form.tsx`), no al de **registro** (`register-form.tsx` hace login automático tras registrarse, pero nunca llama al merge). No es un bug funcional hoy — el checkout sigue siendo 100% de invitado vía `localStorage`, así que nada se pierde — pero si en el futuro el checkout empieza a depender del carrito server-side, conectar el merge también al registro.

## Product

Sitio público bilingüe de Sweet Sin (inglés en la raíz `/`, español en `/es`): hero, catálogo de 16 postres reales (paradas y precios desde Postgres), historia de marca, ubicaciones activas del trailer con mapa en vivo, un formulario de cotización de eventos que persiste la solicitud real, y carrito + checkout de invitado (pickup/self-delivery, pago vía WhatsApp funcional de punta a punta; pago con tarjeta scaffoldeado con Stripe, pendiente de credenciales reales). Cuenta de cliente (login/registro/historial de pedidos) y panel admin de órdenes (tabla con filtros/búsqueda, cambio de `fulfillmentStatus`/`paymentStatus`) ya funcionan de punta a punta, protegidos con Auth.js.

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
- `packages/db/src/seed.ts` importa `./index`/`./schema` de forma dinámica (`await import(...)` dentro de `main()`), no estática — los imports de un módulo ES se hoistean por encima de cualquier otra sentencia, así que un `process.loadEnvFile()` puesto arriba de un import estático de `./index` no llega a correr antes de que ese import se evalúe (y reviente por falta de `DATABASE_URL`). Mismo síntoma que el gotcha de Vitest de más arriba, fix distinto porque acá no hay un archivo de config separado donde cargar el `.env` antes.
- GSAP `SplitText` (usado en `Hero`/`BrandStory`) mete sus propios `<span>` en el DOM del título de forma imperativa. El toggle de idioma navega a otra URL de locale y ese texto se re-renderiza — el elemento afectado por `SplitText` lleva `key={locale}` para forzar un remount limpio en vez de dejar que React reconcilie el nuevo texto contra un DOM que GSAP ya mutó por su cuenta.
- `videologo.gif` e `isotipo.gif` se sirven con `<img>` plano, no `next/image` — `next/image` optimiza GIFs a un frame estático salvo que se pase `unoptimized`, y ambos llevan además una animación GSAP propia sobre su `ref`.
- Next.js 16 renombró `middleware.ts` a `proxy.ts` — este proyecto está pineado a Next `^15.5.0`, así que el archivo correcto sigue siendo `apps/web/src/middleware.ts`. Si se sube la versión de Next en el futuro, revisar la guía de migración de `next-intl` antes de renombrarlo.
- `@types/*` exclusivos de un solo paquete (ej. `@types/google.maps`, solo usado en `apps/web`) no se auto-incluyen en TypeScript dentro de este monorepo pnpm — pnpm hoistea a la raíz los `@types` compartidos entre paquetes (`react`, `node`), pero uno exclusivo queda aislado en `apps/web/node_modules/@types/` y el auto-discovery de `tsc` no lo alcanza ahí. Fix: `/// <reference types="..." />` explícito en `apps/web/src/global.d.ts` — nunca declarar `compilerOptions.types` a mano, porque eso apaga el auto-include para todo lo demás (react/react-dom incluidos).
- Cualquier página bajo `app/[locale]/` que haga fetch a Postgres (`Menu`, `FindUs`) necesita `export const dynamic = "force-dynamic"` — sin eso, `generateStaticParams()` en el layout hace que `next build` intente pre-renderizar la página como HTML estático, ejecutando esas queries contra la DB real *en build time* y congelando los datos hasta el próximo deploy (y fallando el build si la DB no es alcanzable en ese momento). Verificar con el manifiesto real (`.next/prerender-manifest.json`), no con el símbolo `●`/`○` de la tabla resumen de `next build` — ese símbolo solo indica si la ruta usa `generateStaticParams()`, no si el contenido quedó congelado.
- `PaymentGateway.createPaymentIntent` recibe `metadata: Record<string, string>` — el webhook de Stripe (`apps/web/src/app/api/webhooks/stripe/route.ts`) depende de que `metadata.orderId` viaje en el PaymentIntent para saber qué orden confirmar; si se crea un PaymentIntent por otra vía sin ese metadata, el webhook no tiene forma de vincularlo a una orden.
- El middleware (`apps/web/src/middleware.ts`) corre en el Edge Runtime, que no soporta el módulo `crypto` de Node — `pg` (el driver de Postgres) lo usa internamente. Por eso Auth.js está partido en dos archivos: `auth.config.ts` (edge-safe, sin providers ni callbacks con DB — de acá el middleware construye su propia instancia de `NextAuth()`) y `auth.ts` (extiende `authConfig` con el provider Credentials + revalidación de `is_active`, usado solo en Route Handlers/Server Components/Server Actions, runtime Node.js). Si se toca cualquiera de los dos, re-verificar manualmente que el middleware sigue combinando bien con `next-intl` (sitio público, `/admin` sin sesión, `/es/admin` sin sesión) antes de dar el cambio por bueno.
- `trustHost: true` es obligatorio en `auth.config.ts` en cualquier deploy que no sea Vercel (EasyPanel acá). Sin esto, Auth.js no confía en el host de la request y puede fallar en silencio al persistir la cookie de sesión — el login "funciona" (la Server Action devuelve el rol correctamente) pero nunca queda ninguna cookie `authjs.*` en el navegador, sin lanzar ningún `AuthError` capturable. Síntoma: el botón de login queda en estado "cargando" para siempre y la navegación a `/admin` rebota de vuelta a `/login`.

## Deploy (EasyPanel)

> ⚠️ Topología provisoria post-Fase 1, a rediseñar en Fase 8: `apps/api` ya no existe (su servicio en EasyPanel debe pausarse/eliminarse manualmente — el build va a seguir fallando con "open Dockerfile: no such file or directory" hasta que se haga). `apps/web-legacy` (el viejo prototipo Vite) conserva su `Dockerfile` pero ya no se deploya.

- `apps/web/Dockerfile` → Next.js. Build context = repo root. Runtime temporal con `next start` (reutiliza el stage de build) en vez de `output: "standalone"` — se optimiza cuando se revise la topología completa en Fase 8. Sirve el scaffold vacío hasta Fase 2.
- Postgres: managed by EasyPanel (separate service in the same project).
- No CI/tests configured yet — verify with `pnpm run typecheck`, `pnpm run test` and `pnpm run build` before deploying.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- No mockup-sandbox / scripts packages — removed as non-essential to the deployable app
