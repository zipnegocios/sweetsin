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
- Variables de SMTP pendientes de credenciales reales: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (`apps/web/.env.local`) — sin ellas, el checkout y la cotización de evento funcionan igual; cada intento de envío queda registrado en `email_logs` con `status: "blocked"`, nunca simula un envío exitoso.
- Variables de la API mobile (Fase 7): `MOBILE_JWT_SECRET` (`apps/web/.env.local`) — sin ellas, los Route Handlers de `/api/mobile/**` lanzan al arrancar en vez de operar con un secreto por defecto inseguro.
- Variables de R2 (evidencia de entrega, Cloudflare, bucket privado) pendientes de credenciales reales: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` y opcional `R2_DELIVERY_EVIDENCE_PREFIX` (default `delivery-evidence/`) en `apps/web/.env.local` — solo servidor, nunca `NEXT_PUBLIC_*`. Sin ellas, los endpoints `/api/mobile/orders/[id]/evidence` y `.../evidence/upload-url` responden 503 `{ "error": "Delivery evidence storage is not configured yet." }`, nunca simulan una subida exitosa; el resto de la app funciona igual.
- Variable de Google Routes (ruta y ETA con tráfico para el delivery) pendiente de credenciales reales: `GOOGLE_ROUTES_API_KEY` (`apps/web/.env.local`) — solo servidor, nunca `NEXT_PUBLIC_*`, y distinta de `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` de la web (clave propia con Routes API habilitada). Sin ella, `GET /api/mobile/orders/[id]/route` responde 503 `{ "error": "Routes service is not configured yet." }`, nunca simula una ruta; el resto de la app funciona igual. Cada cálculo con tráfico (`TRAFFIC_AWARE`) es una llamada paga a Google Maps Platform; el costo se acota con una caché de servidor de 60 s por destino + origen redondeado a ~100 m (en memoria del proceso).
- Build de desarrollo permanente de la app mobile (`expo-dev-client`, variante `APP_VARIANT=development`: nombre "Sweet Sin Staff (Dev)", package `au.com.sweetsin.staff.dev`, fondo de ícono dorado `#B8872B`; `apps/mobile/app.config.ts` parte de `app.json` y sin la variable lo devuelve intacto): se genera con el workflow manual `.github/workflows/build-dev-apk.yml` (`./gradlew assembleDebug`, firmado con la clave de debug de Gradle, sin secretos; artefacto `sweetsin-staff-dev-<run_number>`). Para iterar con recarga en vivo: `APP_VARIANT=development npx expo start --dev-client` desde `apps/mobile` (agregar `--tunnel` si el teléfono no está en la misma red; `@expo/ngrok` ya es devDependency). **Este build nunca debe llegar a un repartidor real**: la app queda rota porque intenta conectarse a un bundler que no existe. Mantenimiento: cada vez que se agregue un módulo nativo (cámara, GPS, SQLite, mapas, tareas en segundo plano) hay que **recompilar el build de desarrollo una vez** para que lo incluya. El workflow de release (`build-apk.yml`) falla si su APK contiene `expo.modules.devlauncher` o `expo.modules.devmenu`.
- Release firmada de la APK de staff: workflow manual `.github/workflows/build-apk.yml` (`workflow_dispatch`; corre typecheck y tests como compuerta, `versionCode` = `run_number`, artefacto `sweetsin-staff-<run_number>`). Secretos de GitHub requeridos: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (el build falla si falta el keystore) y `GOOGLE_MAPS_ANDROID_API_KEY` (clave de Maps SDK for Android restringida por package + SHA-1; si falta, el build avisa con un warning y el mapa de la ruta no carga). El mismo `GOOGLE_MAPS_ANDROID_API_KEY` lo usa `build-dev-apk.yml` (el build de desarrollo, que por lo demás no necesita secretos); `app.config.ts` lo lee de `process.env` al generar el manifiesto. Cada run sube `versionCode`: nunca reinstalar encima un APK de un run anterior firmado con otro keystore.
- Modo offline del delivery (`apps/mobile/src/offline/`): la lista de órdenes asignadas se cachea en SQLite y "Marcar entregada" se encola como comando (`CommandStore` + `flushQueue`) en vez de fallar sin red; al recuperar conexión se reenvía solo, de forma idempotente (`markOrderDelivered` no duplica). Una orden con comando pendiente muestra "pendiente de sincronizar" con ícono + texto (nunca solo color). El emisor (`offline/deliver-sender.ts`) trata 408, 429, 5xx y errores de red como reintento sin descartar el comando; los conflictos de dominio se muestran al usuario.
- Evidencia de entrega (foto + GPS, **opcional**): la app sube la foto directo al bucket privado de R2 con URL prefirmada (`POST /api/mobile/orders/[id]/evidence/upload-url`) y luego registra clave, fecha y coordenadas (`.../evidence`; columnas `delivery_evidence_*` en `orders`). El flag `deliveryEvidenceRequired` (tabla `settings`, hoy `false`) lo expone `GET /api/mobile/orders/assigned` y la app lo respeta; el endpoint de registro **no** hace HEAD del objeto, así que verificar en dispositivo que lo subido no quede vacío. Negar cámara o ubicación avisa y deja "Marcar entregada" funcionando. Prefijo configurable con `R2_DELIVERY_EVIDENCE_PREFIX`; retención 7 días (ampliable a 30), pendiente de confirmación legal.
- Mapas, ETA y seguimiento (delivery): `GET /api/mobile/orders/[id]/route` (solo para el delivery asignado; ver `GOOGLE_ROUTES_API_KEY` arriba) alimenta el mapa (`react-native-maps`, polilínea decodificada en la app) y el ETA, que se calcula solo para la orden seleccionada y solo si el permiso de ubicación en primer plano ya está concedido ("Ver ruta" lo pide al tocarse). "Iniciar turno" (con consentimiento) activa el seguimiento: la app envía la última posición con `PUT /api/mobile/location` (política de envío por distancia/tiempo en `tracking/send-policy.ts`) y "Terminar turno" la borra con `DELETE`; el servidor descarta posiciones de más de 10 min. Es solo la última posición por delivery (tabla `delivery_locations`), sin historial. Negar el permiso en segundo plano degrada a primer plano con aviso, sin cerrar la app.
- Para sembrar el primer admin: `ADMIN_SEED_EMAIL=... ADMIN_SEED_PASSWORD=... pnpm --filter @workspace/db run seed` — sin estas variables, el seed sigue corriendo normal pero no crea/actualiza ningún admin.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web: **Next.js 15** (sitio público + panel admin) — reemplaza el prototipo Vite + React
- Arquitectura: **Hexagonal estricta** (Puertos y Adaptadores) — ver Architecture decisions
- DB: PostgreSQL + Drizzle ORM (`packages/db`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Notificaciones: transporte nativo (SMTP propio / Expo Notifications) — **sin proveedores de terceros tipo Resend**
- Mobile (Fase 7): Expo — APK de staff (Android) enfocada hoy solo en el delivery, con login por PIN
- Testing: Vitest en `packages/domain` (obligatorio) y `packages/db` (integración contra DB real)
- ~~API: Express 5~~ / ~~API codegen: Orval (from OpenAPI spec)~~ — descartados y eliminados en Fase 1

## Where things live

- `apps/web` — **Next.js 15**: sitio público + panel admin. Actúa como adaptador de entrada/salida del núcleo hexagonal (Server Actions / Route Handlers inyectando repositorios de `packages/db` en los casos de uso de `packages/domain`). Scaffold vacío hasta Fase 2.
- `apps/web-legacy` — prototipo Vite + React descartado, mantenido solo como referencia visual/de copy durante la migración. No se deploya más. Se elimina en Fase 8.
- `apps/mobile` — Expo, solo Android: APK de staff enfocada en el delivery (login por PIN, cola offline, evidencia, ruta/ETA, turno con seguimiento). Código por carpetas en `src/`: `offline/` (SQLite + cola de comandos), `evidence/`, `maps/`, `tracking/`, `design-system/` (atómico: atoms/molecules/organisms/templates + `themes/`), `i18n/`, `api/`. Despachador, mapa de flota, admin, TV y pedidos presenciales quedan diferidos (spec: `docs/superpowers/specs/2026-10-20-apk-multirol-design.md`).
- `packages/domain` — núcleo hexagonal: entidades, puertos (interfaces) y casos de uso en TypeScript puro. Cero imports de Next.js, Drizzle, Stripe, Expo, etc.
- `packages/i18n` — diccionarios ES/EN framework-free (sin lógica de UI, sin `next-intl`). Consumidos como `messages` de `next-intl` en `apps/web`; se reutilizan tal cual (los datos, no `next-intl`) en el panel admin (Fase 4) y en `apps/mobile` (Fase 7, con su propio adaptador nativo).
- `packages/db` — schemas de Drizzle, migraciones, instancia de conexión a Postgres, script de seed (`src/seed.ts`)
- `packages/notifications` — adaptadores de notificaciones 100% nativos: `SmtpNotificationAdapter` (nodemailer, EN/ES, validación lazy de credenciales) implementado en Fase 6; `ExpoNotificationAdapter` (push de staff vía Expo, Fase 7) consumido vía `apps/web/src/lib/staff-notifications.ts` por el webhook de Stripe, la asignación de delivery (`/api/mobile/orders/[id]/assign` y la Server Action de `/dispatch`) y `admin-orders`.
- `attached_assets/` — reference material (logos, prompts, design system docs); not wired into the build

## Architecture decisions

- **Migración de stack (decisión de owner, congelada):** el prototipo original (Vite + React en `apps/web`, Express 5 en `apps/api`, contrato OpenAPI + Orval) se trató como descartable. El stack definitivo es Next.js 15 + Arquitectura Hexagonal estricta. `apps/api` y el pipeline Orval/OpenAPI se eliminaron por completo en Fase 1; el prototipo Vite quedó como referencia en `apps/web-legacy` hasta Fase 8.
- **Hexagonal estricta:** `packages/domain` contiene entidades, puertos y casos de uso en TypeScript puro — cero dependencias de framework, DB o proveedores externos. Motivo: el motor de reglas de negocio (descuentos por volumen, stock, estados de pedido) necesita máxima testabilidad aislada y reutilización entre superficies (web, mobile, webhooks).
- **Roles y autenticación:** `users.role` enum (`admin | despachador | delivery | customer`), sin tablas de permisos granulares — autorización vía guards por rol a nivel de endpoint. Web: `admin` en `/admin/*`, `customer` vía Auth.js. Mobile (Expo, Fase 7): `despachador`/`delivery` autenticados por PIN de 6 dígitos (hash bcrypt/argon2) + rate limiting (lockout temporal), con JWT de sesión de TTL corto revocable vía `is_active`.
- **Ciclo de vida de una orden:** `payment_status` (`pending|paid|failed|refunded`) y `fulfillment_status` (`pending|received|in_prep|ready_for_pickup|out_for_delivery|delivered|cancelled`) son campos independientes — el pago (gestionado vía webhooks de Stripe) nunca se mezcla con el estado de preparación/entrega. Solo `paid` + `received` entran a la cola activa del despachador.
- **Fulfillment:** pickup + self-delivery (fee fijo). Courier/Uber Direct queda fuera de alcance por ahora.
- **Pagos:** Stripe real (PaymentIntent + webhook) es la decisión congelada, aunque las credenciales todavía no están disponibles — se construye listo para conectar, sin mockear el flujo en silencio.
- **Notificaciones:** sin proveedores de terceros (explícitamente sin Resend). Emails transaccionales por SMTP propio; push a mobile vía Expo Notifications. Vive en `packages/notifications`.
- **i18n:** `packages/i18n` solo expone diccionarios framework-free (datos puros). `apps/web` los consume con `next-intl` y routing por locale: `en` (default) en la raíz limpia `/` sin prefijo ni redirect (`localePrefix: "as-needed"`, preserva el link equity del dominio), `es` explícito en `/es` — decisión del owner (2026-09-12) por SEO bilingüe indexable (URLs y `hreflang` propios por idioma) y por aprovechar el SSR de los Server Components de Next 15, en vez de un Context client-side con `localStorage`. `apps/mobile` (Fase 7) no usa `next-intl` — consume los mismos diccionarios de `packages/i18n` con su propio adaptador nativo.
- **Carrito y checkout (Fase 3):** carrito de invitado 100% en `localStorage` (sin cuenta, `orders.customerId = null`); `CartRepository`/`syncCart`/`mergeGuestCart` server-side construidos y probados desde ya, pero sin ningún flujo de UI que los invoque todavía — se conectan en Fase 4 cuando exista sesión real de Auth.js. El fee de self-delivery vive en la tabla `settings` (fila única, no una constante en código) para poder editarse desde el panel admin sin tocar el dominio.
- **Autenticación (Fase 4):** Auth.js v5 (`next-auth@beta`), Credentials provider, sesión JWT (no database sessions — el Credentials provider de Auth.js no persiste sesión en DB por diseño, confirmado en la doc oficial; combinarlo con database sessions requeriría un workaround no oficial). Revocación vía re-consulta de `users.is_active` en el callback `jwt` en cada request — mismo patrón que la revocación ya decidida para mobile; además `authenticateUser` ya rechaza el login desde el inicio si `isActive` es `false`, no solo revoca sesiones ya activas. `passwordHash` vive en la tabla `users` existente (mismo patrón que `pin_hash`). Sin `@auth/drizzle-adapter` — no hace falta con JWT-only + un solo provider Credentials. Config partida en `auth.config.ts` (edge-safe, sin DB, con `trustHost: true`) + `auth.ts` (Node.js runtime, con el provider Credentials y la revalidación por DB) — ver Gotchas.
- **Merge de carrito de invitado (Fase 4):** `mergeCartOnLoginAction` solo está conectado al flujo de **login** (`login-form.tsx`), no al de **registro** (`register-form.tsx` hace login automático tras registrarse, pero nunca llama al merge). No es un bug funcional hoy — el checkout sigue siendo 100% de invitado vía `localStorage`, así que nada se pierde — pero si en el futuro el checkout empieza a depender del carrito server-side, conectar el merge también al registro.
- **Inventario y calendario del trailer (Fase 5):** vista de calendario vía `react-big-calendar` + `date-fns` (combina `trailer_stops` activas y `event_bookings` confirmados como eventos coloreados distinto). Ubicación de paradas se fija con un mapa interactivo (`LocationPicker`, variante editable de `LocationMap` de Fase 2). Stock inicial de una parada se carga manualmente (el admin elige productos y `maxStock`, no automático para todo el catálogo). Advertencia de solapamiento contra `event_bookings` confirmados corre en vivo mientras se completa el formulario de nueva parada (`checkStopOverlapAction`, debounce de 500ms), no bloquea el submit. Regla de negocio nueva en el dominio: `confirmEventBooking` rechaza confirmar una reserva con `location === "TBD"` — la UI también deshabilita el botón, pero la validación real vive en `packages/domain`, no solo en la interfaz.
- **`requireAdmin()` centralizado (Fase 5):** vivía duplicado dentro de `admin-orders.ts` desde Fase 4; se extrajo a `apps/web/src/lib/require-admin.ts` al agregar las Server Actions de `trailer-stops`/`event-bookings`/`calendar`, que lo necesitaban también.
- **Notificaciones e idioma (Fase 6):** `User.preferredLocale` persiste la preferencia de idioma del cliente, editable en `/account/settings`; se resuelve así en cada envío: sesión activa → `preferredLocale` guardado, invitado → locale de la página en el momento del envío (nunca se asocia el pedido a `customerId` por esto, esa decisión sigue congelada desde Fase 3/4). Cada intento de envío (éxito, fallo real, o bloqueo por falta de credenciales SMTP) se registra en `email_logs`, visible en `/admin/email-logs` — un fallo de notificación nunca bloquea la persistencia de la orden/cotización. El refresco de `preferredLocale` en la sesión no necesita `SessionProvider`/`useSession().update()` en el cliente: el callback `jwt` de Auth.js ya revalida `role`/`isActive` contra la DB en cada request (patrón de revocación de Fase 4), así que agregar `preferredLocale` a esa misma revalidación alcanza con un `router.refresh()` tras guardar.
- **Apps mobile y staff (Fase 7):** `apps/mobile` es un cliente Expo solo Android (APK) que se comunica con Route Handlers REST de `apps/web` en `/api/mobile/**` — sin backend separado. Autenticación por PIN de 6 dígitos (`User.pinHash`, hash bcrypt/argon2, con rate limiting y lockout temporal vía `User.failedPinAttempts`/`pinLockedUntil`), JWT de sesión de TTL corto revocable vía `is_active` (mismo patrón que web Auth.js de Fase 4; sin firma HMAC de app: un secreto embebido en un APK público es extraíble, así que la seguridad real queda en PIN + lockout + JWT corto + `is_active`). Páginas nuevas `/dispatch` y `/delivery` (accesibles solo en web) sirven como superficies de staff para gestionar órdenes — separadas de `/admin/orders` para permitir flujos y datos distintos (cola de despacho vs. historial). Notificaciones push registradas en tabla `push_logs` (separada deliberadamente de `email_logs` de Fase 6 por transporte diferente y audiencia distinta: push es para dispositivos, email para usuarios invitados/clientes web) — ambas alimentan un audit trail centralizado pero sin compartir esquema.
- **APK de staff enfocada en el delivery (plan `docs/superpowers/plans/2026-10-20-apk-fundacion-delivery-offline.md`):** push remoto **descartado** (la app refresca la cola por polling cada 30 s; `confirmOrderPayment` ya invoca `notifyNewOrderInQueue` al entrar una orden paga a `received`, pero el adaptador Expo sigue sin tokens reales). El flujo de despacho/delivery quedó coordinado en el dominio: `updateOrderStatusAction` (`/admin/orders`) usa las mismas transiciones y limpieza de `assignedDeliveryUserId` que `packages/domain/src/orders/use-cases.ts`. **Design system mobile propio** (`apps/mobile/src/design-system/`, carpeta autocontenida con test de dependencias entre capas y regla de diseño que prohíbe colores/tamaños literales en pantallas): tres temas (outdoor, indoor, brand) con tokens y tests de contraste WCAG, pero **solo `outdoor` está en uso** (el delivery trabaja a pleno sol); acciones primarias de 56 dp en barra inferior (zona del pulgar), respeta fuente grande y "reducir movimiento"; justificación y paleta en `docs/design/mobile-design-system*.md`. i18n de la app: `apps/mobile/src/i18n` sobre `packages/i18n` (`staffApp`), idioma según el teléfono. Pendientes diferidos: pantalla del despachador, mapa de flota, admin, TV, pedidos presenciales.

## Product

Sitio público bilingüe de Sweet Sin (inglés en la raíz `/`, español en `/es`): hero, catálogo de 16 postres reales (paradas y precios desde Postgres), historia de marca, ubicaciones activas del trailer con mapa en vivo, un formulario de cotización de eventos que persiste la solicitud real, y carrito + checkout de invitado (pickup/self-delivery, pago vía WhatsApp funcional de punta a punta; pago con tarjeta scaffoldeado con Stripe, pendiente de credenciales reales). Cuenta de cliente (login/registro/historial de pedidos) y panel admin completo (gestión de órdenes de Fase 4; paradas del trailer con mapa interactivo y control de stock, reservas de eventos con flujo de cotización a confirmación, y una vista de calendario combinando ambas, de Fase 5) ya funcionan de punta a punta, protegidos con Auth.js.

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
