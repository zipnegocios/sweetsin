# Handoff — Sweet Sin

## Objetivo

_Proyectos 3, 4 y 5 cerrados (operación del trailer y medición; motor de capacidad y reglas; jornadas de delivery): ver las subsecciones del 2026-10-28 y 2026-10-29 en cada sección._

Ejecutar `docs/superpowers/plan-desarrollo.md` fase por fase, sin adelantar
trabajo de fases posteriores. Sesión 1: roadmap completo (Fases 1-8) +
Fase 1 (Cimientos) de punta a punta. Sesión 2: plan bite-sized de Fase 2
vía `superpowers:writing-plans`, revisado con el owner en una interview
exhaustiva (`grill-me`, 8 preguntas reales resueltas) que cambió la
arquitectura de i18n a mitad de plan, y ejecución completa de las 17 tareas
con `superpowers:executing-plans`. Sesión 3: ejecución completa del
plan bite-sized de Fase 3 (Checkout, Carrito y Órdenes,
`docs/superpowers/plans/2026-09-13-fase-3-checkout-carrito-ordenes.md`,
24 tareas) con `superpowers:executing-plans`, directo sobre `main`.
Sesión 4: ejecución completa del plan bite-sized de Fase 4
(Autenticación y Panel Admin,
`docs/superpowers/plans/2026-09-13-fase-4-auth-panel-admin.md`, 28 tareas)
con `superpowers:executing-plans`, directo sobre `main`. Sesión 5 (esta):
plan bite-sized de Fase 5 (Inventario y calendario del trailer,
`docs/superpowers/plans/2026-09-15-fase-5-inventario-calendario-trailer.md`,
25 tareas) ejecutado con `superpowers:subagent-driven-development` —
subagente implementador + subagente revisor fresco por tarea, con el
owner corriendo cada `git commit` manualmente entre tareas (el harness de
esta sesión tiene un permiso `deny` real sobre `Bash(git commit *)`/
`Bash(git push *)`, descubierto en la Tarea 1). Sesión 6 (esta): plan
bite-sized de Fase 6 (Notificaciones nativas,
`docs/superpowers/plans/2026-09-18-fase-6-notificaciones-nativas.md`, 16
tareas) ejecutado con `superpowers:subagent-driven-development` — mismo
patrón que Fase 5, más una revisión final de todo el branch en Opus y un
fix wave único al cierre. Sesión 7 (esta): spec + plan bite-sized de Fase 7
(Apps de despachador/delivery en Expo + gestión de staff,
`docs/superpowers/specs/2026-09-18-fase7-mobile-staff-design.md` +
`docs/superpowers/plans/2026-09-18-fase7-mobile-staff.md`, 15 tareas) vía
`superpowers:brainstorming` + `superpowers:writing-plans`, ejecutado con
`superpowers:subagent-driven-development` sobre `main` sin worktree
(decisión explícita del owner en esta sesión, ver Intentos fallidos #45),
más revisión final de todo el branch en Opus y un fix wave único al
cierre.

### Sesión APK de staff (2026-10-20/21)

Dejar la APK de staff (`apps/mobile`) lista para un repartidor real **enfocada solo en el delivery**: login por PIN, cola offline, evidencia opcional, ruta/ETA con tráfico y turno con seguimiento. Plan: `docs/superpowers/plans/2026-10-20-apk-fundacion-delivery-offline.md`; spec: `docs/superpowers/specs/2026-10-20-apk-multirol-design.md`; decisiones y acciones del owner: `docs/superpowers/decisiones-pendientes-apk.md`; ledger de la ejecución (rulings R1-R25 y menores diferidos): `.superpowers/sdd/2026-10-20-apk-fundacion-delivery-offline/progress.md`. Push remoto descartado (D1). Diferidos: despachador, mapa de flota, admin, TV y pedidos presenciales.

### Sesión APK del despachador (2026-10-26)

Agregar a la APK de staff la pantalla del despachador (ver la cola, empezar preparación, marcar listo y asignar a un repartidor), solo en línea y con el tema `indoor`. Plan: `docs/superpowers/plans/2026-10-26-apk-despachador.md`.

### Sesión APK delivery: detalle, mapa y contacto (2026-10-26)

Mostrar al delivery el detalle del pedido (productos, totales, notas), permitirle llamar o escribir por WhatsApp y ver el mapa con ETA, distancia y tráfico dentro de la app. Plan: `docs/superpowers/plans/2026-10-26-apk-delivery-detalle-mapa-contacto.md`.

### Sesión APK delivery: cierre y mapa gris (2026-10-27)

Retomar en una sesión nueva: **lograr que el mapa embebido de la app del delivery cargue en Android** (hoy sale gris) y cerrar las pruebas en teléfono real. Todo lo demás de la APK de staff (cola offline, evidencia, ruta/ETA, despachador, detalle, contacto) está construido y revisado.

**Sesión admin (2026-10-28):** correcciones y rediseño del panel admin: favicon restaurado (`icon.png`), `/admin` redirige a `/admin/orders` (daba 404 tras el login) y nuevo shell visual con sidebar colapsable, iconos SVG propios, badges de estado y microinteracciones CSS. Typecheck, paridad i18n y `next build` pasan; revisión visual pendiente del owner.

**Sesión admin, parte 2 (2026-10-28):** login/registro rediseñados; selector de idioma en el sidebar; estados traducidos en todo el admin; eliminar staff (transacción que libera órdenes/tokens/ubicación); ficha de staff editable (`/admin/staff/[id]`: nombre, email, rol, idioma, teléfono, contacto de emergencia, notas, contraseña, activo, PIN) con foto en R2 (`sweet-assets`, privado, URL firmada); credencial con foto en la app mobile (`CredentialScreen`, avatar tocable en la cabecera). Typecheck, 151 pruebas de dominio, 253 de mobile y `next build` pasan. Esquema al día: `drizzle-kit push` reportó "No changes detected" (las 5 columnas nuevas de `users` ya estaban en la DB) y `pnpm run test` completo pasa (dominio 151, db 27, mobile 253, web 17 archivos).

**Sesión admin, parte 3 (2026-10-28):** PIN manual en el admin (alta y edición); autoservicio del staff en la app (cambiar PIN y contraseña, `Seguridad`); acceso con huella (SecureStore + `requireAuthentication`: activar, reconfigurar, revocar; oferta única tras el primer login); credencial con cerrar sesión abajo, X en la esquina y la foto más abajo. Suite completa verde (dominio 163, mobile 269, web 113, db 27); typecheck y `next build` pasan. **No probado en teléfono real** (la huella y el Keystore lo exigen).

### Sesión paradas CRUD completo (2026-10-28)
- Meta: CRUD completo de paradas del trailer (editar, cancelar, reactivar, completar, borrar) con etiquetas públicas "Cambió de lugar/fecha", horas siempre en Australia/Adelaide y endpoints `/api/admin/trailer-stops/**`.
### Sesión plantillas de stock (2026-10-28)
- Meta: proyecto 2 de 4. Plantillas de stock reutilizables (nombre + productos con cantidad) para crear paradas del trailer con un clic, y edición del stock de una parada ya existente. Spec: `docs/superpowers/specs/2026-10-28-plantillas-stock-design.md`; plan: `docs/superpowers/plans/2026-10-28-plantillas-stock.md`; ledger: `.superpowers/sdd/2026-10-28-plantillas-stock/progress.md`.


### Proyecto 4: motor de capacidad y reglas por producto (2026-10-29)
Meta: que la entrega a domicilio respete topes por producto (se vende en línea, cantidad máxima, antelación mínima) y límites de preparación/traslado, con estimaciones calibradas contra los tiempos medidos del proyecto 3. El retiro en la parada nunca se limita. Interruptor `capacityEngineEnabled` **apagado por defecto**. Spec: `docs/superpowers/specs/2026-10-29-motor-capacidad-reglas-design.md`; plan: `docs/superpowers/plans/2026-10-29-motor-capacidad-reglas.md`; ledger: `.superpowers/sdd/2026-10-29-motor-capacidad-reglas/progress.md`. Lo siguiente es el proyecto 5 (jornadas de delivery).

### Proyecto 5: jornadas de delivery (2026-10-29)
Meta: que las entregas a domicilio descuenten stock de una jornada abierta por el admin (`separate`) o de la parada trailer activa (`shared`), con rechazo y salida por WhatsApp si no hay jornada. Interruptor `deliveryStockControlEnabled` apagado por defecto (sin él, todo igual que antes). Implementado y verificado con tests, typecheck y build; no probado en navegador.

## Estado actual

**Fase 1 y Fase 2 completas y en producción real, verificadas.** Fase 3
(código) completa: las 24 tareas del plan ejecutadas con TDD (test en rojo
→ implementación → test en verde) en cada tarea con lógica de negocio,
typecheck y test suite completa en verde, build de `apps/web` exitoso, y
`/[locale]` confirmado dinámico (no congelado) en
`.next/prerender-manifest.json`. Los smoke tests manuales de UI (Tarea 22,
pasos 4-6) se corrieron con el owner probando a mano contra
`pnpm --filter @workspace/web run dev` en `localhost:3002` — el MCP de
Chrome no respondía en este entorno (ver Intentos fallidos #15).

- **Paso 4 (WhatsApp) encontró un bug real, diagnosticado y arreglado en
  esta sesión** — ver Intentos fallidos #16: el botón no abría la pestaña
  de WhatsApp (Chrome la bloqueaba en silencio). Confirmado por el owner
  que quedó resuelto tras el fix.
- **Paso 5 (503 de tarjeta sin credenciales) verificado por `curl` directo**
  al Route Handler (`/api/checkout/payment-intent`) contra la orden real de
  la prueba de WhatsApp — devolvió `503` con
  `{"error":"Card payments are not available yet."}`, confirmando el
  comportamiento esperado. Nota para quien pruebe esto en el navegador: sin
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` declarada, el modal ni siquiera
  muestra el botón "Pay" — cae directo al fallback de cliente "Card
  payments coming soon."; el `503` real del servidor solo se vería en un
  estado intermedio (publishable key presente, secret key ausente) que no
  es el estado actual del proyecto.
- **Paso 6 (persistencia de `localStorage` tras F5): confirmado por el
  owner** — el contador del carrito se mantiene correctamente tras
  recargar.

**Tarea 22 (verificación end-to-end) completa: los 7 steps del plan
pasaron, incluidos los 3 smoke tests manuales. Fase 3 verificada de punta
a punta.**

El deploy de Fase 2 a producción (Tarea 17 de ese plan) tuvo dos incidentes
post-push, ambos diagnosticados con evidencia real (log de build de
EasyPanel + HTML servido en vivo) y resueltos — ver Intentos fallidos #13
y #14. Verificación final contra `https://sweetsin.com.au/` real: `/`
(inglés, sin prefijo) y `/es` en 200, catálogo con los 16 productos reales
visibles en el HTML servido, mapa de Google cargando (`maps.googleapis`
presente, ya no cae al fallback).

Fase 1 (sin cambios respecto al handoff anterior): prototipo descartado
retirado, monorepo reestructurado (`packages/domain`, `packages/db`,
`packages/notifications`), schema completo de Drizzle (11 tablas)
aplicado, dominio hexagonal con 20 tests, repositorios con test de
integración end-to-end, deploy inicial a EasyPanel funcionando.

Fase 2 — Catálogo público bilingüe (nuevo en esta sesión):

- **Arquitectura de i18n cambiada a mitad de plan por decisión del owner**:
  el plan original (writing-plans) proponía un `LocaleProvider` con Context
  de React + `localStorage`. El owner lo rechazó explícitamente en el
  grill-me por motivos de SEO/SSR — se reescribió el plan completo para usar
  `next-intl` con routing por locale real (`en` en la raíz `/` sin prefijo,
  `es` en `/es`, `localePrefix: "as-needed"`, middleware de
  detección/redirect). `packages/i18n` sigue siendo solo diccionarios
  framework-free; `next-intl` vive únicamente en `apps/web`.
- `packages/i18n` (nuevo paquete): diccionarios ES/EN completos (9
  namespaces: common, nav, hero, brandStory, menu, events, findUs, footer),
  con test de paridad de claves.
- `packages/domain/src/trailer-stops` (nuevo subdominio, no existía desde
  Fase 1): entidad `TrailerStop`, puerto `TrailerStopRepository`, caso de
  uso `listActiveTrailerStops`. El filtro de "activa" se amplió durante el
  grill-me para excluir también paradas vencidas por fecha (`endTime`), no
  solo por `status` — decisión del owner, ver Intentos fallidos.
- `packages/db`: `DrizzleTrailerStopRepository` (con el filtro por fecha),
  script de seed idempotente (`src/seed.ts`) que cargó los 16 productos y 3
  paradas del trailer legacy a Postgres real — **las traducciones al
  español son un primer borrador de Claude, no revisadas por Oscar**.
- `apps/web`: sitio público completo en `app/[locale]/`, todas las
  secciones migradas de `apps/web-legacy` (Navbar, MobileNav, Hero,
  BrandStory, Menu, Events, FindUs, Footer), Server Action real para
  cotizaciones de evento (`requestEventQuoteAction`, primer uso de Zod en
  `apps/web`), mapa de Google en FindUs. Sin carrito ni checkout — eso es
  Fase 3.
- Verificación end-to-end real contra la DB de producción: catálogo (16
  productos, ambos idiomas), paradas del trailer, y el Server Action de
  eventos probado con un `FormData` real (fila insertada, verificada por
  query directa, y borrada después para no dejar datos de prueba en la DB
  compartida dev=prod).
- `CLAUDE.md` actualizado: Run & Operate (script seed, env vars de
  `apps/web`), Where things live (`packages/i18n`), Architecture decisions
  (i18n con next-intl), Product (descripción real del sitio), y 6 gotchas
  nuevos (ver `CLAUDE.md` directamente — incluyen el hoisting de `@types`
  en pnpm, `force-dynamic` para páginas con fetch a Postgres, y el
  renombre de `middleware.ts`→`proxy.ts` en Next 16, que no aplica acá
  porque el proyecto está pineado a `^15.5.0`).
- **Nueva regla de proceso, agregada a `CLAUDE.md` a pedido del owner en
  esta sesión**: todo el razonamiento de Claude (incluido el bloque de
  thinking extendido, no solo la respuesta visible) va en español, con una
  estructura fija de 4 pasos (Evaluación de Impacto, Resolución de
  Conflictos, Mentoría Técnica, Plan de Acción) antes de tocar código —
  framing explícito de mentoría/aprendizaje, no solo verbosidad.

Fase 3 — Checkout, carrito y órdenes (nuevo en esta sesión):

- `packages/domain/src/settings` (subdominio nuevo): `AppSettings`,
  `SettingsRepository` — sin `use-cases.ts`, `get`/`update` no encapsulan
  ninguna regla de negocio propia.
- `packages/domain/src/cart` (subdominio nuevo): `Cart`, `CartItem`,
  `CartRepository`, `syncCart`, `mergeGuestCart` (suma cantidades por
  `productId` vía `Map` cuando el carrito de invitado se fusiona con uno
  server-side existente). Construido y probado (3 tests), pero **ningún
  flujo de UI de esta fase lo invoca todavía** — se conecta en Fase 4 con
  Auth.js real.
- `packages/domain/src/orders`: puerto extendido con
  `attachPaymentIntent`/`markAsPaid`; nuevo caso de uso
  `confirmOrderPayment` (idempotente — no hace nada si la orden ya está
  `paid`, porque Stripe puede reenviar el mismo evento de webhook más de
  una vez; decrementa stock vía `decrementStockOnSale` solo si la orden
  tiene `stopId`).
- `packages/domain/src/payments`: puerto `PaymentGateway` extendido con
  `metadata` en `createPaymentIntent`, para que el webhook de Stripe pueda
  vincular cada evento a un `orderId` propio del dominio.
- `packages/db`: tabla `settings` (fila única `id=1`, fee de delivery
  editable), `DrizzleSettingsRepository`, `DrizzleCartRepository` (con test
  de integración contra Postgres real — deja un usuario y un producto de
  prueba con prefijo `cart-test-` sin limpiar, a diferencia del test de
  settings que sí revierte al valor por defecto), métodos nuevos en
  `DrizzleOrderRepository`. Seed actualizado para cargar el default de
  `settings`.
- `apps/web`: `StripePaymentGateway` (validación lazy de
  `STRIPE_SECRET_KEY`, mismo patrón que el incidente #13 de Fase 2),
  Route Handlers `POST /api/checkout/payment-intent` y
  `POST /api/webhooks/stripe`, `CartProvider` (Context de React con
  persistencia en `localStorage`, hidratación diferida para no pisar lo
  guardado con un array vacío), `CartDrawer`, `CheckoutModal` (reconstruye
  el modal legacy sin el paso "courier", WhatsApp funcional de punta a
  punta + Stripe Elements con fallback explícito si falta la publishable
  key), Server Action `placeOrderAction`. Catálogo (`MenuCard`), `Navbar` y
  `MobileNav` conectados al carrito. `page.tsx` ensambla todo.
- `packages/i18n`: namespace `cart` completo (30 claves, ES/EN).
- Verificación automatizada completa: typecheck limpio, 35 tests en verde
  (`domain` 27, `db` 7, `i18n` 1), build de `apps/web` exitoso,
  `/[locale]` confirmado dinámico en `.next/prerender-manifest.json` (no
  `routes` ni `dynamicRoutes` — nunca se pre-renderizó como HTML estático).
  **Verificación manual de UI (Tarea 22, pasos 4-6) delegada al owner** —
  ver Estado actual e Intentos fallidos #15.

**Fase 4 — Autenticación y Panel Admin: las 28 tareas completas,
commiteadas y desplegadas en producción real, verificadas de punta a
punta.** Cada tarea de dominio/DB siguió TDD; typecheck y test suite
completa (`domain` 37, `db` 11, `i18n` 1) en verde; build completo del
monorepo exitoso, verificado con el manifiesto real (`/admin/orders` y
`/account/orders` no quedan congeladas — `auth()` las vuelve dinámicas
automáticamente al leer cookies, sin necesitar `force-dynamic` explícito).

- Auth.js v5 (Credentials + JWT) funcionando en producción para `admin` y
  `customer`, con revocación de sesión vía `is_active` verificada con
  evidencia real (usuario de prueba desactivado, login rechazado con
  "Incorrect email or password" — `authenticateUser` bloquea desde el
  login mismo, no solo revoca sesiones ya activas).
- Panel admin de órdenes completo: tabla con filtros (`fulfillmentStatus`,
  `paymentStatus`, `channel`, fecha, búsqueda por nombre/email), detalle
  con cambio de estado — verificado con un pedido de prueba real vía
  WhatsApp (`zipnegocios@gmail.com`, Tarea 18), filtros y búsqueda
  confirmados, cambio de estado persistente tras recargar.
- Customer: registro, login, historial de pedidos (`listByCustomerId`), y
  merge de carrito de invitado — verificado con una cuenta de prueba real
  (`qa-fase4-customer@example.com`, Tarea 26): el carrito de invitado
  sobrevivió al registro sin perder items, logout/login funcionó.
- **Hallazgo real, no bloqueante**: `mergeCartOnLoginAction` solo está
  conectado al flujo de **login** (`login-form.tsx`), no al de
  **registro** (`register-form.tsx` hace login automático tras
  registrarse, pero nunca llama al merge) — se descubrió al verificar que
  el usuario de prueba no tenía ningún `cart`/`cart_items` server-side al
  momento de limpiarlo. No es un bug funcional hoy porque el checkout
  sigue siendo 100% de invitado vía `localStorage` (nada se pierde), pero
  documentado en `CLAUDE.md` (Architecture decisions) para cuando el
  checkout dependa del carrito server-side.
- Todos los datos de prueba de esta fase se limpiaron de la DB compartida
  dev=prod: 4 órdenes de `zipnegocios@gmail.com` (una de hoy + 3 que habían
  quedado sin limpiar de la verificación de Fase 3, con sus 9
  `order_items`), y el usuario `qa-fase4-customer@example.com` (sin
  carrito ni órdenes asociadas).

**Fase 5 — Inventario y calendario del trailer: las 20 tareas de código
completas y commiteadas en `main`; la Tarea 22 (verificación manual de
event bookings + calendario) quedó pendiente, delegada al owner contra
producción — ver Próximos pasos.** Cada tarea de dominio/DB siguió TDD;
typecheck y test suite completa (`domain` 54, `db` 14, `i18n` 1) en verde;
build completo exitoso, verificado con el manifiesto real
(`.next/prerender-manifest.json`): ninguna ruta `/admin/*` nueva quedó
congelada, solo `login`/`register` son estáticas (mismo patrón que Fase 4).

- Calendario admin (`/admin/calendar`) vía `react-big-calendar` + `date-fns`,
  combinando paradas activas y reservas confirmadas como eventos
  coloreados distinto (rojo/navy).
- Paradas del trailer: listado, creación con mapa interactivo
  (`LocationPicker`, variante editable/arrastrable de `LocationMap` de
  Fase 2), selección manual de productos con stock inicial, aviso de
  solapamiento en vivo contra reservas confirmadas (debounce 500ms, no
  bloqueante), detalle con reposición/reporte de merma de stock.
- Reservas de eventos: listado con filtro por status y resaltado visual de
  `location = "TBD"` (decisión del owner anotada desde Fase 2), detalle con
  cambio de estado, edición de datos (única forma de sacar una reserva del
  placeholder "TBD"), agregado de items de cotización. Regla de negocio
  nueva en el dominio: `confirmEventBooking` rechaza confirmar con
  `location === "TBD"`, reforzada también en la UI (botón deshabilitado).
- **Verificación manual bloqueante de la Tarea 21 (CRUD de parada +
  solapamiento + stock): completa, corrida por Claude vía Chrome MCP —
  encontró y arregló un bug real de producción en el camino** (ver
  Intentos fallidos #36): el aviso de solapamiento interpretaba la hora
  del formulario en el timezone del *servidor*, no el de Adelaide.
- **Tarea 22 (verificación manual de event bookings + calendario): NO
  corrida** — el Chrome MCP quedó con la ventana minimizada/viewport 0x0 a
  mitad de la Tarea 22 (ver Intentos fallidos #38); el owner pidió abortar
  la automatización y una checklist para verificar manualmente contra el
  deploy de producción en su lugar. Checklist entregada en el chat de esta
  sesión (no persistida como archivo) — vale la pena guardarla si se
  quiere recuperar sin releer la transcripción completa.

**Fase 6 — Notificaciones nativas: las 16 tareas del plan completas y
commiteadas en `main` (17 commits, incluye 1 fix de un regresivo
descubierto a mitad de plan), revisión final de todo el branch corrida y
con findings ya corregidos.** Verificación final: typecheck completo, 82
tests (`domain` 56, `db` 17, `i18n` 1, `notifications` 8 nuevo), build de
`apps/web`+`apps/web-legacy` — los 3 en verde, corridos hasta el final sin
sustituir por checks acotados (a diferencia de varias tareas intermedias,
donde sí se sustituyó por la lentitud de la máquina — ver Intentos
fallidos #17/#26, mismo patrón de siempre).

- `packages/notifications` deja de ser un esqueleto: `SmtpNotificationAdapter`
  real (nodemailer), validación lazy de credenciales (nunca simula un envío
  exitoso sin `SMTP_HOST/PORT/USER/PASSWORD/FROM` reales — hoy no
  configuradas, todo intento queda logueado `blocked`), plantillas EN/ES en
  texto plano. `ExpoNotificationAdapter` era entonces un scaffold sin
  consumidor real; desde Fase 7 lo consumen el webhook de Stripe, la
  asignación de delivery (`/api/mobile/orders/[id]/assign` y `/dispatch`) y
  `admin-orders` vía `apps/web/src/lib/staff-notifications.ts`. La app
  mobile es solo Android (APK), no iOS.
- `User.preferredLocale` nuevo (columna `preferred_locale`, default `'en'`),
  editable en `/account/settings` (nuevo, con layout compartido
  `account/layout.tsx` que centraliza el guard de sesión y la nav de
  cuenta).
- Resolución de idioma del email: sesión logueada → `preferredLocale`
  guardado; invitado → locale de la página en el momento del
  checkout/cotización. El pedido nunca se asocia a `customerId` por esto —
  sigue 100% invitado, decisión ya congelada desde Fase 3/4.
- Cada intento de envío (order confirmation, event quote receipt) se
  loguea en `email_logs` nueva (status `sent`/`failed`/`blocked`), visible
  de solo lectura en `/admin/email-logs` (nueva página, protegida con
  `requireAdmin()` + el guard del layout admin + el middleware — triple
  capa).
- **Revisión final de todo el branch (Opus, 17 commits, ~166KB de diff)
  encontró 6 findings Important reales (0 Critical)** — todos corregidos
  en un único fix wave y re-verificados uno por uno: `await auth()` fuera
  del try/catch en ambos `notify*` (rompía la garantía "nunca propaga" si
  `auth()` mismo fallaba), `preferredLocale` tipado no-opcional pero sin
  poblar en el login fresco, guard propio de `/account/*` removido y
  reemplazado por `session!` (restaurado), `AccountSettingsForm` sin
  feedback de error, `email_logs.listAll()` sin `ORDER BY`, transporte
  SMTP sin `secure`/timeouts/validación de puerto numérico — este último
  especialmente importante porque hoy no hay credenciales reales para
  probarlo, así que sin el fix habría fallado (o colgado el checkout) el
  día que lleguen. Ver Intentos fallidos #40-44 para el detalle completo.

**Fase 7 — Apps de despachador/delivery (Expo) + gestión de staff: las 15
tareas del plan completas y commiteadas en `main` (20 commits, incluye 2
fixes de bugs reales descubiertos a mitad de plan), revisión final de todo
el branch corrida en Opus y con los 4 findings Important ya corregidos y
re-verificados.** Verificación final: `pnpm run typecheck` limpio en todo
el monorepo, 71 tests de dominio en verde (DB de integración no corrida en
la verificación final por compartir la Postgres real de producción, sí
corrida tarea por tarea durante la ejecución).

- `apps/mobile` (Expo, scaffold nuevo con `create-expo-app`): login por PIN
  de 6 dígitos con lockout (5 intentos → 15 min de bloqueo), pantallas de
  cola de despachador (`received`→`in_prep`→`ready_for_pickup`+asignar
  repartidor) y de delivery (`out_for_delivery`→`delivered`), JWT propio
  (`MOBILE_JWT_SECRET`, TTL 12h) en `expo-secure-store`, HMAC de build
  (`EXPO_PUBLIC_APP_SECRET`) solo en el login.
- API mobile REST nueva bajo `apps/web/src/app/api/mobile/**` (Route
  Handlers, no un backend separado — decisión congelada desde la spec):
  login, `auth/me`, cola, asignación, transiciones de estado, registro de
  push token — todos delgados, delegan a los mismos casos de uso de
  `packages/domain` que usan las Server Actions web.
- `/dispatch` y `/delivery` (páginas web nuevas, separadas de
  `/admin/orders`): mismo flujo que la app mobile pero con sesión Auth.js
  (password, no PIN) y `requireStaff(["despachador"|"delivery"])` nuevo.
- `/admin/staff` (panel admin nuevo): alta de despachador/delivery con
  password + PIN generado (mostrado una sola vez), reset de PIN, toggle de
  `isActive` — reusa el mismo Credentials provider de Auth.js que ya
  usaba `/admin`.
- Notificaciones push (`ExpoNotificationAdapter` real, antes scaffold
  vacío): `notifyDeliveryAssigned` conectado a `assignDeliveryToOrder`
  (con try/catch mudo, mismo principio que SMTP en Fase 6 — un fallo de
  push nunca bloquea la asignación); `push_logs` como tabla separada de
  `email_logs` (desviación deliberada de la spec, documentada, para no
  tocar código de Fase 6 sin necesidad).
- **Revisión final de todo el branch (Opus, 19 commits) encontró 4
  findings Important reales (0 Critical), todos corregidos en un único fix
  wave y re-verificados**: (1) `apps/mobile` nunca registraba el push
  token — las notificaciones estaban construidas y testeadas del lado
  servidor pero completamente inertes en producción; fix: registro real
  vía `expo-notifications` tras login/restauración de sesión. (2)
  `notifyNewOrderInQueue` sin ningún caller en producción, sin documentar
  — fix: documentado en `CLAUDE.md` como trabajo futuro explícito
  (candidato natural: `confirmOrderPayment`). (3) el más serio:
  `assignDeliveryToOrder` no validaba que el usuario asignado fuera
  realmente un `delivery` activo — un despachador podía asignar una orden
  a un customer/admin/delivery desactivado, dejándola varada para siempre
  (inalcanzable tanto para `findAssignedToDelivery` como para
  `markOrderDelivered`); fix: guarda de dominio nueva + 4 tests. (4)
  `/admin/orders` (Fase 4, sin cambios) puede llevar una orden a un estado
  inconsistente con la máquina de estados nueva de Fase 7 (fuera del
  alcance del plan) — documentado como Gotcha, no corregido.
- Un hallazgo de una tarea intermedia (Tarea 12, `/dispatch`/`/delivery`
  sin guard de middleware a diferencia de `/admin`) quedó parqueado
  deliberadamente — no es un hueco de seguridad (el acceso ya está
  bloqueado por `requireStaff`), solo UX menos prolija, y el plan nunca
  pidió esa cobertura.

### Sesión APK de staff (2026-10-20/21)

- **Código completo, sin commitear:** las 24 unidades de trabajo (Tasks 1-7, 9a, 9b, 10-18, 21, 22 y arreglo de la prueba de íconos) están en el índice de git (`git add`); el owner las commitea con `bash .superpowers/sdd/2026-10-20-apk-fundacion-delivery-offline/commit-por-tarea.sh` (24 commits, uno por tarea). Task 8 (push) descartada; Task 19 (mapa de flota) y la pantalla del despachador diferidas. Plan, spec, documento de justificación y `decisiones-pendientes-apk.md` se commitean aparte.
- **Verificado por tests (no en teléfono):** domain 137, web (infra + `api/mobile`) 67, mobile 149, i18n 1 (cifras del ledger al cierre de la Task 22). **Nada se ha probado en un teléfono real ni con las claves reales** (R2, Google): eso es la Task 20 del owner, con `docs/superpowers/checklist-dispositivo-delivery.md`.
- **Esquema aplicado a la base compartida** (dev = prod): columnas `delivery_evidence_*` en `orders`, flag `deliveryEvidenceRequired` en `settings` (inactivo) y tabla `delivery_locations` (aditivas, 0 filas de prueba al aplicarse).
- **Workflows nunca ejecutados en GitHub:** `.github/workflows/build-apk.yml` (release firmada) y `build-dev-apk.yml` (build de desarrollo `.dev`). Faltan los secretos y el primer despacho.
- **Sin credenciales reales aún:** R2 (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`; bucket `sweet-delivery`) y Google (`GOOGLE_ROUTES_API_KEY` en el servidor; `GOOGLE_MAPS_ANDROID_API_KEY` como secreto de GitHub). Sin ellas la evidencia y la ruta responden 503, sin simular nada; el resto funciona.

**Riesgos conocidos**
- **Batería y datos durante el turno:** el seguimiento envía posición en segundo plano; el umbral de envío está en `apps/mobile/src/tracking/send-policy.ts`. Medir consumo real en un turno largo.
- **Fabricantes que cierran procesos en segundo plano** (ahorro de batería agresivo de algunas marcas): el seguimiento puede cortarse; probar en al menos dos marcas y, si hace falta, indicar al repartidor cómo excluir la app del ahorro.
- **Consentimiento legal del seguimiento (Q6):** lo define el equipo legal; el texto de consentimiento actual es un texto de trabajo, sujeto a revisión legal. No pasar a repartidores reales sin cerrarlo.
- **Costos de Google Maps Platform:** cada ETA con tráfico es una llamada paga (Routes API) y el mapa consume Maps SDK. Se acota con caché de servidor de 60 s (en memoria, por instancia), ETA solo de la orden seleccionada y solo con permiso ya concedido. Configurar cuotas y alertas de presupuesto en Google Cloud.
- **`DELETE /api/mobile/location` con sesión expirada:** si el JWT venció (o `signOut` borra el token antes de que salga el DELETE), la baja sale sin token y la fila queda; el servidor la descarta por antigüedad (más de 10 min) en las lecturas, pero no se borra. Menor recomendado: subir el límite de `signOut` a ~8 s.
- **Retención de la evidencia:** hoy 7 días (ampliable a 30), **pendiente de confirmación legal**. No hay job de borrado implementado; definir la regla de ciclo de vida del bucket de R2 cuando legal confirme.
- **La subida de la foto a R2 podría quedar vacía** (el endpoint de registro no hace HEAD del objeto): verificar tamaño > 0 en la Task 20; si falla, cambiar a `expo-file-system` con subida BINARY_CONTENT por PUT.
- **El build de desarrollo nunca debe llegar a un repartidor real** (ver `CLAUDE.md`).

### Sesión APK del despachador (2026-10-26)

- **Código completo, sin commitear (en el índice de git):** pantalla del despachador en `apps/mobile` (`screens/DespachadorQueueScreen.tsx`, `src/dispatch/*`, `OptionRow`, textos ES/EN) y proyección de la cola del servidor a 7 campos (sin teléfono). Plan: `docs/superpowers/plans/2026-10-26-apk-despachador.md`.
- **Solo en línea:** sin cola offline; sin red, banner y acciones deshabilitadas. Peticiones con plazo de 15 s; 401 cierra sesión; 409 muestra una alerta con el motivo. Tema `indoor`.
- **No probado en teléfono real:** falta recorrer la sección "Despachador" de `docs/superpowers/checklist-dispositivo-delivery.md`.
- **Menor diferido abierto:** el motivo del 409 llega crudo del servidor, en inglés (`error.message` del dominio), también con el teléfono en español.
- **Órdenes de retiro:** quedan en `ready_for_pickup`; el dominio no tiene transición a entregada para ellas, y la pantalla no ofrece acción (muestra un texto informativo).
- **Salida de las órdenes de retiro:** quedan en `ready_for_pickup` y hoy la única salida es cancelarlas desde `/admin/orders`; como siguen en la cola, la selección por defecto (la primera) puede caer en una de ellas.
- **La ruta `assign` convierte cualquier excepción en 409** (`catch` genérico con `error.message` o "Conflict"), así que un fallo inesperado de servidor o de base también se ve como conflicto en la app.

### Sesión APK delivery: detalle, mapa y contacto (2026-10-26)

- **Código completo, sin commitear (en el índice de git):** detalle del pedido en la tarjeta del delivery (productos, totales, notas), botones Llamar/WhatsApp, mapa visible por defecto con tráfico por tramo, ETA/distancia/hora y "Iniciar navegación". Servidor: `/assigned` con el detalle y `orders.delivery_notes`; checkout web con notas para entrega a domicilio. Plan: `docs/superpowers/plans/2026-10-26-apk-delivery-detalle-mapa-contacto.md`.

### Sesión APK delivery: cierre y mapa gris (2026-10-27)

**Funciona (verificado):**
- Ruta, ETA y distancia llegan a la app (captura: "Llegada estimada: 3 min · 2,1 km"). La Routes API responde 200 desde otra IP; la clave del servidor, la del APK y `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` son la **misma** clave (39 caracteres) y no tiene restricción de IP ni de app.
- Evidencia de entrega: la subida a R2 funcionó con la clave corregida (32 caracteres); si falla, el aviso muestra "Detalle: <etapa> (<código HTTP>)".
- Detalle del pedido, Llamar y WhatsApp, pantalla del despachador, cola offline: construidos, con tests y revisión final.
- Workflow de release arreglado (parseo del certificado firmante). Plantillas `.env.example` en `apps/web`, `packages/db` y `apps/mobile`.
- Pedido de prueba en Caracas: `pnpm --filter @workspace/db run test-order-caracas create <email> ["dirección"]` y `... clean`.

**No funciona:** el **mapa queda gris**. El aviso de 12 s ("El mapa no cargó. Revisá la clave de Google Maps o tu conexión.") confirma que `onMapLoaded` nunca se dispara. El SDK de Maps sí inicializa (el renderizador `maps_core` carga) y no hay error de autenticación visible en logcat, pero Flogger descarta los mensajes.

**Hipótesis sin verificar, en este orden:**
1. *Maps SDK for Android* no habilitado o no autorizado para esa clave en Google Cloud (revisar Métricas de la API: peticiones 4xx o cero peticiones; lista de APIs permitidas de la clave; estado "Habilitada" en la Biblioteca; esperar ~5 min tras cambiar).
2. `overflow: hidden` + `borderRadius` en el contenedor del `MapView`.
3. Nueva arquitectura (Fabric) con el mapa dentro de una celda dinámica de la lista.
4. Baldosas que no descargan por red.

**Commits pendientes:** el owner debe correr `bash .superpowers/sdd/2026-10-26-apk-delivery-detalle-mapa-contacto/commit-por-tarea.sh` (9 commits, el último incluye el aviso de diagnóstico del mapa y el pedido de prueba de Caracas) y luego `git push origin main`. El harness deniega a Claude `git commit`/`git push` aunque la regla del owner lo permita; no se esquiva.

### Sesión paradas CRUD completo (2026-10-28)
- Hecho (tareas 1-6, todo en el índice, sin commit): dominio (estados, `getStopChanges`, `listVisibleTrailerStops`), repo + 5 columnas `original_*` nullables (ya aplicadas a la DB compartida), helper `adelaide-time`, acciones admin y endpoints REST, panel (editar/detalle/borrar) y sitio público (etiquetas + aviso).
- Verificación (tarea 7): `pnpm run typecheck` OK; `pnpm run test` OK en una sola corrida: i18n 1, domain 176, notifications 9, mobile 274, db 30, web 127 (0 fallos). Verificación manual en navegador pendiente.
### Sesión plantillas de stock (2026-10-28)
- Hecho y en `main` (tareas 1-7 + cierre). Verificación (tarea 8): `pnpm run typecheck` OK; `pnpm run test` OK: i18n 1, domain 204, notifications 9, mobile 275, db 36, web 157 (0 fallos). La DB compartida quedó sin filas de prueba (0 plantillas, 0 paradas 'Stock Test Stop'/'Test Stop', 0 huérfanos).
- Plantilla = **copia, no vínculo**: crear una parada desde una plantilla copia sus cantidades; editar la plantilla después no toca paradas ya creadas. Las plantillas se **archivan** (no se borran) y una archivada no se ofrece al crear paradas.
- **Definición de "vendido" (corregida):** es la suma de los `stock_events` de tipo `sale` de esa parada y producto, **no** `maxStock - currentStock`. Motivo: restock y merma (`waste`) también mueven `currentStock`, así que `max - current` mezclaría ventas con mermas y el piso de edición sería incorrecto. La guarda rechaza bajar `maxStock` por debajo de lo vendido.
- **Los pedidos aún no se ligan a una parada** (`orders.stopId` no se asigna en el checkout), así que hoy casi no existen eventos `sale`: la guarda "no bajar por debajo de lo vendido" se ejercita por tests (dominio y db), no a mano en el panel. Se podrá probar a mano en el proyecto 3.
- **Esquema:** dos tablas nuevas `stock_templates` y `stock_template_items`, ya aplicadas a la DB compartida con `db push` (solo aditivo).

### Proyecto 3: operación del trailer y medición (2026-10-28)
Entregado: apertura/cierre de paradas, stock en vivo (reposición/merma), pedidos de retiro ligados a parada con descuento todo o nada, "requiere atención" (reintentar/resolver/cancelar), `sale_reversal`, entrega de retiro, `order_status_events`, reporte `/admin/reports/fulfillment` con CSV, `/admin/settings` con seis interruptores, Agotado automático y paradas activas pedibles hasta cerrarse. Verificación: typecheck OK; tests i18n 1, domain 296, notifications 9, mobile 275, db 60, web 287 (todos pasan); build OK. **Nada de este proyecto se ejercitó en un navegador.**

**Filas de prueba sobrantes en la DB compartida (inventario solo lectura, sin borrar nada):** 99 pedidos, todos de pruebas (Test 45, Jane Doe 18, List Test A/B 9+9, Status Test 9, Customer History Test 9); 106 productos "Test Product" de 122 (16 reales); usuarios de prueba: Test Customer 45, Customer History Test 45, Auth Test Customer 44, Locale Test User 30, Delivery Test 10, Test Staff 10 (`@sweetsin.test`), Qa test2 1. Limpias: plantillas de stock (0), `stop_product_stock` (0), `stock_events` (0), `order_status_events` (0), sin huérfanos. Las 3 paradas son reales. Ambiguo: 31 `event_bookings` (no se inspeccionó su origen), usuarios Gustavo Amarista (customer y delivery `gus1@zipnegocios.com`), Charles Dispatcher y Steve Prep (parecen cuentas de trabajo reales). Pendiente decisión del owner sobre limpieza.


### Proyecto 4: motor de capacidad y reglas por producto (2026-10-29)
Tareas 1-6 hechas y en `main` (commits `df6d3a9` a `f423681`, base `93179f5`); la Tarea 7 es esta documentación.
- **Hecho:** esquema y repositorio (T1), dominio puro `packages/domain/src/capacity` (T2), integración en `createOrder` con `CapacityRejectedError` (T3), API admin `/api/admin/capacity/**` con simulador y calibración (T4), página `/admin/capacity` (T5), sitio público y checkout con rechazo + WhatsApp, selector de hora y topes visibles en el menú (T6).
- **Verificación al cierre de T6:** typecheck OK; tests web 323, domain 325, db 68, mobile 275; build OK. **No se ejercitó en un navegador** (sin DevTools MCP).
- **Rulings:** R1, cada implementador hace `git add` solo de sus archivos, commit y push a `main` (regla permanente del owner). R2, el simulador evalúa con el motor forzado a encendido (el admin prueba reglas antes de activarlo); costo: no refleja el estado real del interruptor.
- **Decisiones de calibración (T4):** "preparación" = tramo `prep` del proyecto 3; solo cuentan pedidos de una línea con cantidad 1 en los últimos 90 días (un pedido con varios productos no permite repartir el tiempo con honestidad); mediana; menos de 10 muestras = aviso; sin datos = null y no se sugiere nada.
- **Pública (T6):** la acción pública expone solo 4 campos (`soldOnline`, `deliveryMaxQty`, `leadTimeMinutes`, `showEstimateToCustomer`); por eso la "estimación aproximada" al cliente se limita a la antelación mínima y el tiempo de preparación real no se expone. El número de WhatsApp vive en `apps/web/src/lib/business-contact.ts`.
- **Limitaciones aceptadas (spec §9):** cada pedido se evalúa aislado (no sabe cuántos pedidos grandes hay en cola; la carga conjunta queda para cuando haya datos de medición); la estimación suma productos en secuencia (conservadora, saldrá alta si el negocio trabaja en paralelo); sin horario de atención (`scheduled_for` solo valida antelación mínima y un máximo de 60 días).
- **Limpieza de datos de prueba ejecutada el 2026-10-29:** 143 pedidos, 65 productos y 209 usuarios de prueba borrados de la DB compartida, con respaldo fuera del repo (`backup-pre-limpieza.json` en el scratchpad de la sesión). Esto resuelve el pendiente de limpieza anotado en el proyecto 3.

### Proyecto 5: jornadas de delivery (2026-10-29)
- Commits: `bee2e67` (esquema), `2190a9e` y `d89f8ba` (dominio e índice único), `71e1deb` (checkout), `44785d0` y `01fe674` (admin y arreglos).
- Esquema (aplicado con `db push`, solo aditivo): enum `trailer_stop_kind`, `trailer_stops.kind`, índice único parcial `trailer_stops_one_open_jornada_idx`, `settings.delivery_stock_control_enabled` y `settings.delivery_stock_mode`.
- Dominio: `packages/domain/src/delivery-jornadas/**` (`openJornada`, `closeJornada`, `discardJornada`, `findDeliveryStop`, `DeliveryRejectedError`; export `./delivery-jornadas`); `createOrder` con `settings` opcional; `requireStop` de paradas rechaza jornadas.
- Web: `app/actions/checkout.ts` (`deliveryRejected`), `app/actions/delivery-availability.ts`, `cart-store`/`checkout-modal`/`menu-grid`, `app/api/admin/jornadas/**`, `lib/jornadas.ts`, `app/actions/admin-jornadas.ts`, páginas `/admin/jornadas` y `[id]`, `StockPicker` extraído, sección de entrega en `/admin/settings` (más el arreglo del formulario), i18n EN/ES.
- `CLAUDE.md`: bullet del proyecto 5 en Architecture decisions.

## Archivos y cambios

Fase 1 (sin cambios, ver handoff anterior si hace falta el detalle
completo): `docs/superpowers/plan-desarrollo.md`, plan bite-sized de Fase
1, `packages/domain/src/**`, `packages/db/src/schema/**` y
`repositories/**`, `apps/web/**` (scaffold), `apps/web-legacy/**` (ex
`apps/web`), `pnpm-workspace.yaml`, `CLAUDE.md`, `package.json` raíz.

Fase 2 (nuevo en esta sesión):

- `docs/superpowers/plans/2026-09-12-fase-2-catalogo-publico.md` — plan
  bite-sized de Fase 2 (17 tareas), reescrito a mitad de camino tras el
  grill-me (cambio de arquitectura de i18n), ejecutado completo.
- `docs/superpowers/plan-desarrollo.md` — nueva anotación en la sección
  Fase 5: el panel admin debe resaltar visualmente las cotizaciones de
  evento con `location = "TBD"` (decisión del owner sobre el formulario de
  baja fricción de Fase 2).
- `packages/i18n/**` — paquete nuevo completo.
- `packages/domain/src/trailer-stops/**` — subdominio nuevo.
- `packages/domain/package.json` — export `"./trailer-stops"` agregado.
- `packages/db/src/repositories/trailer-stop-repository.ts` (+ test) —
  nuevo.
- `packages/db/src/repositories/index.ts` — export agregado.
- `packages/db/package.json` — export `"./repositories"`, script `seed`,
  devDependency `tsx` agregados.
- `packages/db/src/seed.ts` — nuevo, corrido contra la DB real.
- `apps/web/package.json` — dependencias del monorepo + next-intl + gsap +
  three + `@googlemaps/js-api-loader` + zod.
- `apps/web/src/i18n/**`, `apps/web/src/middleware.ts`,
  `apps/web/src/global.d.ts` — configuración de next-intl.
- `apps/web/src/app/[locale]/**` — layout y page reales (reemplazan el
  scaffold plano de Fase 1).
- `apps/web/src/components/**` — 8 secciones/componentes migrados.
- `apps/web/src/lib/**` — `animations.ts`, `google-maps.ts`.
- `apps/web/src/app/actions/event-bookings.ts` — Server Action.
- `apps/web/src/app/globals.css`, `next.config.ts` — tema visual + plugin
  de next-intl.
- `apps/web/.env.local` (gitignored, no en git) — `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
  y `DATABASE_URL`, ambas copiadas de fuentes existentes sin imprimir los
  valores.
- `pnpm-workspace.yaml` — `allowBuilds` completado para `@parcel/watcher` y
  `@swc/core` (mismo patrón que Fase 1).
- `CLAUDE.md` — 5 secciones actualizadas + 6 gotchas nuevos + la regla de
  idioma/mentoría de esta sesión.

Fase 3 (nuevo en esta sesión):

- `docs/superpowers/plans/2026-09-13-fase-3-checkout-carrito-ordenes.md` —
  plan bite-sized de Fase 3 (24 tareas), ejecutado completo.
- `packages/domain/src/settings/**`, `packages/domain/src/cart/**` —
  subdominios nuevos.
- `packages/domain/package.json` — exports `"./settings"`, `"./cart"`
  agregados.
- `packages/domain/src/orders/ports.ts`, `use-cases.ts`, `use-cases.test.ts`
  — `attachPaymentIntent`/`markAsPaid`/`confirmOrderPayment`.
- `packages/domain/src/payments/ports.ts` — `metadata` en
  `createPaymentIntent`.
- `packages/db/src/schema/settings.ts` (+ export en `schema/index.ts`).
- `packages/db/src/repositories/settings-repository.ts` (+ test),
  `cart-repository.ts` (+ test) — nuevos.
- `packages/db/src/repositories/order-repository.ts` (+ test) —
  `attachPaymentIntent`/`markAsPaid` implementados.
- `packages/db/src/repositories/index.ts` — exports agregados.
- `packages/db/src/seed.ts` — carga el default de `settings`.
- `apps/web/package.json` — `stripe`, `@stripe/stripe-js`,
  `@stripe/react-stripe-js` agregados.
- `apps/web/src/infra/stripe-payment-gateway.ts` — nuevo.
- `apps/web/src/app/api/checkout/payment-intent/route.ts`,
  `apps/web/src/app/api/webhooks/stripe/route.ts` — nuevos.
- `apps/web/src/lib/cart-store.tsx` — nuevo (`CartProvider`/`useCart`).
- `apps/web/src/components/cart/cart-drawer.tsx`,
  `checkout-modal.tsx` — nuevos.
- `apps/web/src/app/actions/checkout.ts` — Server Action
  `placeOrderAction`.
- `apps/web/src/components/sections/menu-grid.tsx`,
  `apps/web/src/components/layout/navbar.tsx`, `mobile-nav.tsx` —
  conectados al carrito.
- `apps/web/src/components/sections/menu.tsx`,
  `apps/web/src/app/[locale]/page.tsx` — `Menu` presentacional,
  `CartProvider`/`CartDrawer`/`CheckoutModal` ensamblados.
- `packages/i18n/src/types.ts`, `dictionaries/en.ts`, `dictionaries/es.ts`
  — namespace `cart`.
- `CLAUDE.md` — Run & Operate (env vars de Stripe pendientes),
  Architecture decisions (carrito/checkout de Fase 3), Product (carrito y
  checkout ya no son "todavía no"), Gotchas (`metadata.orderId` requerido
  para el webhook).

Fase 4 (nuevo en esta sesión):

- `docs/superpowers/plans/2026-09-13-fase-4-auth-panel-admin.md` — plan
  bite-sized de Fase 4 (28 tareas), ejecutado completo.
- `packages/domain/src/users/entities.ts`, `ports.ts`, `use-cases.ts`,
  `use-cases.test.ts` — `passwordHash` en `User`, `authenticateUser`,
  `registerCustomer` ahora pide `password`.
- `packages/domain/src/users/auth.ts` (nuevo) + `auth.test.ts` —
  `hashPassword`/`verifyPassword` (bcryptjs).
- `packages/domain/src/users/index.ts` — re-exporta `./auth`.
- `packages/domain/src/orders/ports.ts` — `OrderFilters`,
  `listAll`/`listByCustomerId`/`updateFulfillmentStatus`/`updatePaymentStatus`.
- `packages/domain/src/orders/use-cases.ts`, `use-cases.test.ts` —
  `listOrders` (valida `dateFrom <= dateTo`).
- `packages/domain/package.json` — `bcryptjs` + `@types/bcryptjs`.
- `packages/db/src/schema/users.ts` — columna `password_hash` (aplicada
  contra Postgres real).
- `packages/db/src/repositories/user-repository.test.ts` (nuevo).
- `packages/db/src/repositories/order-repository.ts`, `.test.ts` —
  `listAll`/`listByCustomerId`/`updateFulfillmentStatus`/`updatePaymentStatus`.
- `packages/db/src/seed.ts` — carga condicional del primer admin vía
  `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` (corrido una vez contra
  producción: `sweetsin.au@gmail.com`).
- `apps/web/package.json` — `next-auth@beta` (5.0.0-beta.32), `bcryptjs`.
- `apps/web/src/auth.config.ts` (nuevo) — config edge-safe de Auth.js
  (`trustHost: true`, sin DB, sin providers).
- `apps/web/src/auth.ts` — extiende `authConfig` con el provider
  Credentials + revalidación de `is_active` (Node.js runtime).
- `apps/web/src/types/next-auth.d.ts` (nuevo) — `Session.user.role`,
  `JWT.role`.
- `apps/web/src/app/api/auth/[...nextauth]/route.ts` (nuevo).
- `apps/web/src/middleware.ts` — combina `next-intl` + una instancia de
  Auth.js construida solo con `authConfig` (edge-safe) para proteger
  `/admin/**` por rol.
- `apps/web/src/app/actions/auth.ts` (nuevo) — `signInAction`,
  `signOutAction`.
- `apps/web/src/app/actions/admin-orders.ts` (nuevo) — `listOrdersAction`,
  `updateOrderStatusAction`.
- `apps/web/src/app/actions/register.ts` (nuevo) —
  `registerCustomerAction`.
- `apps/web/src/app/actions/merge-cart.ts` (nuevo) —
  `mergeCartOnLoginAction`.
- `apps/web/src/app/[locale]/login/page.tsx` (nuevo, con `<Suspense>`),
  `apps/web/src/components/auth/login-form.tsx` (nuevo, conectado al
  merge de carrito).
- `apps/web/src/app/[locale]/register/page.tsx` (nuevo),
  `apps/web/src/components/auth/register-form.tsx` (nuevo).
- `apps/web/src/app/[locale]/admin/layout.tsx` (nuevo) — guard de rol a
  nivel Server Component.
- `apps/web/src/app/[locale]/admin/orders/page.tsx` (nuevo) — tabla con
  filtros vía `searchParams`.
- `apps/web/src/app/[locale]/admin/orders/[id]/page.tsx` (nuevo),
  `apps/web/src/components/admin/order-status-form.tsx` (nuevo).
- `apps/web/src/app/[locale]/account/orders/page.tsx` (nuevo) —
  historial de pedidos del cliente.
- `apps/web/.env.local` (gitignored) — `AUTH_SECRET` agregado.
- `packages/i18n/src/types.ts`, `dictionaries/en.ts`, `dictionaries/es.ts`
  — namespaces `auth`, `admin`, `account` agregados.
- EasyPanel (fuera de git): variable de runtime `AUTH_SECRET` declarada en
  el servicio `apps/web`.
- `CLAUDE.md` — Run & Operate (seed de admin), Architecture decisions
  (Auth.js de Fase 4, hallazgo del merge de carrito no conectado al
  registro), Product (cuenta de cliente y panel admin ya no son
  "todavía no"), Gotchas (split de `auth.config.ts`/`auth.ts` por el
  Edge Runtime, `trustHost: true` obligatorio fuera de Vercel).

Fase 5 (nuevo en esta sesión):

- `docs/superpowers/plans/2026-09-15-fase-5-inventario-calendario-trailer.md`
  — plan bite-sized de Fase 5 (25 tareas), ejecutado con
  `superpowers:subagent-driven-development`. Corregido en el camino, antes
  de dispatch, un puñado de defectos reales del propio plan (ver Intentos
  fallidos #30, #32, #33, #34).
- `packages/domain/src/trailer-stops/ports.ts`, `use-cases.ts`,
  `use-cases.test.ts` — `create`/`findById`/`updateStatus`/`listAll` en el
  puerto; `createTrailerStop`/`completeTrailerStop`/`cancelTrailerStop`/
  `listAllTrailerStops` (sin guardas de máquina de estados, solo
  actualización directa).
- `packages/db/src/repositories/trailer-stop-repository.ts` (+ test) —
  implementación de los métodos nuevos.
- `packages/domain/src/stock/ports.ts`, `use-cases.ts`, `use-cases.test.ts`
  — `create`/`listByStop`/`incrementStock` en el puerto;
  `initializeStopStock`/`restockProduct`/`reportStockWaste` (helper
  privado `decrementWithEvent` compartido entre `decrementStockOnSale` y
  `reportStockWaste`).
- `packages/db/src/repositories/stock-repository.ts` (+ test, nuevo) —
  implementación, `incrementStock` con SQL crudo (`col + quantity`) igual
  que el `decrementStock` ya existente.
- `packages/domain/src/event-bookings/ports.ts`, `use-cases.ts`,
  `use-cases.test.ts` — `findById`/`listAll`/`updateStatus`/`addItem`/
  `update` en el puerto; `quoteEventBooking`/`confirmEventBooking`
  (rechaza `location === "TBD"` y booking inexistente)/
  `cancelEventBooking`/`completeEventBooking`/`addEventBookingItem`/
  `updateEventBookingDetails`.
- `packages/db/src/repositories/event-booking-repository.ts` (+ test) —
  reescrito completo, helper privado `attachItems` reusado por
  `findOverlapping`/`findById`/`listAll` (antes `findOverlapping` siempre
  devolvía `items: []`).
- `apps/web/src/lib/require-admin.ts` (nuevo) — `requireAdmin()` extraído
  de `admin-orders.ts`, reusado por las Server Actions nuevas.
- `apps/web/src/app/actions/admin-trailer-stops.ts` (nuevo) —
  `listTrailerStopsAction`/`checkStopOverlapAction`/
  `createTrailerStopAction`/`completeTrailerStopAction`/
  `cancelTrailerStopAction`/`restockAction`/`reportWasteAction`.
- `apps/web/src/app/actions/admin-event-bookings.ts` (nuevo) —
  `listEventBookingsAction`/`quoteEventBookingAction`/
  `confirmEventBookingAction` (atrapa el error de dominio y lo convierte
  en `{ error: "location_tbd" } | { ok: true }`)/
  `cancelEventBookingAction`/`completeEventBookingAction`/
  `addEventBookingItemAction`/`updateEventBookingDetailsAction`.
- `apps/web/src/app/actions/admin-calendar.ts` (nuevo) —
  `listCalendarEventsAction`, combina paradas activas y reservas
  confirmadas en `CalendarEvent[]` (fechas como ISO string, no `Date`
  crudo, porque cruzan el límite de una Server Action).
- `apps/web/src/components/admin/location-picker.tsx` (nuevo) — variante
  interactiva (arrastrable/clickeable) de `LocationMap`, patrón
  `onChangeRef` para no recrear el mapa de Google en cada re-render del
  padre.
- `apps/web/src/components/admin/{trailer-stop-row-actions,
  trailer-stop-form, stock-row, event-booking-actions,
  event-booking-item-form, event-booking-details-form,
  admin-calendar-view}.tsx` (nuevos) — componentes cliente del panel
  admin.
- `apps/web/src/app/[locale]/admin/{trailer-stops,
  trailer-stops/new, trailer-stops/[id], event-bookings,
  event-bookings/[id], calendar}/page.tsx` (nuevos).
- `apps/web/src/app/[locale]/admin/layout.tsx` — nav agregada (links a las
  4 secciones), puramente aditivo, lógica de sesión/sign-out sin tocar.
- `apps/web/package.json`, `pnpm-lock.yaml` — `react-big-calendar`,
  `date-fns`, `@types/react-big-calendar` (dev, la librería no publica
  tipos propios).
- `packages/i18n/src/types.ts`, `dictionaries/en.ts`, `dictionaries/es.ts`
  — 47 claves nuevas en el namespace `admin` (nav, paradas, stock,
  reservas de eventos, calendario).
- `CLAUDE.md` — Architecture decisions (calendario/mapa interactivo/stock
  manual/solapamiento en vivo de Fase 5, extracción de `requireAdmin`),
  Product (panel admin completo).

Fase 6 (nuevo en esta sesión):

- `docs/superpowers/specs/2026-09-18-fase-6-notificaciones-nativas-design.md`
  — spec, y `docs/superpowers/plans/2026-09-18-fase-6-notificaciones-nativas.md`
  — plan bite-sized (16 tareas), ambos vía `superpowers:brainstorming` +
  `superpowers:writing-plans` antes de ejecutar con
  `superpowers:subagent-driven-development`.
- `packages/domain/src/shared/types.ts` — tipo `Locale` compartido (nuevo).
- `packages/domain/src/users/{entities,ports,use-cases,use-cases.test}.ts`
  — `User.preferredLocale`, `UserRepository.update`, caso de uso
  `updateUserPreferredLocale`, `registerCustomer` pide `preferredLocale`.
- `packages/domain/src/notifications/entities.ts` (nuevo) — `EmailLog`,
  `EmailLogType`, `EmailLogStatus`. `ports.ts` — `NotificationPort` con
  `locale` en cada método, `EmailLogRepository` nuevo.
- `packages/db/src/schema/{users,email-logs}.ts` — columna
  `preferred_locale`, tabla `email_logs` nueva (ambas migraciones
  aplicadas contra la DB real compartida dev=prod).
- `packages/db/src/repositories/{user-repository,email-log-repository,
  order-repository.test}.ts` — `DrizzleUserRepository.update()`,
  `DrizzleEmailLogRepository` nuevo (con `orderBy` agregado en la
  revisión final), fix de compilación en `order-repository.test.ts`
  (literal `User` necesitaba `preferredLocale`).
- `packages/db/src/seed.ts` — admin sembrado con `preferredLocale: "en"`
  explícito, sin pisarlo en `onConflictDoUpdate` (no resetear la
  preferencia de un admin que ya la cambió).
- `packages/notifications/package.json`, `vitest.config.ts` (nuevo) —
  primera suite de tests del paquete, `nodemailer`/`@types/nodemailer`
  agregados.
- `packages/notifications/src/smtp/{errors,templates,
  smtp-notification-adapter}.ts` (+ tests) — `SmtpNotConfiguredError`,
  plantillas EN/ES, `SmtpNotificationAdapter` (con `secure`/timeouts/
  validación de puerto agregados en la revisión final).
- `packages/notifications/src/expo/expo-notification-adapter.ts` (+ test)
  — scaffold, corregido a mitad de plan (ver Intentos fallidos #40) para
  que su firma coincida con `NotificationPort`.
- `packages/notifications/src/index.ts` — exports de ambos adaptadores +
  `SmtpNotConfiguredError`.
- `apps/web/src/auth.ts`, `apps/web/src/auth.config.ts`,
  `apps/web/src/types/next-auth.d.ts` — `preferredLocale` en sesión/JWT,
  poblado también en el login fresco (fix de la revisión final — antes
  solo se poblaba en la revalidación por DB).
- `apps/web/src/app/[locale]/account/layout.tsx` (nuevo) — guard de
  sesión + nav compartida ("Mis pedidos"/"Configuración").
- `apps/web/src/app/[locale]/account/orders/page.tsx`, `settings/page.tsx`
  (nuevo) — guard propio restaurado en la revisión final (no solo confiar
  en el layout padre).
- `apps/web/src/components/account/account-settings-form.tsx` (nuevo) —
  radio EN/ES, `router.refresh()` tras guardar (sin `SessionProvider`, la
  sesión ya se revalida por request), feedback de error agregado en la
  revisión final.
- `apps/web/src/app/actions/account-settings.ts` (nuevo) —
  `updatePreferredLocaleAction`.
- `apps/web/src/app/actions/{checkout,event-bookings}.ts` —
  `notifyOrderConfirmation`/`notifyEventQuoteReceipt`: resolución de
  locale, envío + log, doble try/catch (el interno agregado durante la
  ejecución para que un fallo del propio insert de log nunca rompa el
  checkout/cotización; `await auth()` movido adentro del try en la
  revisión final).
- `apps/web/src/components/cart/checkout-modal.tsx`,
  `apps/web/src/components/sections/events.tsx` — mandan `locale` (de
  `useLocale()`) al Server Action correspondiente.
- `apps/web/src/app/actions/admin-email-logs.ts` (nuevo),
  `apps/web/src/app/[locale]/admin/email-logs/page.tsx` (nuevo) —
  listado de solo lectura, `requireAdmin()`.
- `apps/web/src/app/[locale]/admin/layout.tsx` — link nuevo al nav
  ("Email logs"), puramente aditivo.
- `apps/web/src/app/actions/register.ts`,
  `apps/web/src/components/auth/register-form.tsx` — `preferredLocale`
  agregado al registro (tomado de `useLocale()`).
- `packages/i18n/src/types.ts`, `dictionaries/{en,es}.ts` — namespace
  `account` ampliado (settings + error), namespace `admin` ampliado
  (email logs).
- `CLAUDE.md` — Run & Operate (env vars SMTP pendientes), Where things
  live (`packages/notifications` ya no vacío), Architecture decisions
  (preferencia de idioma + log de emails + decisión de `router.refresh()`
  en vez de `SessionProvider`).

Fase 7 (nuevo en esta sesión):

- `docs/superpowers/specs/2026-09-18-fase7-mobile-staff-design.md` —
  spec (8 secciones), y
  `docs/superpowers/plans/2026-09-18-fase7-mobile-staff.md` — plan
  bite-sized (15 tareas), ambos vía `superpowers:brainstorming` +
  `superpowers:writing-plans` antes de ejecutar con
  `superpowers:subagent-driven-development`.
- `packages/db/src/schema/{orders,users}.ts` —
  `orders.assignedDeliveryUserId`, `users.failedPinAttempts`,
  `users.pinLockedUntil` (migraciones aplicadas contra la DB real
  compartida dev=prod). `packages/db/src/schema/{push-tokens,push-logs}.ts`
  (nuevos) — tablas para registrar tokens de Expo y auditar envíos push.
- `packages/domain/src/users/{entities,ports,use-cases,use-cases.test}.ts`
  — `User.failedPinAttempts`/`pinLockedUntil`; `UserRepository.update`
  ampliado (`pinHash`/`isActive`), `recordFailedPinAttempt`/
  `resetPinAttempts` nuevos; casos de uso `authenticateStaffByPin` (con
  lockout), `registerStaffUser`, `resetStaffPin`, `generatePin`.
- `packages/domain/src/orders/{entities,ports,use-cases,use-cases.test}.ts`
  — `Order.assignedDeliveryUserId`; `OrderRepository` ampliado
  (`findQueueForDespachador`/`findAssignedToDelivery`/`assignDelivery`);
  casos de uso `markOrderInPrep`/`markOrderReady`/`assignDeliveryToOrder`
  (con guarda de rol de delivery activo, agregada en la revisión final,
  ver Intentos fallidos #48)/`markOrderDelivered` (ownership real, no solo
  rol); fix de un bug real de compilación en `createOrder` (ver Intentos
  fallidos #46).
- `packages/domain/src/notifications/staff-ports.ts` (nuevo) —
  `StaffNotificationPort`, `PushTokenRepository`, `PushLogRepository`.
- `packages/notifications/src/expo/expo-notification-adapter.ts` (+ test)
  — reemplaza el scaffold que tiraba "Not implemented" desde Fase 6;
  implementa `StaffNotificationPort` real vía `expo-server-sdk`, con fix
  de un bug real de logging incompleto en el path bulk (ver Intentos
  fallidos #47).
- `packages/db/src/repositories/{user-repository,order-repository,
  push-token-repository,push-log-repository}.ts` (+ tests) — lockout de
  PIN, cola de despachador/asignación de delivery, repos Drizzle de push
  tokens/logs (nuevos).
- `apps/web/src/lib/{mobile-auth,require-staff}.ts` (nuevos) —
  firma/verificación de JWT mobile (`jose`) + HMAC de build
  (`timingSafeEqual`), guard de sesión para `despachador`/`delivery`
  (separado de `requireAdmin`, sin tocarlo).
- `apps/web/src/app/api/mobile/**` (nuevo, 8 Route Handlers + middleware
  compartido) — login, `auth/me`, cola, asignados, transición de estado,
  asignar delivery, marcar entregado, registro de push token.
- `apps/web/src/app/actions/{admin-staff,dispatch,delivery}.ts` (nuevos),
  `apps/web/src/app/[locale]/admin/staff/**`,
  `apps/web/src/app/[locale]/{dispatch,delivery}/**` (nuevos) — panel
  admin de staff (alta/reset de PIN/toggle activo, con fix de propagación
  de error real en producción, ver Intentos fallidos #47.5) y páginas web
  de despachador/delivery.
- `apps/web/src/components/auth/login-form.tsx` — redirect post-login
  ramificado por rol (admin→`/admin`, despachador→`/dispatch`,
  delivery→`/delivery`).
- `apps/mobile/**` (paquete nuevo completo, scaffold Expo vía
  `create-expo-app` + código a medida): `App.tsx`, `src/api/client.ts`
  (HMAC solo en login), `src/auth/session.ts` (`expo-secure-store`),
  `src/screens/{LoginScreen,DespachadorQueueScreen,DeliveryQueueScreen}.tsx`,
  `src/navigation/index.tsx` (incluye el registro real de push token,
  agregado en el fix wave de la revisión final).
- `packages/i18n/src/types.ts`, `dictionaries/{en,es}.ts` — namespaces
  `dispatch` y ampliación de `admin` (staff) nuevos.
- `CLAUDE.md` — Run & Operate (`MOBILE_JWT_SECRET`/`EXPO_PUBLIC_APP_SECRET`),
  Architecture decisions (arquitectura de Fase 7 completa + nota de
  `notifyNewOrderInQueue` sin caller), Gotchas (`/admin/orders` desconectado
  de la máquina de estados de despachador/delivery).

### Sesión APK de staff (2026-10-20/21)

Detalle por tarea en `.superpowers/sdd/2026-10-20-apk-fundacion-delivery-offline/progress.md` y en los `review-task*.diff` de esa carpeta. Resumen:
- **Servidor (`apps/web`, `packages/domain`, `packages/db`):** `markOrderDelivered` idempotente; `confirmOrderPayment` notifica a staff (`notifyNewOrderInQueue`); `updateOrderStatusAction` coordinado con las transiciones del dominio; evidencia (`/api/mobile/orders/[id]/evidence` y `.../evidence/upload-url`, adaptador R2); ruta/ETA (`/api/mobile/orders/[id]/route`, planificador Google Routes con caché); seguimiento (`/api/mobile/location` PUT/DELETE, tabla `delivery_locations`); eliminado el HMAC de app (`EXPO_PUBLIC_APP_SECRET`).
- **App (`apps/mobile`):** identidad (nombre "Sweet Sin Staff", íconos, splash), `app.config.ts` con variante `APP_VARIANT=development`, `src/offline/` (SQLite + cola), `src/evidence/`, `src/maps/`, `src/tracking/`, `src/design-system/` (atómico, temas outdoor/indoor/brand), `src/i18n`, `DeliveryQueueScreen` y `LoginScreen` reconstruidas sobre el design system.
- **CI:** `.github/workflows/build-apk.yml` (release firmada, falla si el APK trae `devlauncher`/`devmenu`) y `.github/workflows/build-dev-apk.yml`.
- **Docs:** `CLAUDE.md` (Run & Operate, Where things live y Architecture decisions actualizados; quitadas las notas ya resueltas de `notifyNewOrderInQueue` y de `/admin/orders`), `docs/design/mobile-design-system*.md`, `docs/superpowers/checklist-dispositivo-delivery.md`, este `handoff.md`.

### Sesión APK del despachador (2026-10-26)

- **App (`apps/mobile`):** `src/screens/DespachadorQueueScreen.tsx`, `src/dispatch/{actions,load,types}.ts` con sus tests, `src/design-system/molecules/OptionRow.tsx` (y export en `index.ts`), ajustes en `themes/components.ts` y `themes/indoor.ts`, `navigation/index.tsx` y `design-rules.test.ts`.
- **Servidor (`apps/web`):** `api/mobile/orders/queue/route.ts` proyecta la cola a 7 campos, sin teléfono (`route.test.ts` nuevo).
- **i18n:** `packages/i18n` (`en.ts`, `es.ts`, `types.ts`), textos `dispatch*` de `staffApp`.
- **Docs:** `CLAUDE.md` (Where things live y Architecture decisions: el despachador ya no está diferido), este `handoff.md` y la sección "Despachador" del checklist de dispositivo.

### Sesión APK delivery: detalle, mapa y contacto (2026-10-26)

- **App (`apps/mobile`):** `src/contact/whatsapp.ts`, `src/format/money.ts`, `src/maps/{arrival-time,clamp-segments,navigation-url,traffic-runs}.ts` (con tests), `maps/RouteMap.tsx`, `maps/{parse-route-info,types}.ts`, `offline/{assigned-cache,parse-assigned-rows}.ts`, `screens/DeliveryQueueScreen.tsx`, `design-system/molecules/Button.tsx`.
- **Servidor y datos:** `apps/web/src/app/api/mobile/orders/assigned/route.ts`, `actions/checkout.ts`, `components/cart/checkout-modal.tsx`, `infra/google-routes-planner.ts`; `packages/db` (`schema/orders.ts` con `delivery_notes`, repositorios de órdenes y productos); `packages/domain` (órdenes y `routing/entities.ts`); `packages/i18n`.
- **Docs:** `CLAUDE.md`, este `handoff.md` y el checklist de dispositivo.

### Sesión APK delivery: cierre y mapa gris (2026-10-27)

- `apps/mobile/src/maps/RouteMap.tsx`: `MapView` creado una sola vez cuando el contenedor tiene tamaño; `fit()` solo tras `onMapReady`; `scrollEnabled={false}`; tras 12 s sin `onMapLoaded` muestra `staffApp.mapNotLoaded` (`maps/limits.ts`, `MAP_LOAD_NOTICE_MS`).
- `packages/db/src/test-order-caracas.ts` y el script `test-order-caracas` en `packages/db/package.json`.
- `apps/mobile/src/evidence/*`: la subida devuelve `{ ok: false, stage, status? }`; `DeliveryQueueScreen` agrega "Detalle: ..." al aviso.
- `.github/workflows/build-apk.yml`: parseo del digest del firmante corregido.
- `.env.example` de `apps/web`, `packages/db`, `apps/mobile`; `apps/web/.gitignore` con `!.env.example`.
- `CLAUDE.md`: regla de commits actualizada, secciones de R2, precios de Routes, offline, evidencia, mapa/ETA/WhatsApp, despachador.
- Planes: `docs/superpowers/plans/2026-10-26-apk-despachador.md` y `2026-10-26-apk-delivery-detalle-mapa-contacto.md`. Bitácora de SDD en `.superpowers/sdd/<plan>/progress.md` (git-ignored).

**Sesión admin (2026-10-28) — archivos:** `apps/web/src/app/icon.png` (reemplaza `favicon.ico` de Next); `admin/page.tsx` (redirect); `components/admin/{admin-sidebar,admin-icons,status-badge,page-header}.tsx` (nuevos); `admin/layout.tsx` (sidebar + main); `globals.css` (tokens `gold`, clases `.admin-card/.admin-input/.admin-btn/.admin-link/.admin-table`, `.admin-enter`); `packages/i18n` (claves `signOut`, `collapseMenu`, `expandMenu`, `openMenu`, `closeMenu`, `status_*`, `channel_*`); páginas y formularios admin migrados a las clases compartidas y a `PageHeader`.

**Parte 2 — archivos:** dominio `users/{entities,ports,use-cases}.ts` (`deleteStaffUser`, `updateStaffProfile`, `replaceStaffPhoto`, `removeStaffPhoto`, puerto `StaffPhotoStorage`); `db/schema/users.ts`; `infra/r2-client.ts` (cliente compartido), `infra/r2-staff-photo-storage.ts`; `api/admin/staff/[id]/photo/route.ts`; `api/mobile/auth/me/route.ts`; admin `staff/[id]/*`, `staff-avatar`, `staff-photo-uploader`; mobile `auth/{profile,use-profile,use-header-avatar}.ts`, `design-system/{molecules/Avatar,organisms/StaffIdCard}`, `screens/CredentialScreen.tsx`, `navigation/index.tsx`; `CLAUDE.md` (variables R2).

**Parte 3 — archivos:** dominio `users/use-cases.ts` (`isValidPin`, `verifyStaffPin`, `changeStaffPin`, `changeStaffPassword`, PIN opcional en `registerStaffUser`/`resetStaffPin`, bloqueo temporal unificado en `checkStaffPin`); web `api/mobile/account/{pin,password,verify-pin}/route.ts` + `_lib/account-error.ts`, `admin-staff.ts` (`setStaffPinAction`), `new-staff-form.tsx`, `staff-edit-form.tsx`; mobile `auth/{biometric,account-rules}.ts`, `screens/{LoginScreen,CredentialScreen,SecurityScreen}.tsx`, `design-system/molecules/TextField.tsx` (extraído del login), `StaffIdCard` (X y `avatarOverlap` 40), `navigation/index.tsx`; i18n `staffApp` y `admin`.

### Sesión paradas CRUD completo (2026-10-28)
- Archivos (staged): `apps/web/src/app/[locale]/admin/trailer-stops/[id]/edit/page.tsx`, `apps/web/src/app/[locale]/admin/trailer-stops/[id]/page.tsx`, `apps/web/src/app/[locale]/admin/trailer-stops/page.tsx`, `apps/web/src/app/actions/admin-trailer-stops.ts`, `apps/web/src/app/api/admin/_lib/authorize-admin.ts`, `apps/web/src/app/api/admin/_lib/domain-error-response.ts`, `apps/web/src/app/api/admin/_lib/trailer-stop-body.ts`, `apps/web/src/app/api/admin/trailer-stops/[id]/cancel/route.ts`, `apps/web/src/app/api/admin/trailer-stops/[id]/complete/route.ts`, `apps/web/src/app/api/admin/trailer-stops/[id]/reactivate/route.ts`, `apps/web/src/app/api/admin/trailer-stops/[id]/route.test.ts`, `apps/web/src/app/api/admin/trailer-stops/[id]/route.ts`, `apps/web/src/app/api/admin/trailer-stops/route.test.ts`, `apps/web/src/app/api/admin/trailer-stops/route.ts`, `apps/web/src/components/admin/delete-stop-button.tsx`, `apps/web/src/components/admin/trailer-stop-form.tsx`, `apps/web/src/components/admin/trailer-stop-row-actions.tsx`, `apps/web/src/components/sections/find-us-client.tsx`, `apps/web/src/components/sections/find-us.tsx`, `apps/web/src/lib/adelaide-time.test.ts`, `apps/web/src/lib/adelaide-time.ts`, `packages/db/src/repositories/trailer-stop-repository.test.ts`, `packages/db/src/repositories/trailer-stop-repository.ts`, `packages/db/src/schema/trailer-stops.ts`, `packages/domain/src/trailer-stops/entities.ts`, `packages/domain/src/trailer-stops/ports.ts`, `packages/domain/src/trailer-stops/use-cases.test.ts`, `packages/domain/src/trailer-stops/use-cases.ts`, `packages/i18n/src/dictionaries/en.ts`, `packages/i18n/src/dictionaries/es.ts`, `packages/i18n/src/types.ts`. Plan y spec en `docs/superpowers/plans|specs/2026-10-28-paradas-crud-completo*`.
### Sesión plantillas de stock (2026-10-28)
- Archivos: dominio `packages/domain/src/stock-templates/**` (entidades, puertos, casos de uso + tests) y `stock/{ports,use-cases}.ts` (edición de stock con piso de vendido); db `schema/stock-templates.ts`, `repositories/stock-template-repository.ts` (+ test), `stock-repository.ts` (+ test, `sumSold`); web `api/admin/stock-templates/**`, `api/admin/trailer-stops/[id]/{stock,stock/[productId],save-as-template}/route.ts`, `api/admin/_lib/{stock-body,require-stop,domain-error-response}.ts`, `actions/admin-stock-templates.ts`, `actions/admin-trailer-stops.ts`, `[locale]/admin/stock-templates/**` (lista, nueva, editar), `[locale]/admin/trailer-stops/{new,[id]}/page.tsx`, `components/admin/{stock-template-form,stock-template-row-actions,stock-row,stop-stock-editor,trailer-stop-form,admin-sidebar}.tsx`, `lib/{run-admin-action,stock-template-error}.ts`; i18n `types.ts`, `en.ts`, `es.ts`. Doc: spec y plan en `docs/superpowers/`.

### Proyecto 3: operación del trailer y medición (2026-10-28)
Commits `git log --oneline fab1603..HEAD`. Esquema (aplicado con `db push`): tabla `order_status_events`, `stock_events.order_id`, enum `sale_reversal`, `orders.attention_reason`, seis columnas en `settings`. Dominio en `packages/domain` (stock, órdenes, reporte), repositorios en `packages/db`, Route Handlers/Server Actions y páginas `/admin/reports/fulfillment`, `/admin/settings` en `apps/web`. Detalle por tarea en `.superpowers/sdd/2026-10-28-operacion-trailer-medicion/task-N-report.md`. Este cierre solo tocó `CLAUDE.md` y `handoff.md`.


### Proyecto 4: motor de capacidad y reglas por producto (2026-10-29)
- Esquema (aplicado con `db push`, solo aditivo): tablas `product_capacity_rules` y `product_prep_steps` (único `(product_id, position)`), enum `prep_step_mode`, seis columnas nuevas en `settings` y `orders.scheduled_for`. `DrizzleCapacityRepository` (validación Zod, enteros > 0) y `DrizzleOrderTimingRepository.itemsByOrder(orderIds)` (lectura, para calibrar).
- Dominio: `packages/domain/src/capacity/**` (export `./capacity`); `createOrder` recibe `capacity` opcional; `AppSettings` ampliado.
- Web: `apps/web/src/app/api/admin/capacity/**` (`settings`, `products/[id]`, `simulate`, `calibration`) con esquemas en `api/admin/_lib/capacity-body.ts`; `lib/capacity-simulate.ts`, `lib/capacity-calibration.ts`, `lib/capacity-public.ts` y `lib/business-contact.ts`; acciones `admin-capacity.ts` y `capacity-public.ts`; página `/admin/capacity`; `checkout.ts` (`toRejectionReasons`), `checkout-modal.tsx`, `menu-grid.tsx`, `cart-store.tsx`, `footer.tsx`, `events.tsx`; claves `cart.*` y de capacidad en `packages/i18n` (en/es con paridad).
- `CLAUDE.md`: bullet del proyecto 4 en Architecture decisions.

### Proyecto 5: jornadas de delivery (2026-10-29)
- Carrera al abrir jornadas (dos aperturas simultáneas): corregida con el índice único parcial y la traducción del error `23505` en el repositorio. Líneas repetidas de un producto no se sumaban al validar stock: corregido en `assertStockLines`.
- Las operaciones de paradas aceptaban ids de jornadas: ahora lanzan `Stop not found`. Abrir una jornada cuyo stock fallaba dejaba una jornada a medias: ahora se descarta (`discardJornada`). `closeJornadaAction` con id no UUID consultaba la base: ahora responde sin consultarla.
- El formulario de `/admin/settings` fallaba con "inválido" desde el proyecto 4 (enviaba todos los `AppSettings` a un esquema estricto): corregido.

## Intentos fallidos

*(no borrar entradas previas, solo agregar)*

1-7. Ver handoff anterior (Fase 1) — sin cambios.

8. **`pnpm install` volvió a dejar un placeholder inválido en
   `pnpm-workspace.yaml`** (`allowBuilds` para `@parcel/watcher` y
   `@swc/core: set this to true or false`), mismo síntoma que el intento
   fallido #2 de Fase 1, esta vez disparado por `next-intl`/`gsap`/`three`.
   Fix idéntico: completado en `true` (`@swc/core` ya estaba en
   `onlyBuiltDependencies` desde Fase 1; `@parcel/watcher` es un watcher de
   archivos nativo ampliamente usado, bajo riesgo).
9. **`@types/google.maps` no se auto-incluía en TypeScript** pese a estar
   bien instalado — diagnosticado con `tsc --listFiles` (no adivinado):
   pnpm hoistea a la raíz del monorepo los `@types` compartidos entre
   paquetes (`react`, `node`), pero uno exclusivo de `apps/web` queda
   aislado en `apps/web/node_modules/@types/` y el auto-discovery de `tsc`
   no lo alcanza ahí. Fix: `/// <reference types="google.maps" />`
   explícito en `apps/web/src/global.d.ts` — deliberadamente no se declaró
   `compilerOptions.types`, porque eso habría apagado el auto-include para
   todo lo demás (react/react-dom incluidos).
10. **`next build` corre ESLint**, algo que ningún `tsc --noEmit` de las
    tareas anteriores ejercía. 2 errores bloqueantes de
    `@typescript-eslint/no-explicit-any` en `hero-particles.tsx` (casts a
    `any` para `navigator.connection`/`navigator.deviceMemory`, APIs no
    estandarizadas) — fix: interfaz `NavigatorWithExtras` tipada en vez de
    `any`. Más 2 warnings limpiados (código muerto en `generateMetadata`,
    `eslint-disable` explícito y documentado para un efecto mount-only
    intencional en `LocationMap`).
11. **`apps/web` necesitaba su propia copia de `DATABASE_URL`** en
    `.env.local` — Next.js no hereda el `.env` de `packages/db`, que vive
    en otro paquete del monorepo sin ninguna relación automática. Sin esto,
    `next build` revienta ("DATABASE_URL must be set") apenas un Server
    Component importa `@workspace/db/repositories` — se manifestó recién
    en la Tarea 15, primera vez que `page.tsx` componía `Menu`/`FindUs`.
12. **Hallazgo de arquitectura, no solo un bug**: `generateStaticParams()`
    en `app/[locale]/layout.tsx`, sin más, hace que `next build` intente
    pre-renderizar `/en`/`/es` como HTML estático — ejecutando las queries
    de `Menu`/`FindUs` contra Postgres real *en build time* y congelando
    el catálogo hasta el próximo deploy. Se manifestó como un
    `connect ETIMEDOUT` de red, que en realidad era síntoma de intentar
    conectar a la DB en un momento donde nunca debería hacerlo. Fix:
    `export const dynamic = "force-dynamic"` en `page.tsx`. Verificado con
    el manifiesto real (`.next/prerender-manifest.json`), no con el
    símbolo `●`/`○` de la tabla resumen de `next build`, que solo indica
    si la ruta usa `generateStaticParams()`, no si el contenido quedó
    congelado — confiar en ese símbolo habría llevado a una conclusión
    incorrecta.
13. **Deploy a EasyPanel falló con `DATABASE_URL must be set` en
    "Collecting page data"**, pese al fix #12 (`force-dynamic`).
    Diagnóstico: `force-dynamic` evita que Next.js *ejecute* las queries en
    build time, pero no evita que *importe* `packages/db/src/index.ts` —
    Next.js carga ese módulo durante "Collecting page data" para cualquier
    página que lo referencie, sea estática o dinámica. La validación de
    `DATABASE_URL` estaba a nivel de módulo (top-level), y el build de
    Docker en EasyPanel corre en una etapa que solo recibe variables de
    *runtime*, no de *build-time*. Fix: conexión lazy vía `Proxy` en
    `packages/db/src/index.ts` — el `Pool`/`db` reales se crean (y
    `DATABASE_URL` se valida) recién en el primer método invocado, con
    `.bind()` correcto para que los métodos de Drizzle sigan funcionando a
    través del Proxy. Verificado con tests reales contra Postgres +
    simulación exacta del escenario (mover `.env.local`, borrar `.next`,
    `pnpm run build` completo sin ninguna env var disponible — pasó limpio)
    antes de dar el fix por bueno.
14. **Tras resolver #13, el build pasó pero el mapa de Google quedó en
    fallback (`Map unavailable`) en producción real**, detectado
    verificando el HTML servido en `https://sweetsin.com.au/` (no alcanza
    con "el build pasó" — un build exitoso no garantiza que el contenido
    servido esté completo). Causa distinta a #13: `NEXT_PUBLIC_*` no se lee
    en runtime como `DATABASE_URL` — Next.js lo sustituye por su valor
    literal dentro del bundle del cliente durante `next build` mismo. El
    `Dockerfile` de `apps/web` no declaraba ningún `ARG`, así que
    `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` solo llegaba al `ENV` del stage
    `runtime` (después del build), nunca a la etapa `build` donde hacía
    falta. Fix: `ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` + `ENV` promovido
    justo antes del `RUN pnpm --filter @workspace/web run build` en
    `apps/web/Dockerfile`. Verificado tras el siguiente deploy: el HTML
    real pasó de contener solo `Map unavailable` a incluir la carga real de
    `maps.googleapis`.
15. **El MCP de Chrome (`claude-in-chrome`) no funcionó en esta sesión para
    correr los smoke tests manuales de la Tarea 22 de Fase 3** —
    `navigate` reportaba éxito, pero `tabs_context_mcp` seguía mostrando la
    pestaña en `chrome://newtab` en cada verificación posterior, y
    `screenshot`/`get_page_text` fallaban con "No URL available for active
    tab" / "Cannot access a chrome:// URL". Se intentó: reintento simple,
    pestaña nueva, `list_connected_browsers` + `select_browser` explícito
    sobre el único browser conectado (`isLocal: true`) — mismo resultado
    en los tres casos. Consistente con que
    `plugin:chrome-devtools-mcp:chrome-devtools` ya había fallado con
    `CONNECT_TIMEOUT` al arrancar la sesión — sugiere un problema de
    conectividad de la extensión de Chrome en este entorno, no un error de
    uso de la herramienta. No se investigó más a fondo (fuera de alcance
    de la tarea); se delegó la verificación manual al owner en su lugar.
    Si se vuelve a necesitar el navegador desde Claude en este entorno,
    diagnosticar la extensión de Chrome (reinstalar/reconectar) antes de
    reintentar.
16. **Bug real encontrado durante el smoke test manual del owner (Tarea 22,
    Paso 4 de Fase 3): el botón "Order via WhatsApp" no abría ninguna
    pestaña**, aunque la orden sí se creaba correctamente en la DB
    (confirmado por el owner con una query directa antes de reportar el
    bug — eso descartó de entrada que `placeOrderAction` fuera la causa).
    Diagnóstico con `superpowers:systematic-debugging`: en
    `checkout-modal.tsx`, `payWithWhatsApp` llamaba a `window.open(...)`
    *después* de `await placeOrderAction(...)` — un round-trip real de red.
    Chrome solo permite abrir una pestaña de forma síncrona dentro del
    gesto de click original; en cuanto hay un `await` de por medio se
    pierde esa "activación transitoria" y el navegador bloquea el popup en
    silencio (sin ninguna excepción JS). Confirmado con evidencia real
    antes de tocar código: el owner mostró el diálogo nativo "Pop-ups
    bloqueados" de Chrome. Fix: `window.open("", "_blank")` se llama de
    forma síncrona al principio del handler (dentro del gesto de click,
    antes de cualquier `await`), guardando la referencia a la pestaña ya
    abierta; una vez que `placeOrderAction` resuelve, se navega esa pestaña
    con `.location.href = whatsappUrl` en vez de abrir una pestaña nueva en
    ese momento. Verificado por el owner tras el fix: la pestaña se abre
    correctamente.
17. **Memoria de la máquina local agotada varias veces durante Fase 4**:
    `tsc` crasheó con `VirtualAlloc failed`/`low_level_alloc.cc`, y
    `next dev` falló con "el archivo de paginación es demasiado pequeño
    para completar la operación". Causa: 8GB de RAM total, hasta 29
    procesos `node.exe` colgados simultáneamente (de sesiones/instalaciones
    anteriores). Mitigación: verificar contra producción vía `curl` en vez
    de local cuando la memoria no alcanzaba (Tareas 7 y 18); el owner
    reinició la máquina a mitad de sesión, lo que ayudó temporalmente (ver
    #26 para la recaída).
18. **El middleware combinado (Tarea 7) rompía build y dev server**:
    `Error: The edge runtime does not support Node.js 'crypto' module` —
    `middleware.ts` importaba `auth.ts`, que arrastra `DrizzleUserRepository`
    y por lo tanto `pg` (usa `crypto` de Node), inaceptable en el Edge
    Runtime. Fix: split siguiendo el patrón oficial de Auth.js v5 —
    `auth.config.ts` nuevo (edge-safe, cero imports de DB), del que
    `middleware.ts` construye su propia instancia de `NextAuth()`; `auth.ts`
    (Node.js runtime) extiende `authConfig` agregando el provider
    Credentials y la revalidación por DB.
19. **Error de tipos en el callback `session` de `auth.ts`**
    (`Type '{}' is not assignable to type 'UserRole'`) — la intersección de
    tipos de la versión beta de Auth.js v5 para el parámetro del callback
    `session` no dejaba inferir `token.role` correctamente. Fix: cast
    explícito `token.role as UserRole` (mismo patrón que el cast ya usado
    en el callback `jwt`).
20. **Route Handler de Auth.js no compilaba**: el código literal del plan
    (`export { GET, POST } from "@/auth"`) fallaba porque `auth.ts` exporta
    `handlers` como objeto agrupado, no `GET`/`POST` sueltos. Fix:
    `import { handlers } from "@/auth"; export const { GET, POST } = handlers;`.
21. **Timeout de test en `order-repository.test.ts` (Tarea 12)**: el test
    de 2 `createOrder` + 2 `listAll` contra el Postgres remoto excedía el
    timeout default de vitest (5000ms) por latencia de red pura. Fix:
    timeout de 15000ms solo en ese test.
22. **Flake de timeout en `cart-repository.test.ts`** (test de Fase 3, no
    tocado en esta sesión) — mismo síntoma de latencia de red. Confirmado
    transitorio al reintentar.
23. **El build de producción en EasyPanel falló tras la Tarea 17**:
    `useSearchParams() should be wrapped in a suspense boundary at page
    "/[locale]/login"` — bug real de la Tarea 10 que ningún
    `tsc --noEmit` local detecta (solo aparece en `next build` real, al
    intentar prerenderizar). Fix: envolver `<LoginForm />` en `<Suspense>`.
24. **Tras el fix de Suspense, el build pasó pero el login en producción
    "no hacía nada"**: el botón quedaba trabado sin redirigir. Diagnosticado
    con capturas reales del owner (Network tab + Application/Cookies): la
    Server Action de login devolvía el rol correctamente, pero nunca se
    seteaba ninguna cookie `authjs.*`. Causa: faltaba `trustHost: true` —
    requerido en cualquier deploy self-hosted que no sea Vercel; sin eso
    Auth.js no confía en el host de la request y falla en silencio al
    persistir la cookie. Fix aplicado en `auth.config.ts` y confirmado
    funcionando en producción tras el siguiente deploy (cookie
    `authjs.session-token` presente, `/admin/orders` accesible).
25. **Error de narrowing de TypeScript en `account/orders/page.tsx`**
    (`'session' is possibly 'null'` después de un
    `if (!session) { redirect(...); }` sin `return`) — el tipo `never` de
    `redirect()` de next-intl no disparaba el narrowing automático de
    TypeScript sin un `return` explícito delante. Fix:
    `return redirect(...)`.
26. **Durante el smoke test manual de la Tarea 26 (local): "Jest worker
    encountered 2 child process exceptions, exceeding retry limit"** —
    causado por 3 instancias de `next dev` acumuladas simultáneamente
    (puertos 3000/3001/3002) de intentos previos no detenidos
    correctamente, agotando la memoria de nuevo (bajó a ~739MB libres de
    8GB). Diagnosticado con `netstat -ano` (no adivinado) para identificar
    los PIDs exactos escuchando en esos tres puertos, confirmando que las
    tres instancias eran del propio dev server de esta sesión antes de
    matarlas — nunca se mató un proceso sin verificar primero a qué
    correspondía. Fix: `taskkill` de los 3 PIDs, borrar `.next`, levantar
    una única instancia limpia.
27. **Conflicto de caché `.next` entre `next build` (producción) y
    `next dev` corriendo sobre el mismo directorio**: error
    `ENOENT: ... pages/_document.js` al levantar el dev server justo
    después de correr un build completo del monorepo (Tarea 26). Fix:
    borrar `apps/web/.next` antes de levantar el dev server cada vez que
    se corrió un build de producción justo antes.
28. **La contraseña del customer de prueba (`qa-fase4-customer@example.com`,
    Tarea 26) se perdió** — el owner no la anotó y Claude nunca la vio (el
    registro la tipeó él mismo en el navegador; en la DB solo queda el hash
    bcrypt, irreversible). Se resolvió con un script temporal
    (`packages/db/src/reset-qa-password.ts`, reutilizando `hashPassword`
    real del dominio, mismo patrón que `seed.ts`) que actualizó
    `password_hash` directo en la DB con una contraseña nueva conocida; el
    script se borró inmediatamente después de usarlo, nunca se stageó ni
    commiteó.
29. **Conflicto real entre el protocolo de `subagent-driven-development`
    (espera que cada subagente implementador haga `git commit` por tarea) y
    la regla no-negociable de `CLAUDE.md`** ("Claude nunca ejecuta `git
    commit` por su cuenta"). El primer implementador (Tarea 1) se negó a
    commitear citando `CLAUDE.md`; al indicarle que era una excepción
    autorizada, reveló la causa real: `.claude/settings.local.json` tiene
    un `deny` real de harness sobre `Bash(git commit *)`/`Bash(git push
    *)` — no es cuestión de criterio del subagente, es un bloqueo técnico
    inevitable, confirmado leyendo el archivo directamente. Resuelto con el
    owner: los implementadores solo hacen `git add`; el owner corre cada
    `git commit` manualmente entre tareas (misma cadencia que Fase 4, pero
    con un implementador + revisor subagente fresco por tarea en vez de que
    Claude implemente directo).
30. **Defecto real en el propio plan de Fase 5, detectado por el revisor de
    la Tarea 5**: el Step 5 del brief decía "Expected: PASS (10 tests)",
    pero el código del propio Step 1 solo produce 9 tests — el
    self-review del plan había agregado `updateEventBookingDetails`
    (8→9 tests) pero nunca corrigió el "10" que había quedado de una
    versión anterior. Detectado contando los `it(...)` reales, no
    confiando en el texto del plan. Fix: corregido el plan doc a "9
    tests", con un Ruling formal en el ledger de SDD.
31. **Otro defecto real del plan, en el brief de la Tarea 11**: el Step 2
    tenía el literal hardcodeado `"View"` en el link de detalle, en vez de
    reusar `{t("viewDetail")}` — clave que ya existía en el diccionario
    `admin` desde la página de órdenes de Fase 4. Corregido en el plan y
    en el brief antes de despachar el implementador (violaba la regla de
    reutilización/i18n del proyecto).
32. **Defecto del plan en la Tarea 15**: la firma de la función de página
    declaraba `params: Promise<{ locale: Locale }>` en el tipo pero nunca
    lo desestructuraba ni llamaba `setRequestLocale(locale)` — inconsistente
    con **todas** las demás páginas del admin (incluida la de `orders`,
    que ese mismo brief decía replicar). Corregido antes de dispatch.
33. **Bug real de timezone en el plan de la Tarea 16**: `toDatetimeLocal(date)`
    usaba `date.toISOString().slice(0, 16)` directo, que devuelve la hora
    en UTC pero un `<input type="datetime-local">` la trata como hora
    local — si el admin abría el formulario de edición de una reserva y
    guardaba sin tocar las fechas, el horario se habría corrido
    silenciosamente por el offset de zona horaria en cada guardado. Fix
    (ajuste estándar con `getTimezoneOffset()`) aplicado al plan y al
    brief antes de despachar — nunca llegó a producción.
34. **Ambigüedad de imports de `date-fns` en el brief de la Tarea 19,
    resuelta antes de despachar**: el código primario usaba imports de
    subruta con default export (`import format from "date-fns/format"`,
    `import enUS from "date-fns/locale/en-US"`), con un fallback
    documentado condicionalmente "si tsc se queja". Verificado
    directamente contra los `.d.ts` reales de `date-fns@3.6.0` (instalada
    en la Tarea 17): esos módulos solo exportan nombrados, sin default —
    el import por default habría typechequeado contra el namespace
    completo del módulo, rompiendo `dateFnsLocalizer`. Se reemplazó el
    código primario por el fallback ya documentado (imports nombrados)
    antes de dispatch, evitándole una vuelta al implementador.
35. **`react-big-calendar@1.20.0` no trae ningún `.d.ts` propio** — el
    implementador de la Tarea 19 reportó `BLOCKED` con
    `TS7016: Could not find a declaration file`. El veredicto de la Tarea
    17 ("no hace falta `@types/react-big-calendar`") nunca se había puesto
    a prueba realmente porque en ese momento ningún código importaba la
    librería todavía. Verificado que `@types/react-big-calendar@1.16.3`
    existe en el registro de npm; instalado como devDependency (fix round
    1, mismo implementador resumido). El reviewer corrió el typecheck y el
    lint él mismo para confirmar antes de aprobar.
36. **Bug real de producción encontrado durante la verificación manual
    bloqueante de la Tarea 21**: el aviso de solapamiento de paradas
    (`checkStopOverlapAction`) recibía el string crudo del
    `<input type="datetime-local">` (sin timezone) y hacía `new
    Date(startTime)` **en el servidor** — interpretando la hora en el
    timezone del servidor, no el de Adelaide. En producción (contenedor
    EasyPanel, muy probablemente UTC) el aviso nunca habría funcionado.
    Diagnóstico con evidencia real, no adivinado: la máquina de dev tenía
    `TZ=America/Caracas`; se sembró una `event_booking` `confirmed` real
    con un rango horario conocido, se confirmó con la pestaña de Network
    que el Server Action sí se disparaba pero el aviso jamás aparecía, y
    se confirmó con `findOverlapping` llamado directo contra la DB que el
    dato SÍ existía y matcheaba con las fechas UTC correctas — aislando el
    bug a la conversión cliente→servidor, no al dominio. Fix: en
    `trailer-stop-form.tsx`, el chequeo ahora convierte a ISO
    (`new Date(startTime).toISOString()`) en el cliente antes de llamar al
    Server Action — mismo patrón que `handleSubmit` ya usaba para
    `createTrailerStopAction`, moviendo la interpretación de "hora local"
    al navegador del admin (genuinamente en Adelaide en uso real) en vez
    del servidor. Este bug ya estaba commiteado en las Tareas 10 y 12; sus
    reviews no lo agarraron porque verificaban wiring/transcripción fiel
    del brief, no corrección de timezone contra datos reales sembrados —
    la Tarea 21 cumplió exactamente su propósito de red de seguridad.
37. **El dev server local quedó con el caché de `.next` corrupto** tras un
    gap largo entre turnos de la sesión: `Cannot find module
    './vendor-chunks/drizzle-orm@...js'` (`MODULE_NOT_FOUND`), devolviendo
    500 en `/`. Diagnosticado leyendo el log del proceso en background
    (no adivinado). Fix: matar el proceso viejo, borrar `apps/web/.next`,
    levantar una instancia limpia.
38. **El Chrome MCP quedó con la ventana minimizada a mitad de la Tarea
    22** — `screenshot` fallaba con `"Cannot take screenshot with 0
    width"` y el árbol de accesibilidad volvía vacío después de un click
    real. Se intentó `resize_window` sin éxito (seguía en 0x0). El owner
    pidió abortar la automatización del navegador en vez de seguir
    depurando el estado de la ventana, y en su lugar una checklist para
    verificar manualmente contra el deploy de producción — entregada en el
    chat de esta sesión. La Tarea 22 quedó pendiente (ver Próximos pasos).
39. **Bug real reportado por el owner tras probar la checklist manual en
    producción**: crear una parada nueva tiraba un 500 genérico
    ("An error occurred in the Server Components render") de forma
    consistente. Reproducido localmente contra la misma DB con
    `superpowers:systematic-debugging`: el mensaje real (visible en modo
    dev, redactado en producción) era `Error: startTime must be before
    endTime`, lanzado por la validación de dominio en `createTrailerStop`
    — confirmado con el stack trace completo del servidor
    (`POST /admin/trailer-stops/new 500`, digest incluido). Causa: el
    owner (u otra persona probando) cargó una hora de fin anterior o
    igual a la de inicio en el formulario, y `handleSubmit` en
    `trailer-stop-form.tsx` no tenía ningún `catch` — el rechazo de la
    Server Action quedaba como unhandled rejection, exactamente el
    hallazgo Menor que el reviewer de la Tarea 12 ya había marcado como
    diferido ("sin catch, sin feedback visual"). Fix: validación
    client-side (`if (new Date(startTime) >= new Date(endTime))`) antes
    de llamar al Server Action, con mensaje inline (`stopFormInvalidRange`,
    nueva clave i18n) en vez de un round-trip al servidor; `catch` genérico
    agregado también (`stopFormSubmitError`) para cualquier otro error
    inesperado. Verificado en el navegador: el caso inválido ahora muestra
    el mensaje sin ningún error de consola ni request al servidor; el caso
    válido sigue redirigiendo a `/admin/trailer-stops` sin cambios. Datos
    de prueba (`Bug Repro Stop`, `Valid Range Repro`) limpiados de la DB.
40. **Defecto real del propio plan de Fase 6, descubierto a mitad de la
    Tarea 13**: el `ExpoNotificationAdapter` de la Tarea 12 (ya
    commiteado) tenía sus 2 métodos declarados con 0 parámetros, pero su
    propio test los llamaba con 2 (la firma real de `NotificationPort`)
    — inconsistencia entre el Step 1 (test) y el Step 3 (implementación)
    del propio brief. No se detectó en la review de la Tarea 12 porque
    `vitest run` no tipa-chequea por defecto y esa review no pidió
    `pnpm run typecheck:libs` explícitamente — recién lo agarró
    `tsc --build` cuando la Tarea 13 intentó correr el typecheck completo
    del monorepo. Diagnosticado por el propio implementador de la Tarea
    13 vía `git stash` (confirmó que el error existía en `main` de forma
    independiente a sus cambios) y verificado de forma independiente por
    el controller antes de despachar el fix. Ruling: se corrigió de
    inmediato (no se parqueó) porque bloqueaba el pipeline de typecheck
    completo para cualquier tarea posterior — fix acotado a 1 archivo,
    mismo patrón de parámetros que ya usaba `SmtpNotificationAdapter`
    para la misma interfaz. Re-review confirmó `ADDRESSED`, sin nueva
    rotura.
41. **El implementador de la Tarea 13 crasheó a mitad de tarea por un
    error de red transitorio de la infraestructura**
    (`API Error: Can't reach the API server — check your internet or DNS
    (ENOTFOUND)`), justo antes de correr el test para confirmar GREEN.
    Antes de redespachar, se verificó el estado real del working tree:
    los 2 archivos que estaba escribiendo (`smtp-notification-adapter.ts`,
    `.test.ts`) ya estaban completos y correctos, coincidían exactamente
    con el brief — no se perdió nada. Se retomó el mismo agente (no uno
    nuevo) desde el punto exacto donde había quedado, en vez de
    redespachar de cero. Lección para futuras sesiones: ante un crash de
    infraestructura (no un bloqueo de la tarea), primero verificar el
    estado real de los archivos antes de decidir si hace falta
    redespachar — muchas veces el trabajo ya escrito sigue siendo válido.
42. **Error de proceso del controller (esta sesión), corregido en el
    mismo turno**: al despachar el primer fix round de la Tarea 13, el
    mensaje con las instrucciones de arreglo se mandó por error al agente
    *revisor* de la Tarea 13 en vez de al agente *implementador* — un
    revisor no escribe código, solo verifica. Detectado de inmediato al
    releer el `agentId` usado; se envió un segundo mensaje al revisor
    aclarando que se ignore el pedido, y el pedido real se mandó al
    implementador correcto. Sin impacto real (el revisor confirmó que no
    tocó nada), pero vale la pena, en sesiones futuras con múltiples
    agentes en paralelo, verificar dos veces el `agentId`/nombre exacto
    antes de mandar instrucciones de fix.
43. **Revisión final de todo el branch de Fase 6 (Opus, sobre los 17
    commits) encontró 6 findings Important reales que ninguna review por
    tarea había agarrado por mirar solo su propio diff aislado.** El más
    serio: `await auth()` estaba *fuera* del try/catch en
    `notifyOrderConfirmation`/`notifyEventQuoteReceipt` — si `auth()`
    mismo llegaba a rechazar (ej. `AUTH_SECRET` mal configurado en
    runtime), la excepción se escapaba de la función y, en el caso del
    checkout, no había ningún `catch` corriente abajo
    (`checkout-modal.tsx` solo tiene `finally`) — violaba la garantía
    explícita de la spec de que ese try/catch "nunca propaga". Los otros
    5: `preferredLocale` tipado no-opcional pero sin poblar en el login
    fresco (real, aunque de ventana muy corta); `/account/*` había
    perdido su guard propio al extraerse a un layout compartido (Tarea
    6) y dependía 100% de `session!`; `AccountSettingsForm` nunca
    mostraba ningún error al usuario si el save fallaba;
    `DrizzleEmailLogRepository.listAll()` sin `ORDER BY` (la única
    pantalla de diagnóstico del subsistema podría mostrar el envío más
    reciente en cualquier posición); y el transporte SMTP sin
    `secure`/timeouts/validación de puerto numérico — sin este último, el
    día que lleguen credenciales reales con puerto 465 el envío se habría
    colgado (nodemailer default `secure: false`) y, como
    `placeOrderAction` **awaitea** la notificación, habría colgado el
    checkout entero varios minutos. Los 6 se corrigieron en un único fix
    wave (nunca uno por finding) y se re-verificaron uno por uno contra
    el diff real — sin nueva rotura.
44. **Flake de timeout en `event-booking-repository.test.ts` durante la
    verificación final de cierre** (no tocado por ningún commit de Fase
    6) — mismo patrón ya documentado en #21/#22 (latencia de red contra
    el Postgres remoto compartido, bajo carga concurrente de varios
    paquetes corriendo tests en simultáneo). Confirmado transitorio: el
    mismo test, corrido solo, pasó en ~4.1s (el límite default de vitest
    es 5s); en una segunda corrida completa de la suite, sin cambios de
    por medio, pasó limpio.
45. **Conflicto real entre la skill `subagent-driven-development` y la
    regla no-negociable de branching de `CLAUDE.md`** ("trabajar
    directamente sobre `main`, no crear branches"): la skill asume por
    defecto un worktree/branch aislado y termina con
    `finishing-a-development-branch` (que implica merge). Resuelto con el
    owner antes de arrancar: se ejecutó todo directo sobre `main`, sin
    worktree, y se omitió el paso de merge al cierre (no había branch que
    mergear). Mismo patrón de "detenerse y preguntar ante un conflicto
    real de proceso" que el incidente #29 de Fase 5, esta vez detectado
    antes de despachar la primera tarea en vez de en el medio.
46. **Bug real de compilación introducido por el propio plan (Tarea 5),
    descubierto a mitad de la Tarea 7**: `createOrder` en
    `packages/domain/src/orders/use-cases.ts` armaba el objeto para
    `deps.orders.create(...)` sin el campo `assignedDeliveryUserId`, que
    la propia Tarea 5 había vuelto obligatorio al ampliar `Order`. No lo
    agarró la review de la Tarea 5 porque solo corrió `vitest`, no
    `tsc --build` — recién lo agarró el controller corriendo el typecheck
    completo del monorepo antes de dispatchar la Tarea 7 (mismo patrón que
    el incidente #40 de Fase 6, con un origen distinto). Fix: se resumió
    al implementador original de la Tarea 5 para el fix de una línea
    (`assignedDeliveryUserId: null`), verificado con
    `pnpm run typecheck:libs` limpio antes de seguir.
47. **Bug real de logging incompleto en el fix round 1 de la Tarea 7**: el
    path bulk (`notifyNewOrderInQueue`) del `ExpoNotificationAdapter`
    solo iteraba sobre los usuarios que SÍ tenían push token registrado
    (`findByUserIds` filtra con `inArray`, omite silenciosamente a los
    que no tienen fila) — un despachador sin token quedaba sin ningún
    registro en `push_logs`, violando la regla de "todo intento se
    loguea, incluido el bloqueo por falta de token" (ya establecida desde
    Fase 6 para SMTP). Detectado por el revisor de tarea, no por el
    implementador ni el controller. Fix: iterar sobre la lista completa
    de `despachadorUserIds` pedida, no sobre el resultado de la query, y
    loguear `blocked` explícito para cada uno sin token — con test nuevo
    que cubre exactamente ese caso.
47.5. **Bug real de manejo de errores en producción, encontrado en el fix
    round 1 de la Tarea 11 y solo confirmado correcto en el round 2**: el
    primer intento de propagar el mensaje real de "email duplicado" al
    admin (buscar el substring `"already exists"` en `error.message` del
    lado cliente) funciona en `pnpm dev` pero nunca en producción — Next.js
    App Router redacta el `error.message` de cualquier excepción que
    escapa de una Server Action cuando corre con `next start` (que es como
    deploya este proyecto), reemplazándolo por un texto genérico + digest
    opaco. El re-revisor detectó esto verificando que `createStaffAction`
    dejaba el `throw` de `registerStaffUser` sin capturar. Fix correcto
    (round 2): `createStaffAction` devuelve un resultado tipado
    `{ ok: true, plainPin } | { ok: false, message }` en vez de tirar — el
    mensaje real viaja como dato serializado del retorno, que Next.js no
    redacta, en vez de como `Error.message` de una excepción que cruza el
    límite server/client.
48. **Hallazgo real de integridad de datos en la revisión final de todo el
    branch de Fase 7 (Opus, 19 commits)**: `assignDeliveryToOrder` nunca
    validaba que el `deliveryUserId` recibido correspondiera realmente a
    un usuario con `role === "delivery"` y `isActive === true` — solo
    verificaba que la orden estuviera `ready_for_pickup`. Un despachador
    (autenticado legítimamente, vía mobile o manipulando el dropdown web)
    podía asignar la orden a un customer, un admin, o un delivery
    desactivado; la orden pasaba a `out_for_delivery` y quedaba
    inalcanzable para siempre (`findAssignedToDelivery` solo la muestra al
    asignado, y `markOrderDelivered` solo la acepta de ese mismo usuario,
    que si no es realmente un delivery activo nunca puede reclamarla) —
    recuperable solo con un edit directo de DB. No es una escalación de
    privilegios (el despachador ya está autenticado y autorizado a
    asignar), es un hueco de integridad. Junto con otros 3 findings
    Important (push notifications inertes del lado mobile, un caso de
    código muerto sin documentar, y una costura sin documentar entre
    `/admin/orders` y la máquina de estados nueva), se corrigieron los 4
    en un único fix wave: guarda de dominio nueva
    (`deps.users.findById(deliveryUserId)` + chequeo de rol/`isActive`,
    con 4 tests nuevos) para este hallazgo, código real para el de push,
    y documentación en `CLAUDE.md` para los otros dos. Re-verificado sin
    nueva rotura antes de cerrar la fase.
49. **Deploy real de `apps/web` a EasyPanel y validación de `apps/mobile`
    contra dispositivo real con Expo Go, en una sesión posterior a la de
    ejecución del plan** — encontró 4 bugs reales que ningún typecheck/test
    automatizado podía agarrar (todos de UI/runtime de React Native, fuera
    del alcance de lo que corre `pnpm run typecheck`/`vitest`):
    - `MOBILE_JWT_SECRET` faltaba en las variables de entorno del servicio
      `platforms/sweetsin-web` de EasyPanel (el owner solo había declarado
      `EXPO_PUBLIC_APP_SECRET`) — el login mobile fallaba con 500 recién
      después de validar credenciales, porque el Route Handler de login no
      tiene try/catch alrededor de `signMobileJwt` (finding Minor ya
      documentado en la revisión final de Fase 7, #7 de esa lista).
      Corregido por el owner agregando la variable y redeployando.
    - `expo-notifications` tira un error de runtime fatal ("[runtime not
      ready]") apenas se importa de forma estática bajo Expo Go (SDK 53+
      eliminó soporte de push remotas en el cliente Expo Go, solo funciona
      en development builds) — crasheaba toda la app al arrancar, no solo
      la función de registro de push. Fix: import dinámico de
      `expo-notifications` + chequeo de `Constants.appOwnership === "expo"`
      (deprecado pero más preciso que `executionEnvironment`, que agrupa
      Expo Go y development builds bajo el mismo valor pese a que estos
      últimos sí soportan push) antes de importar el módulo.
    - `LoginScreen` no tenía ningún estilo — sin `SafeAreaView` ni padding,
      el campo de email quedaba literalmente debajo de la barra de estado
      del celular, inalcanzable. Fix: `SafeAreaView` (de
      `react-native-safe-area-context`, ya era dependencia) + estilos
      básicos, y `SafeAreaProvider` agregado en la raíz de `App.tsx`
      (nunca se había agregado, requerido para que los insets se calculen
      bien).
    - `apps/mobile/.env` local (creado para esta prueba) apuntaba a
      `EXPO_PUBLIC_API_BASE_URL=https://sweetsin.com.au`, con
      `EXPO_PUBLIC_APP_SECRET` idéntico al declarado en
      `apps/web/.env.local` — ambos gitignoreados, confirmado con
      `git check-ignore -v`, nunca llegaron a stagear.
50. **Modo túnel de Expo (`--tunnel`, necesario porque celular y compu
    comparten la misma VPN que sale por la IP del VPS, así que el modo LAN
    normal —`exp://10.9.0.10:8081`— es inalcanzable desde el celular)
    falló dos veces con causas distintas**: primero `@expo/ngrok` no pudo
    instalarse globalmente en Windows (símbolo `×` sin detalle de Expo
    CLI) — resuelto instalándolo como devDependency local
    (`pnpm --filter mobile add -D @expo/ngrok`) en vez de depender del
    auto-install global. Después, con el paquete ya instalado local, el
    túnel siguió fallando con `TypeError [ERR_INVALID_ARG_TYPE]: The
    "file" argument must be of type string. Received null` — bug conocido
    de `@expo/ngrok` con la estructura de `node_modules` que arma pnpm
    (symlinks, distinta a la de npm) al intentar localizar su propio
    binario. En vez de seguir depurando ese incompatibilidad de tooling,
    se resolvió el problema de fondo: el owner desconectó la VPN del
    celular para esta prueba puntual, dejándolo en el mismo Wi-Fi físico
    que la compu, y el modo LAN sin túnel funcionó directo. Queda como
    nota para el futuro: si hace falta el túnel de verdad (celular en otra
    red), esta combinación pnpm+Windows+ngrok necesita más investigación o
    un proveedor de túnel alternativo.
51. **Bug real de diseño descubierto al probar el flujo completo en
    dispositivo**: `findQueueForDespachador()` (Tarea 6 del plan de Fase
    7) solo filtraba `fulfillmentStatus in (received, in_prep)` — una
    orden que el despachador acababa de marcar "lista" (`ready_for_pickup`)
    desaparecía de la cola entera antes de que hubiera forma de asignarle
    un repartidor, tanto en `apps/mobile` como en `/dispatch` (misma
    función de repositorio para ambas superficies). Ninguna revisión de
    tarea ni la revisión final de todo el branch lo agarró porque el
    scaffold de `apps/mobile` (Tarea 14) tampoco tenía la UI de asignación
    todavía — el gap solo se manifestó al conectar ambas piezas en una
    prueba end-to-end real. Fix: `findQueueForDespachador()` amplía el
    filtro a incluir también `ready_for_pickup` (seguro por construcción,
    una orden en ese estado nunca tiene `assignedDeliveryUserId` todavía);
    test de repositorio actualizado para cubrir el caso.
52. **Dos features completas faltaban en el scaffold de `apps/mobile`
    (Tarea 14), ninguna señalada como hallazgo en su revisión de tarea
    porque el código coincidía exactamente con lo que pedía el brief — el
    brief mismo nunca las incluyó**: (1) `DespachadorQueueScreen` no tenía
    ninguna UI para asignar repartidor cuando una orden llegaba a
    `ready_for_pickup` (el brief de la Tarea 14 solo daba código para
    `received`/`in_prep`) — fix: nuevo endpoint
    `GET /api/mobile/delivery-staff` (listado de deliveries activos,
    mismo patrón `requireMobileAuth` que el resto de la API mobile) +
    selector de botones en la pantalla. (2) Ninguna pantalla tenía forma
    de cerrar sesión — fix: `AuthContext` nuevo
    (`apps/mobile/src/auth/context.tsx`) que expone `logout()`, provisto
    en `RootNavigator` y consumido vía `navigation.setOptions({
    headerRight: ... })` en ambas pantallas de cola.
53. **Datos de prueba limpiados de la Postgres real** tras la validación
    completa: 132 órdenes con "Test" en `customerName`/`customerEmail`
    (acumuladas de corridas repetidas de `order-repository.test.ts` a lo
    largo de varias sesiones — mismo patrón que #21/#22/#44), la orden
    `QA Fase7 Flow Test` creada para el smoke test end-to-end, 3 órdenes
    de test residuales que quedaron con `assignedDeliveryUserId` apuntando
    al usuario QA delivery (bloqueaban el borrado del usuario por FK —
    probablemente asignadas sin querer mientras se navegaba la cola real
    en el celular, mezcladas con las órdenes de test que dejó la vitest
    suite corrida en el medio de esta sesión), y los 2 usuarios de staff
    QA (`qa-fase7-despachador@example.com`,
    `qa-fase7-delivery@example.com`). Todos los scripts usados para
    crear/borrar estos datos fueron temporales, nunca se stagearon ni
    commitearon (mismo patrón que `reset-qa-password.ts` de Fase 4).
54. **Validación del flujo web (`/dispatch`/`/delivery`), misma sesión**:
    encontró un quinto gap real, mismo patrón que el logout de `apps/mobile`
    (#52) — ninguna de las dos páginas tenía forma de cerrar sesión. Fix:
    botón "Sign out" agregado directo en `dispatch/page.tsx` y
    `delivery/page.tsx`, reusando `signOutAction` ya existente (mismo
    patrón que `admin/layout.tsx`, sin crear un layout nuevo). Con el fix,
    el flujo completo `received→in_prep→ready_for_pickup→asignar
    delivery→out_for_delivery→delivered` se confirmó de punta a punta
    contra producción real, verificado en la DB en cada paso (incluido un
    falso positivo propio: la primera verificación corrió antes de que el
    owner terminara de hacer los clicks, llevando a reportar erróneamente
    que la orden no había cambiado — corregido re-consultando después).
    Limpieza final: la orden `QA Fase7 Web Flow Test`, los 2 usuarios
    `qa-fase7-web-*@example.com`, y 7 órdenes de test adicionales
    (`Test`/`List Test A/B`/`Customer History Test`) que habían quedado de
    otra corrida de `order-repository.test.ts` en el medio de esta sesión.
    **Sin tocar**: 66 órdenes `Jane Doe`/`jane@example.com` en `pending`
    detectadas en la misma limpieza — ruido preexistente no relacionado
    con Fase 7 (ya se había limpiado una vez en Fase 4, mismo patrón que
    #21/#22/#44, volvió a acumularse por corridas de tests desde
    entonces); no interfieren con la cola del despachador porque nunca
    llegan a `paid`, así que se dejaron sin borrar a la espera de que el
    owner confirme si quiere limpiarlas. **Actualización, mismo turno**:
    el owner confirmó — las 66 se borraron también, mismo script temporal
    desechable, DB real sin ninguna orden de test conocida al cierre de
    esta sesión.

### Sesión APK de staff (2026-10-20/21)

(Solo se agregan entradas; el detalle completo está en `.superpowers/sdd/2026-10-20-apk-fundacion-delivery-offline/progress.md`.)
- **El harness deniega `git commit`:** dos intentos de commit (con autorización del owner por chat) fueron denegados por permisos; no se esquivó. Se entregó `commit-por-tarea.sh` para que lo ejecute el owner (ahora 24 commits).
- **Task 8 (push remoto) descartada** por decisión del owner (D1): dependía de Firebase, secretos y teléfono; no se implementó.
- **`brand/assets.test.ts` fallaba siempre por timeout** (unos 9k `expect` por imagen con `sharp`): se corrigió con un solo contador y timeout explícito (Task 21), porque rompía el gate de CI.
- **Conflictos del plan resueltos por rulings:** el test de i18n importaba un módulo con código nativo (R1); `design-rules.test.ts` fallaba con pantallas heredadas (R2); el layout del documento de diseño (barra inferior) ganó sobre el del plan (R20).
- **Rondas de corrección por revisión:** carreras en el refresco de la lista offline y en `signOut` (Task 11); sin timeouts en la captura de evidencia (Task 13); posición residual tras "Terminar turno" y tarea de seguimiento viva sin bandera (Task 18B); caché compartida entre tests y errores de Google mapeados a 409 (Tasks 17A/22).
- **Credenciales pegadas en el chat:** el secreto de R2 llegó enmascarado y no se escribió en ningún archivo; el token mostrado cubre todos los buckets (ver M4).
- **Menores diferidos, aún abiertos:** en el ledger (p. ej. `db.ts` cachea un rechazo de `openDatabaseAsync`, guard de doble toque en la evidencia, `trim()` del email en el login).

### Sesión APK del despachador (2026-10-26)

(Solo se agregan entradas.)
- **Menor diferido:** el motivo del 409 llega crudo del servidor, en inglés, y se muestra tal cual en la alerta; no se traduce. Pendiente decidir si se mapean los motivos del dominio a textos de `packages/i18n`.
- **Fuera de alcance a propósito:** órdenes de retiro hasta "entregada" (no existe la transición en el dominio), mapa de flota, historial, posición de los repartidores, notificación al despachador (push descartado), filtros y búsqueda.
- **Riesgo conocido:** la ruta `assign` convierte cualquier excepción en 409, por lo que un error real de servidor se presenta como conflicto con su mensaje.

### Sesión APK delivery: detalle, mapa y contacto (2026-10-26)

(Solo se agregan entradas.)
- **Defecto del mapa que no aparecía (corregido en la Task 5):** el efecto que reacciona al cambio de selección hacía `setMapOrderId(null)` en cada carga, y el mapa solo se dibujaba cuando `mapOrderId === item.id`. Por eso nunca aparecía por defecto, solo después de tocar "Ver ruta", aunque la ruta ya estuviera calculada con el permiso concedido. Se reemplazó por `mapHiddenId`: el mapa se muestra cuando la ruta de la orden seleccionada está `ok` y se oculta solo si el repartidor toca "Ocultar ruta". En el teléfono además hacen falta orden `out_for_delivery`, permiso de ubicación concedido, `GOOGLE_ROUTES_API_KEY` en el servidor y `GOOGLE_MAPS_ANDROID_API_KEY` en el build.
- **`scrollEnabled={false}` en el mapa:** el mapa capturaba el gesto de arrastre y bloqueaba el desplazamiento de la lista; se desactiva el scroll del mapa.
- **Nombres de producto solo en inglés (R3):** `/assigned` envía `nameEn`; no se localizan al español.
- **No probado contra la API real de Google ni en dispositivo:** el tráfico por tramo (`TRAFFIC_ON_POLYLINE`) y el mapa solo están cubiertos por tests unitarios.

### Sesión APK delivery: cierre y mapa gris (2026-10-27)

- **Mapa gris, intento 1:** se montó el `MapView` solo con contenedor medido y se llamó a `fit()` tras `onMapReady`. No cambió nada: sigue gris.
- **Mapa gris, intento 2:** se agregó el aviso de 12 s. Sirvió para diagnosticar (confirma que `onMapLoaded` nunca llega), no para arreglar.
- **Lectura de logcat:** se intentó volcar el registro completo del proceso de la app, pero el teléfono ya estaba desconectado (`no devices/emulators found`). Hay que reactivar la depuración USB (modo "Transferencia de archivos") y confirmar que `adb devices` muestre `device`. Herramientas en `C:\tmp\adb-tools`.
- **Hipótesis descartada:** un revisor afirmó que `GOOGLE_ROUTES_API_KEY` era otra clave. Se comprobó con evidencia que las tres son idénticas.
- **Subida a R2:** fallaba porque la clave de acceso tenía 31 caracteres (debía ser 32). Además, un `R2_DELIVERY_EVIDENCE_PREFIX` de 2 caracteres sin barra generaba claves de objeto mal formadas.
- **Limpieza que no pude hacer:** `C:\tmp\apk-inspect` (221 MB) lo debe borrar el owner; opcionales `C:\tmp\adb-tools` y `C:\tmp\platform-tools.zip`.

**Sesión admin (2026-10-28) — intentos fallidos:** ninguno que revertir; dos errores propios corregidos en el momento (un `</div>` duplicado y llaves dobles en `title={{…}}` por un script de sustitución masiva).

### Sesión paradas CRUD completo (2026-10-28)
- Se borraron por error los 79 archivos de test del repo; se restauraron desde git.
- La primera guarda de limpieza de datos de prueba se detuvo por un conteo mal calculado (no borró nada de más).
- `stock-repository.test.ts` dejó filas 'Stock Test Stop' filtradas en la DB compartida (sin afterAll); se limpiaron a mano.
### Sesión plantillas de stock (2026-10-28)
- Se definió "vendido" primero como `max - current` y se corrigió a la suma de eventos `sale` antes de implementarlo (restock y merma lo falseaban).
- `stock-repository.test.ts` y los tests de plantillas deben limpiar sus filas; la verificación final confirmó 0 filas de prueba restantes.
- La UI de plantillas y de edición de stock no se probó en navegador (solo typecheck, tests y revisión).

### Proyecto 3: operación del trailer y medición (2026-10-28)
Sin intentos fallidos en la tarea de cierre. Se anotó que el seguimiento de pedidos de prueba acumulados en la DB compartida es un problema recurrente (los tests de `packages/db` no limpian todo lo que crean).


### Proyecto 4: motor de capacidad y reglas por producto (2026-10-29)
Sin intentos fallidos en la tarea de cierre. Rondas de corrección durante la ejecución (ver el ledger): T1 una ronda (`updated_at` al editar una regla), T2 una ronda (cantidad <= 0 y `productNames`), T4 una ronda (4 hallazgos: `lastModifiedAt`, simulación con el motor apagado, acotar `itemsByOrder`), T6 una ronda (estimación engañosa, rechazo obsoleto al navegar, fecha acotada a 60 días). Ninguna requirió rehacer una tarea.

### Proyecto 4: ola de corrección tras la revisión final (2026-10-29)
- Corregido: `evaluateDeliveryOrder` comparaba el tope por línea (5+5+5 con tope 5 pasaba); ahora suma por producto. `lead_time` tolera 5 minutos y `MAX_SCHEDULE_DAYS`/`LEAD_TIME_MARGIN_MINUTES` se exportan del dominio. Con el motor apagado `scheduledFor` ya no se guarda. `showEstimateToCustomer` se quitó de la acción pública (no tiene efecto). `itemsByOrder` quedó en el puerto `OrderTimingRepository`; en `CLAUDE.md` la calibración vive en `apps/web/src/lib/capacity-calibration.ts` (`buildCalibration`), no en el dominio. Spec §3, §6.16 y §7 enmendados: el detalle muestra la hora pedida y guardar la estimación queda para después.

## Próximos pasos

- **Costo de Google Routes (tráfico por tramo = SKU Enterprise):** configurar en Google Cloud una cuota diaria de la Routes API y una alerta de presupuesto. Enterprise: 1.000 llamadas gratis/mes y USD 15,00 por 1.000 (consultado el 2026-10-26); la app refresca la ruta cada 120 s con el mapa visible y no recalcula al volver a primer plano si la ruta tiene menos de 60 s.
- **Deploy a producción (Tarea 17 del plan de Fase 2): completo y
  verificado en `https://sweetsin.com.au/` real** — ver Intentos fallidos
  #13 y #14 para el detalle de los dos incidentes post-push y sus fixes.
- **Rotar la contraseña de Postgres en EasyPanel** — la `DATABASE_URL`
  completa (con contraseña) quedó expuesta en texto plano en el chat de
  esta sesión (mensaje de texto y screenshot) durante el diagnóstico del
  incidente #13. Recomendado, todavía no confirmado que se haya hecho.
- **El servicio `apps/api` en EasyPanel sigue roto**, arrastrado desde el
  cierre de Fase 1 — pendiente de que el owner lo pause/elimine
  manualmente. Sigue fuera de mi alcance.
- **Revisión de copy pendiente**: las traducciones al español de los 16
  productos (`packages/db/src/seed.ts`) son un primer borrador de Claude,
  no revisadas por Oscar. Corregirlas es tan simple como editar el array y
  re-correr `pnpm --filter @workspace/db run seed` (idempotente).
- **Confirmar los smoke tests manuales de Fase 3 (Tarea 22, pasos 4-6)** —
  quedaron delegados al owner en esta sesión por la falla del MCP de
  Chrome (Intentos fallidos #15). Antes de dar Fase 3 por verificada de
  punta a punta: confirmar que el checkout de invitado vía WhatsApp
  persistió una orden real y se borró después, que el pago con tarjeta
  respondió `503` explícito, y que el carrito sobrevive a un `F5`.
- **Cuando lleguen las credenciales reales de Stripe**: declarar
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` en `apps/web/.env.local` (y en
  EasyPanel al deployar — esta última como `ARG`/`ENV` de build, mismo
  patrón que `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` del incidente #14), y
  probar el flujo de pago con tarjeta end-to-end. Hasta entonces el panel
  de pago con tarjeta queda con el mensaje "coming soon" — comportamiento
  esperado, no un bug.
- **Deploy de Fase 3 a producción: completo** — confirmado implícitamente
  al deployar Fase 4 encima sin ningún problema atribuible a Fase 3.
- **Fase 4 — Auth.js + panel admin: completa, deployada y verificada de
  punta a punta en producción real** (ver Estado actual e Intentos
  fallidos #17-28). `CartRepository`/`syncCart`/`mergeGuestCart`
  (construidos en Fase 3 sin wiring de UI) ya están conectados al flujo de
  login real.
- **Rotar `ADMIN_SEED_PASSWORD`: hecho.** La contraseña original había
  quedado en texto plano en el chat de esta sesión (el owner la tipeó
  directamente para que Claude corriera el seed) — se rotó re-corriendo
  `pnpm --filter @workspace/db run seed` con una contraseña nueva
  generada al azar (no queda registrada en ningún archivo del repo, solo
  se la sabe el owner).
- **Fase 5 — deployada y verificada por el owner contra producción real
  (`https://sweetsin.com.au/`), con un bug real encontrado y arreglado en
  el camino.** Las 25 tareas del plan están cerradas:
  - Tarea 22 (checklist manual de event bookings + calendario + smoke de
    Fase 4): **corrida por el owner contra producción, todo funcionando**
    salvo el punto de abajo.
    - **Al probarla, el owner encontró que crear una parada nueva tiraba
      un 500** — diagnosticado y arreglado en esta misma sesión, ver
      Intentos fallidos #39 (validación de rango de horario faltante en
      `trailer-stop-form.tsx`). Pendiente: **owner debe commitear y
      pushear este fix** (`apps/web/src/components/admin/
      trailer-stop-form.tsx` + 3 archivos de `packages/i18n`) para que
      llegue a producción — no estaba incluido en el push de la Tarea 25.
  - **Pedido nuevo del owner, fuera del alcance original del plan:
    autocompletado de direcciones — implementado.** `google.maps.places.Autocomplete`
    atado al input de "Location name" existente en `trailer-stop-form.tsx`
    (mismo patrón `importLibrary`/`ensureGoogleMapsOptionsSet` que
    `LocationPicker`), restringido a `country: "au"`. Al seleccionar una
    predicción: `location` se completa con la dirección formateada, y
    `lat`/`lng` se actualizan — `LocationPicker` se extendió para
    reaccionar a cambios de `lat`/`lng` que vienen de afuera (no solo de
    que el propio usuario arrastre/clickee el pin), con `panTo`/
    `setPosition` sobre refs al mapa/marker ya creados, sin recrear el
    mapa. Verificado con `typecheck`/`lint`/`build` (sin navegador, a
    pedido del owner para priorizar agilidad) — falta la verificación
    visual/interactiva real, pendiente de que el owner la pruebe en
    producción. Costo pendiente de evaluar: Places Autocomplete tiene
    facturación propia de Google, separada de Maps JS/Static que ya se
    usaba.
  - **Scope conocido, documentado en el plan**: editar una `trailer_stop`
    ya existente (location/horario) NO está soportado — solo crear +
    cambiar status a `completed`/`cancelled`. `event_bookings` sí tiene
    edición completa de detalles vía `updateEventBookingDetails`. Evaluar
    si hace falta agregar edición de paradas más adelante, a pedido del
    owner.
  - **Fase 6 (Notificaciones nativas): completa** — ver bloque dedicado
    más abajo.
- **Limpieza de datos de prueba**: las 17 filas `Jane Doe` /
  `jane@example.com` acumuladas en `orders` por corridas repetidas de
  `order-repository.test.ts` (Fases 2 y 3) se borraron a pedido explícito
  del owner en esta sesión (`orders` + `order_items`, verificado por
  `count(*)` antes de borrar). **Sigue pendiente**: `DrizzleCartRepository`
  (Tarea 5 de Fase 3) dejó un usuario y un producto de prueba con prefijo
  `cart-test-` en la DB compartida dev=prod, sin cleanup (a diferencia del
  test de `settings`, que sí revierte) — no se tocó en esta sesión. Bajo
  riesgo (prefijo identificable, no interfiere con datos reales), pero
  borrarlos si se quiere una DB limpia. Si esto se repite, considerar
  agregar cleanup (`afterAll`) a esos tests de integración en vez de seguir
  limpiando manualmente después de cada corrida.
- Datos de prueba de la Tarea 21 de Fase 5 (parada "Rundle Mall Test Stop"
  con su `stop_product_stock`/`stock_events`, y la reserva "Overlap Test
  Client") se limpiaron y se confirmó el borrado con un 404 real al
  revisitar la parada. No queda pendiente nada de esta verificación.
- **Fase 6 — Notificaciones nativas: código completo, commiteado (17
  commits en `main`) y con revisión final de todo el branch ya corregida.
  Falta lo siguiente:**
  - **Credenciales SMTP reales**: declarar `SMTP_HOST`, `SMTP_PORT`,
    `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` en `apps/web/.env.local` (y
    en EasyPanel al deployar, como variables de runtime — a diferencia de
    `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`/Stripe, estas no son `NEXT_PUBLIC_*`
    así que no hace falta pasarlas como `ARG`/`ENV` de build, alcanza con
    declararlas en el servicio). Hasta entonces cada envío queda logueado
    `blocked` — comportamiento esperado, no un bug. Probar el flujo real
    de punta a punta (checkout de invitado + cliente logueado, ambos
    idiomas) recién cuando estén conectadas.
  - **Verificación manual delegada al owner** (mismo patrón que fases
    anteriores, ver checklist sugerida al cierre de la Tarea 16 en el
    chat de esta sesión, no persistida como archivo): (1) sin `SMTP_*`
    configuradas, checkout de invitado en `/es` → confirmar que la orden
    se crea igual y aparece una fila `blocked`/`locale: es` en
    `/admin/email-logs`; (2) loguearse como cliente, cambiar a español en
    `/account/settings`, hacer un checkout estando en `/` (inglés) →
    confirmar que la fila de esa orden queda con `locale: es` (la
    preferencia guardada gana sobre el locale de la página); (3) pedir
    una cotización de evento en `/` → confirmar fila con
    `type: event_quote_receipt`, `locale: en`.
  - **`CLAUDE.md:11` quedó desactualizado** (finding Minor de la revisión
    final, no corregido a propósito por no ser bloqueante): sigue
    diciendo que `pnpm run test` cubre solo `packages/domain` y
    `packages/db`, pero el script raíz (`pnpm -r --if-present run test`)
    ya corre también `packages/i18n` y el nuevo `packages/notifications`.
    Corrección de una línea, pendiente para la próxima vez que se toque
    ese archivo.
  - **Nota de arquitectura para cuando se conecten las credenciales
    reales** (recomendación de la revisión final, no bloqueante):
    `placeOrderAction`/`requestEventQuoteAction` **awaitean** el envío
    del email dentro del propio Server Action — acopla la latencia del
    checkout/cotización a un handshake SMTP de un tercero. Hoy es
    invisible porque no hay credenciales (falla rápido con
    `SmtpNotConfiguredError`), pero conviene decidir a propósito (¿fire
    -and-forget? ¿cola?) antes de que el primer envío real lento se note
    en producción, y documentar la decisión en Architecture decisions de
    `CLAUDE.md`.
  - Otros findings Minor de la revisión final, documentados pero no
    corregidos por no ser bloqueantes (ver reporte completo si hace
    falta el detalle): `error_message` de `email_logs` se persiste pero
    no se muestra en la tabla del admin; un `locale` faltante en el
    `FormData` de la cotización de evento falla toda la solicitud en vez
    de degradar a un default; los casts `as EmailLog`/`as Locale` en los
    repositorios son un patrón intencional pero no verificado en
    runtime; `smtp-notification-adapter.test.ts`/
    `expo-notification-adapter.test.ts` solo testean
    `sendOrderConfirmation`, no `sendEventQuoteRequestReceipt`, y ningún
    test ejercita `SmtpNotificationAdapter.send()` con nodemailer
    mockeado (es el único código nuevo del paquete sin cobertura directa);
    `account/layout.tsx` hardcodea `callbackUrl: "/account/orders"` para
    cualquier redirect a login, incluso si el usuario iba para
    `/account/settings`; `log.createdAt.toLocaleString()` en el admin
    formatea con el locale default del servidor, no con el de la página.
- **Fase 7 — Apps de despachador/delivery (Expo) + gestión de staff:
  código completo, commiteado (20 commits en `main`) y con revisión final
  de todo el branch ya corregida. Falta lo siguiente:**
  - **Deploy a producción: completo, sesión posterior.** `apps/web` con
    los 20 commits de Fase 7 deployado en EasyPanel (`platforms/sweetsin-web`)
    y verificado (`MOBILE_JWT_SECRET`/`EXPO_PUBLIC_APP_SECRET` declaradas
    en el servicio, build exitoso, `/dispatch`/`/delivery`/`/admin/staff`
    confirmados `force-dynamic` — no congelados pese al símbolo `●` del
    resumen de `next build`, mismo gotcha que #12 de Fase 2). Deploys de
    seguimiento aplicados en la misma sesión para los 2 commits del fix de
    `findQueueForDespachador` y el endpoint `delivery-staff` (Intentos
    fallidos #51/#52).
  - **`apps/mobile` — probada de punta a punta en dispositivo real con
    Expo Go (sesión posterior, ver Intentos fallidos #49-53) y
    funcionando: login por PIN → JWT → cola → `in_prep` →
    `ready_for_pickup` → asignar delivery → `out_for_delivery` → login como
    delivery → `delivered`, confirmado en cada paso contra la Postgres
    real.** En el camino se encontraron y corrigieron 4 bugs reales
    invisibles a typecheck/tests (crash de `expo-notifications` en Expo
    Go, layout roto de `LoginScreen`, `findQueueForDespachador` sin
    `ready_for_pickup`, y dos features completas faltantes en el scaffold
    — asignación de delivery y logout, ninguna de las dos estaba en el
    brief original de la Tarea 14). **Push notifications reales
    (`expo-notifications` en un development build, no Expo Go) siguen sin
    probarse** — Expo Go dejó de soportar push remotas desde el SDK 53,
    así que esa parte del flujo (`notifyDeliveryAssigned` de punta a
    punta) solo se puede validar con un EAS development build real, fuera
    de alcance de esta sesión.
  - **`/dispatch` y `/delivery` (web) — probados de punta a punta contra
    producción real y funcionando** (ver Intentos fallidos #54): mismo
    flujo completo que mobile, con un quinto gap encontrado y corregido en
    el camino (ninguna de las dos páginas tenía botón de logout).
  - **`apps/mobile` queda fuera del gate de typecheck del monorepo** —
    finding Minor de la revisión final, no corregido a propósito: no tiene
    un script `"typecheck"` en su `package.json`, así que `pnpm run
    typecheck` (raíz) nunca lo ejercita. Agregar
    `"typecheck": "tsc --noEmit"` ahí es la corrección más barata del
    lote de Minors diferidos.
  - **`/dispatch` y `/delivery` sin guard de middleware** (a diferencia de
    `/admin`, ver Intentos fallidos y el ledger de la Tarea 12) — un
    acceso sin sesión o con rol equivocado hoy cae en la página de error
    genérica de Next en vez de un redirect a `/login`. No es un hueco de
    seguridad (`requireStaff` igual bloquea el acceso), solo UX menos
    prolija; extender el middleware existente a estas dos rutas si se
    quiere paridad completa con `/admin`.
  - **Otros findings Minor de la revisión final, documentados pero no
    corregidos por no ser bloqueantes** (ver el detalle completo en el
    reporte de la revisión final si hace falta, no persistido como
    archivo — solo quedó en la transcripción de esta sesión): HMAC del
    cliente mobile firma solo el body del login sin timestamp (replay
    posible pero de impacto bajo, la propia spec ya trata el HMAC como
    filtro débil con el rate-limiting server-side como defensa real);
    falta un índice en `orders.assigned_delivery_user_id` (la spec lo
    pedía explícitamente); dos casos de `JSON.parse`/`verifyAppSignature`
    en el login mobile devuelven un 500 crudo en vez de un 4xx prolijo;
    `PushLogRepository.listAll()` implementado pero sin ninguna página
    admin que lo muestre (a diferencia de `/admin/email-logs` para SMTP);
    `resetStaffPinAction`/`toggleStaffActiveAction` aceptan cualquier
    `userId` sin filtrar que sea realmente staff (alcance admin-only, bajo
    riesgo); el nombre `EXPO_PUBLIC_APP_SECRET` es server-side-only en la
    práctica pero el prefijo `EXPO_PUBLIC_` invita a confundirlo con algo
    expuesto al cliente — vale un comentario aclaratorio la próxima vez
    que se toque ese archivo.
  - **Revisión de copy pendiente, mismo patrón que Fases 2/5**: los textos
    nuevos de `dispatch`/`admin.staff` en `packages/i18n` (namespaces
    agregados en esta sesión) son un primer borrador de Claude, no
    revisados por Oscar.

### Sesión APK de staff (2026-10-20/21)

**Acciones manuales del owner** (detalle en `docs/superpowers/decisiones-pendientes-apk.md`, sección C):
1. **M1:** `bash .superpowers/sdd/2026-10-20-apk-fundacion-delivery-offline/commit-por-tarea.sh` (24 commits). Luego commitear aparte el plan, el spec, `docs/design/*`, `decisiones-pendientes-apk.md`, `CLAUDE.md`, `handoff.md` y el checklist.
2. **M2:** generar el keystore (`keytool` en `C:\Program Files\Java\jre-1.8\bin\`) y cargar los secretos `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
3. **M3:** push a `main` y despachar los dos workflows (release y desarrollo).
4. **M4:** `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` (más `R2_ACCOUNT_ID` y `R2_BUCKET=sweet-delivery`) en `apps/web/.env.local` y EasyPanel; usar un token limitado al bucket, con solo lectura y escritura de objetos.
5. **M5:** borrar `EXPO_PUBLIC_APP_SECRET` de `apps/web/.env.local` y de EasyPanel.
6. **M6:** proyecto de Google Cloud con facturación; `GOOGLE_ROUTES_API_KEY` (servidor) y secreto de GitHub `GOOGLE_MAPS_ANDROID_API_KEY` (restringida por package + SHA-1; cubrir `au.com.sweetsin.staff` y `.dev`). Cuotas y alertas de presupuesto.
7. **M7:** un teléfono Android real que permita instalar APK.
8. Recompilar el build de desarrollo una vez (módulos nativos nuevos: SQLite, cámara, ubicación, mapas, tareas en segundo plano).

**Después:** recorrer `docs/superpowers/checklist-dispositivo-delivery.md` en el teléfono (Task 20, Steps 2-3), limpiar los datos de prueba (órdenes, filas de `delivery_locations`, objetos de evidencia en R2 y su registro en la base) y cerrar la revisión final de toda la rama.

**Decisiones abiertas** (sección A del documento de decisiones): Q-A (botón primario navy), C1/C2 (contraste del verde sobre Concha y del borde dorado), Q3 (Fraunces solo en el wordmark), Q-F (glifo "→" a validar en fabricantes), Q-E (mascota en SVG/PNG de al menos 1024 px), Q7 (botón de turno, ya implementado), Q8 y Q9. Q6 (consentimiento legal) y la retención de evidencia 7 a 30 días, con legal.

**Diferido:** pantalla del despachador, mapa de flota (Task 19: `GET /fleet`, `listSince`, `listFleetPositions`), admin móvil, TV, pedidos presenciales, ETA del despachador; vista admin web que lea las fotos con URL prefirmada; job de retención de evidencia; menores recomendados antes del merge (ver ledger).

### Sesión APK del despachador (2026-10-26)

1. Commitear el trabajo del índice (el owner, manualmente).
2. Recorrer la sección "Despachador" de `docs/superpowers/checklist-dispositivo-delivery.md` en un teléfono real, con un usuario `despachador` y otro `delivery`.
3. Decidir si se traducen los motivos de conflicto del dominio (hoy llegan en inglés).
4. Valorar acotar el `catch` de la ruta `assign` para no presentar errores de servidor como 409.
5. Siguen diferidos: mapa de flota, admin móvil, TV, pedidos presenciales y órdenes de retiro hasta "entregada".

### Sesión APK delivery: detalle, mapa y contacto (2026-10-26)

1. Commitear el trabajo del índice (el owner, manualmente).
2. Recorrer las casillas nuevas de las secciones de detalle/contacto/mapa de `docs/superpowers/checklist-dispositivo-delivery.md` en un teléfono real.
3. Recompilar el build de desarrollo si es anterior a `react-native-maps` (los módulos nativos exigen un build nuevo).
4. Confirmar que `GOOGLE_ROUTES_API_KEY` está cargada en EasyPanel y que el secreto de Maps (`GOOGLE_MAPS_ANDROID_API_KEY`) existe en GitHub antes de la release.
5. Decidir si se localizan los nombres de producto (R3) y vigilar el costo de Routes API (SKU Enterprise por el tráfico por tramo; refresco cada 120 s con el mapa visible; cuota diaria y alerta de presupuesto en Google Cloud).

### Sesión APK delivery: cierre y mapa gris (2026-10-27)

**Recomendado, en este orden:**
1. **Google Cloud (owner, 5 min):** *APIs y servicios → Maps SDK for Android → Métricas*. Con 4xx hay un problema de autorización; con cero peticiones, la app no llega a pedir mapa. Verificar que la clave liste *Maps SDK for Android* entre las APIs permitidas y que figure habilitada en la Biblioteca.
2. **Diagnóstico en la app (Claude, vía SDD):** que el aviso de `mapNotLoaded` muestre también si `onMapReady` se disparó ("listo: sí/no"). Separa "no hay objeto de mapa" de "hay mapa sin baldosas".
3. **Logcat:** reconectar el teléfono, abrir la app, y filtrar `adb logcat -d -b all -v time | grep -iE "maps|authentication|Google"`. Una clave rechazada suele aparecer como "Authentication failed" o "API key not valid".
4. **Si Google está bien:** probar sin `overflow: hidden`/`borderRadius` en el contenedor, y evaluar la nueva arquitectura (`newArchEnabled`) como causa. Un build de desarrollo nuevo basta para esta prueba.
5. Commits pendientes (ver Estado actual), prueba end-to-end de la foto de evidencia, y `test-order-caracas clean` al terminar.
6. **Más adelante:** cuota diaria y alerta de presupuesto para Routes API (SKU Enterprise; 1.000 gratis/mes, US$15 por 1.000); pasar a 3 claves restringidas en la cuenta de facturación del cliente; volver a la restricción de Adelaide (sesgo del autocompletado y validación de zona de entrega en el servidor); quitar `R2_DELIVERY_EVIDENCE_PREFIX` mal formado de EasyPanel si sigue.

**Sesión admin (2026-10-28) — próximos pasos:** (1) el owner revisa en `pnpm --filter @workspace/web run dev`: sidebar (colapsar/recargar, móvil, tooltips), `/admin/orders`, `/es/admin`; (2) estados de reservas de eventos, paradas y logs de email siguen como texto crudo (sin claves i18n ni badge); (3) `admin-calendar-view` (react-big-calendar) no se restiló; (4) Fase 8 pendiente (E2E, Lighthouse, deploy único, eliminar `apps/web-legacy`).

**Parte 2 — intentos fallidos:** un comando de shell muy largo con varios heredocs no se parseó y no escribió nada (se rehízo con Write); una prueba esperaba la URL de R2 en formato path-style cuando el SDK usa el bucket como subdominio (se corrigió la expectativa).

**Parte 2 — próximos pasos:** (1) [hecho] push de esquema y suite completa en verde; (2) en prod/local añadir `R2_ASSETS_BUCKET` si el bucket no se llama `sweet-assets`; (3) probar en dispositivo la credencial (necesita recompilar el APK de desarrollo solo si se agregan módulos nativos: aquí no); (4) paradas del trailer: definir con el owner (editar/eliminar/duplicar); (5) aviso de lint `<img>` en `staff-avatar.tsx` es intencional.

**Parte 3 — intentos fallidos:** otro comando de shell con varios heredocs no se parseó (se rehízo con Write); un actualizador de estado con efectos secundarios en `LoginScreen` se refactorizó a un `signIn` que devuelve resultado.

**Parte 3 — próximos pasos:** (1) probar en teléfono real: activar huella, entrar con huella, registrar otra huella (debe volver al PIN), cambiar PIN y contraseña, X y cerrar sesión de la credencial; (2) si Android no muestra el aviso de huella, agregar `android.permissions: ["USE_BIOMETRIC"]` en `app.json` (requiere recompilar el APK); (3) redeploy de `sweetsin-web` y `sweetsin-metro-android-dev`; (4) decidir si exigir PIN no trivial (ahora solo 6 dígitos); (5) paradas del trailer.
### Próximos pasos: plantillas de stock (2026-10-28)
1. Verificación manual en el navegador (guía en el informe de la tarea 8): crear plantilla, crear parada desde ella, editar la plantilla sin que cambie la parada, subir/bajar cantidades, guardar parada como plantilla, archivar/desarchivar.
2. Proyecto 3: abrir/cerrar el trailer, reponer en vivo, **pedidos ligados a una parada** (para que existan eventos `sale`) y mostrar "Agotado" en el sitio público. Ahí se prueba a mano la guarda de no bajar por debajo de lo vendido.
3. Quedan los proyectos de jornadas de delivery + stock compartido/separado y auth por token para la APK admin.
4. Menores diferidos (ledger `.superpowers/sdd/2026-10-28-plantillas-stock/progress.md`):
   - Dominio: test de update conservando su nombre (`excludeId`); `validate` revisa nombre antes que cantidades; archivar id inexistente sin test; tests de rechazo sin afirmar que nada se modificó; falta caso cantidad -1; fake de plantillas con `as unknown as`.
   - Repos: update de plantilla con id inexistente devuelve objeto parcial; ítems sin `orderBy`; create/update devuelven los ítems de entrada; test de update débil.
   - Endpoints: tests más finos (JSON malformado, 500 sin fuga, precedencia 404>409, DELETE 409, 401 en archive/unarchive); GET stock con `sumSold` por fila (N+1 pequeño); renombrar `stopNotFound` en `require-stop.ts`.
   - Panel: mover `isUuid` fuera de `app/api/admin/_lib`; limpiar el error de cantidad al editar; default 10 como número mágico; `window.confirm` nativo para borrar; `maxRaw` de `StockRow` no se resincroniza tras refresh; Remove sin confirmación; select de plantilla no controlado; "Plantilla guardada" puede coexistir con error; "Guardar como plantilla" oculto en paradas completadas; renombrar `stockTemplateErrorKey`; restock/waste siguen lanzando y con `Number()`.


### Proyecto 3: pendientes tras la revisión final (2026-10-28)

- Corregidos en `2acb118` y `974d2c4`: pago tardío de pedido cancelado (queda en atención `order_cancelled`), reversa de stock al cancelar siempre, eventos al cancelar parada, retiro con parada obligatoria si hay elegibles, producto no disponible, carrera de `resolveAttention`, índice `stock_events.order_id`.
- Diferidos (APK): enviar `occurredAt` en la cola offline de "Marcar entregada"; "Entregado al cliente" para retiros en la pantalla del despachador; rama 404 del despachador.
- Diferidos (web): salida para pedido cancelado y pagado con atención (reembolso manual), reversa+estado atómicos al cancelar, cancelar parada activa y número de pedidos en el rechazo, cuerpo de `open` con ajustes de stock, reporte por semana/monto y filtros por tipo/canal, `updatePaymentStatus` sin evento, `early_sellout` con `autoSoldOutEnabled` apagado.
- Sin probar en navegador; filas de prueba en la DB compartida pendientes de decisión del owner.

### Próximos pasos: proyecto 5 (2026-10-29)
**Guía de prueba manual en navegador:**
1. En `/admin/settings`, encender "Entrega a domicilio" (control de stock) y dejar el modo `separate`.
2. En `/admin/jornadas`, abrir una jornada con stock 5 de un producto.
3. En el sitio público elegir entrega a domicilio y pedir 6 unidades: el carrito se limita a 5 (el menú muestra "Quedan 5 a domicilio"); un pedido por 5 pasa y descuenta de la jornada.
4. Cerrar la jornada (o no abrir ninguna) y enviar una entrega: debe rechazar con el panel y el botón de WhatsApp, sin vaciar el carrito.
5. Con el mismo carrito elegir **retiro**: debe seguir funcionando como antes (stock de la parada).
6. Cambiar a modo `shared` con una parada trailer activa: la entrega descuenta de esa parada; revisar el aviso en `/admin/jornadas`.
7. Apagar el interruptor y confirmar que la entrega pasa sin reglas de stock.

**Diferidos:**
- El sobrante de una jornada cerrada es solo informativo (no vuelve a ningún lado).
- Una sola jornada abierta a la vez.
- En `shared`, las ventas de entrega se mezclan con las del retiro en la misma parada (con varias paradas activas se usa la más antigua, provisional).
- Tras un `deliveryRejected` el estado `delivery` del cliente queda obsoleto hasta recargar.
- Doble `role=alert` en el panel de rechazo; la URL de WhatsApp está duplicada en el cliente.
- Etiquetas "Activa"/"Completada" en vez de "Abierta"/"Cerrada" para jornadas.
- Menores por tamaño: falta el assert del default (`kind`) y `listVisible('delivery')` no tiene test; la validación de productos al abrir usa `findById` por producto.
- "Product not available" (producto desactivado) en una entrega con control encendido y sin jornada responde `deliveryRejected`.
- `/api/admin/trailer-stops/[id]/stock/**` siguen aceptando el id de una jornada (a propósito, se reutilizan).

**Siguiente:** auth por token para la APK admin y ejercitar todo en un navegador.

## Sesión: foto con cámara e idioma del staff (app mobile)
- Foto de perfil desde la app: `CredentialScreen` (cámara frontal/trasera con `expo-image-picker`, recorte cuadrado, calidad 0.4) sube a `POST/DELETE /api/mobile/account/photo` (mismo almacén R2 y reglas que el admin; tope 2 MB → 413 "foto pesada"). Sin módulo nativo nuevo. `cameraType` es una sugerencia en Android: algunos teléfonos la ignoran.
- Idioma: el campo `preferredLocale` que ya edita el admin en la ficha del staff es el idioma de la app. `GET /auth/me` devuelve `locale` y la app lo adopta (`useProfile`); `PUT /api/mobile/account/locale` lo guarda cuando el usuario lo cambia en la credencial. Se recuerda en SecureStore y `strings` es una vista viva (`i18n/live-strings.ts`); al cambiar, la navegación se remonta conservando la pantalla.
- Pendiente: probar cámara frontal/trasera y cambio de idioma en un teléfono real (hace falta redeploy de web y de Metro).

## Sesión: foto dentro de la app y banderas
- La foto se toma en la credencial tocando el círculo (insignia 📷): sin red de menús extra, `Alert` con Tomar foto / Elegir de la galería / Quitar foto. `PhotoCapture` (design-system/organisms) es una cámara dentro de la app (`expo-camera`, círculo guía, girar frontal/trasera, frontal por defecto). Todo se recorta al cuadrado central y se reduce a 600 px JPEG con `expo-image-manipulator` antes de subir (≈ decenas de KB; el tope de 2 MB deja de ser un riesgo). Se quitaron los botones "Cámara frontal/trasera".
- **Dos módulos nativos nuevos (`expo-camera`, `expo-image-manipulator`): hay que recompilar el build de desarrollo una vez** (workflow `build-dev-apk.yml`) y el release ya los incluye. `expo-camera` se agregó a la lista cerrada de paquetes de `design-system/architecture.test.ts` (es UI).
- Selector de idioma con banderas 🇪🇸 / 🇦🇺 (`OptionRow` acepta `flag`; el lector de pantalla lee solo el nombre del idioma).
- Pendiente: probar en teléfono real (permiso de cámara, frontal/trasera, espejo, recorte, galería).

### Próximos pasos: paradas CRUD completo (2026-10-28)
1. Verificación manual en navegador: sitio EN `/` y ES `/es` (etiquetas, aviso, paradas canceladas hasta su endTime) y admin (crear, editar, cancelar, reactivar, borrar incl. advertencia de stock y rechazo si hay pedidos).
2. Los 4 proyectos restantes: plantillas de stock; abrir/cerrar trailer + pedidos ligados a la parada; jornadas de delivery + stock compartido/separado; auth por token para la APK admin.
3. Menores diferidos (ver `.superpowers/sdd/2026-10-28-paradas-crud-completo/progress.md`): guardas de tests sin mensaje, DELETE de id inexistente devuelve 200, `[id]/edit` sin verificar status, botón "Create stop" en edición, tests de cancel/complete/reactivate, hora inexistente/ambigua de transición DST sin documentar, timeouts de tests db por latencia remota.

### Próximos pasos: proyecto 3 (2026-10-28)
**Guía de prueba manual en navegador:**
1. Crear una parada con stock (o desde plantilla) y abrirla (con confirmación de stock si está activa).
2. Hacer un pedido de retiro que agote un producto y ver "Agotado" en el menú.
3. Pagar el pedido desde el panel; reponer stock en vivo.
4. Cerrar la parada con pedidos pendientes y revisar el resumen de cierre.
5. Recorrer un pedido por todos los estados, incluido retiro entregado.
6. Abrir `/admin/reports/fulfillment` y exportar CSV.
7. En `/admin/settings` apagar `timingEnabled` y confirmar que no se registran eventos nuevos.
8. Provocar un pedido "requiere atención": probar reintentar, resolver y cancelar.

**Menores diferidos (ledger `progress.md`):** sin índice en `stock_events.order_id`; tests de concurrencia/restock débiles; `resolveAttention` sin guarda SQL de estado (TOCTOU) y `markAsPaid` pisa `attentionReason`; `decrementForOrder` tras reversa vuelve a descontar; TOCTOU parked en `cancelTrailerStop` (ventana de ms, solo admin); reporte: tamaños ordenados como string, suma por staff excede el total, sin tope de rango ni zona en datetimes; UI: id de 8 chars, contraste 11px, N+1 en `AttentionBadge`, nombre solo en inglés, `cancelArmed` sin reinicio; carrito: ids duplicados no se suman, errores por string exacto, sin refresco de disponibilidad, `listAll()` crece, textos con voseo, `zod` en vez de `zod/v4` en assign/route.

**Siguientes proyectos:** proyecto 4 (motor de capacidad/reglas calibrado con tiempos medidos); proyecto 5 (jornadas de delivery); rama 404 del despachador en la APK mobile (hoy se muestra como conflicto); ejercitar todo lo anterior en un navegador; decidir con el owner la limpieza de filas de prueba.


### Próximos pasos: proyecto 4 (2026-10-29)
**Guía de prueba manual en navegador (spec §10):**
1. En `/admin/capacity`, encender el motor y configurar un producto con tope de entrega 5 (con "Se vende en línea" activo). Completar de paso área de trabajo, vehículo y minutos por viaje.
2. En el sitio público, agregar 6 unidades de ese producto, elegir entrega a domicilio y enviar: debe rechazar con la razón (tope 5, puedes pedir hasta 5) y el botón de WhatsApp, sin vaciar el carrito.
3. Con el mismo carrito de 6, elegir **retiro**: debe pasar (el retiro no lo limita el motor; solo el stock).
4. Antelación: poner 120 min a un producto, pedir entrega sin hora (debe pedir una) y con una hora a 30 min (rechazo `lead_time` con la hora mínima); luego una hora válida.
5. Simulador: elegir productos y cantidades y revisar razones y tiempos; confirmar que no crea pedido y que funciona con el motor apagado (se fuerza a encendido).
6. Calibración: revisar la lista de productos con mediana medida vs configurada y el tamaño de muestra; sin datos debe mostrar "sin datos". Hace falta haber recorrido pedidos de una línea con cantidad 1 por `in_prep` y `ready_for_pickup`.
7. Apagar el motor y repetir el paso 2: el pedido debe pasar sin ninguna regla.

**Menores diferidos (ledger `progress.md` del proyecto 4):**
- T1: test `getSettings` frágil en DB compartida; los rechazos no verifican que no se escribió nada; `lastModifiedAt` no refleja el borrado total de pasos (documentado).
- T3: `toRejectionReasons` hacía `findById` por razón (N+1; ya deduplicado por `productId` y tolerante a fallos en T6); datetime sin offset (resuelto con `toISOString` en T6); duplicación literal de WhatsApp (resuelta con `business-contact.ts`); mensaje genérico en la UI (resuelto en T6).
- T4: `simulateAction` devuelve error genérico ante cualquier fallo; patrón `isInvalid` indirecto; `itemsByOrder` sin test de integración contra DB.
- T5: la tabla solo lista productos disponibles (la regla persiste al reactivar); el simulador ignora líneas inválidas sin aviso; el error `invalid` es genérico y sin `aria-invalid`; faltan tests de las claves `capReason_*`/`Help` del diccionario.
- T6: `catch` silencioso en la acción pública sin log; el cart drawer no muestra avisos (solo el paso de dirección); el `min` del input de fecha lee `new Date()` en cada render.
- Pendiente de confirmar con el dueño (spec §11): las decisiones marcadas "(mi decisión)", si el cliente debe ver la estimación (`showEstimateToCustomer`, apagado) y el número de WhatsApp al que se redirige.
- Spec §7 pedía mostrar `scheduled_for` y la estimación en el detalle de pedido admin: ninguna página admin lo muestra hoy (solo se guarda en `orders.scheduled_for`); queda pendiente.

**Siguiente proyecto:** proyecto 5 (jornadas de delivery + stock compartido/separado); después, auth por token para la APK admin y ejercitar todo en un navegador.
