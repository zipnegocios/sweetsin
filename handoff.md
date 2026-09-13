# Handoff — Sweet Sin

## Objetivo

Ejecutar `docs/superpowers/plan-desarrollo.md` fase por fase, sin adelantar
trabajo de fases posteriores. Sesión 1: roadmap completo (Fases 1-8) +
Fase 1 (Cimientos) de punta a punta. Sesión 2: plan bite-sized de Fase 2
vía `superpowers:writing-plans`, revisado con el owner en una interview
exhaustiva (`grill-me`, 8 preguntas reales resueltas) que cambió la
arquitectura de i18n a mitad de plan, y ejecución completa de las 17 tareas
con `superpowers:executing-plans`. Sesión 3 (esta): ejecución completa del
plan bite-sized de Fase 3 (Checkout, Carrito y Órdenes,
`docs/superpowers/plans/2026-09-13-fase-3-checkout-carrito-ordenes.md`,
24 tareas) con `superpowers:executing-plans`, directo sobre `main`.

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
- **Paso 6 (persistencia de `localStorage` tras F5): confirmar con el
  owner si quedó verificado** — no se confirmó explícitamente en el chat
  de esta sesión.

**Confirmar con el owner si el paso 6 se corrió y pasó antes
de dar la Fase 3 por verificada de punta a punta.**

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

## Próximos pasos

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
- **Deploy de Fase 3 a producción**: pendiente de que el owner corra
  `git push` manualmente y confirme el log de build de EasyPanel + el
  sitio real (mismo procedimiento que el deploy de Fase 2).
- **Arrancar Fase 4 — Auth.js + panel admin básico** (ver
  `docs/superpowers/plan-desarrollo.md`) — todavía no tiene plan
  bite-sized. No iniciar sin pedido explícito del owner. Es el momento en
  que `CartRepository`/`syncCart`/`mergeGuestCart` (construidos en Fase 3
  pero sin wiring de UI) finalmente se conectan a un flujo real.
- Decisión pendiente de Fase 5 ya anotada en `plan-desarrollo.md`: el panel
  admin debe resaltar visualmente las cotizaciones de evento con
  `location = "TBD"`.
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
