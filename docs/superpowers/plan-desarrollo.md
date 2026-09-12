# Sweet Sin — Plan de desarrollo

> Este documento reemplaza cualquier plan anterior basado en `attached_assets/`
> (Next.js 14 + Sanity + Stripe + Vercel) o en `Prompts.txt` (ya eliminado por
> exponer una API key). Fue construido desde cero en sesión de brainstorming,
> pregunta por pregunta, con el owner del proyecto. Todo lo que dice "Fase 0"
> es innegociable salvo que el propio owner lo reabra explícitamente.

## Cómo usar este documento

- Se ejecuta **una fase/hito a la vez**, en el orden de la sección "Orden de
  ejecución". No se adelanta trabajo de una fase posterior, aunque parezca
  eficiente — se anota como nota para esa fase.
- **Dos niveles de detalle por fase** (decisión del owner, 2026-09-12): este
  documento da a cada fase un nivel "roadmap" — objetivo, alcance,
  entregables concretos, schema/archivos que toca, criterios de aceptación
  borrador. El desglose bite-sized (paso a paso, TDD, con las firmas exactas
  de funciones/tipos) se escribe como plan dedicado en
  `docs/superpowers/plans/` **al llegar a cada fase**, una vez que la fase
  anterior ya produjo las interfaces reales que la siguiente consume. Se
  evita así inventar firmas que probablemente cambien. Fase 1 ya tiene su
  plan bite-sized: `docs/superpowers/plans/2026-09-12-fase-1-cimientos.md`.
- Al terminar cada fase: resumen de lo hecho, resultado real de cada criterio
  de aceptación (comandos + salida real, no descripción de lo que "debería"
  pasar), y cualquier decisión tomada por ambigüedad señalada explícitamente
  ("decisión no especificada, tomé X por Y razón — confirmame"). Se espera
  confirmación explícita antes de tocar la siguiente fase.
- Si el código existente contradice una decisión de Fase 0, no se resuelve
  unilateralmente — se detiene y se pregunta.
- Si falta una credencial o servicio externo (Stripe, SMTP, EasyPanel), se
  señala explícitamente al principio de la fase correspondiente en vez de
  mockearlo en silencio.
- Commits chicos y trazables por unidad de trabajo (no uno gigante por fase),
  con mensajes que referencien la fase y la tarea. Claude nunca ejecuta
  `git commit` — solo `git add` y sugiere el comando exacto en el chat.
- Se trabaja directo sobre `main`. Sin branches, sin PRs.

---

## Fase 0 — Decisiones congeladas

### Stack y arquitectura

- **Framework web:** Next.js 15 (`apps/web`) — sitio público + panel admin.
  Reemplaza el prototipo Vite + React actual, que se trata como descartable.
- **Backend:** sin servicio Express separado. `apps/web` actúa como adaptador
  de entrada/salida (Server Actions / Route Handlers) inyectando repositorios
  concretos en los casos de uso del dominio.
- **Arquitectura de negocio: Hexagonal estricta.**
  - `packages/domain` — entidades, puertos (interfaces) y casos de uso en
    TypeScript puro. Cero imports de Next.js, Drizzle, Stripe, Expo, etc.
  - `packages/db` — schemas Drizzle, migraciones, repositorios concretos que
    implementan los puertos de `packages/domain`.
  - `packages/notifications` — adaptadores de notificación. **100% nativos:
    sin proveedores de terceros (explícitamente sin Resend).** Email
    transaccional por SMTP propio; push a mobile vía Expo Notifications.
  - `apps/mobile` (Expo) — planeado para Fase 7 (ver más abajo), una vez que
    la base web esté sólida y probada. Hito separado para no mezclar
    contextos de build ni bloquear el frontend web.
- **Descartado explícitamente:** `apps/api` (Express 5), el pipeline
  `lib/api-spec` + `lib/api-zod` + `lib/api-client-react` (OpenAPI + Orval),
  y Resend como proveedor de notificaciones.
- **Testing:** Vitest en `packages/domain` obligatorio desde el día uno (es
  la razón de ser de Hexagonal — el motor de reglas de negocio nace
  testeado). Tests de integración en `packages/db` contra DB real,
  validando que los repositorios cumplen los puertos. E2E con Playwright se
  pospone al sprint de QA pre-lanzamiento (Fase 8).
- **DB:** PostgreSQL + Drizzle ORM, misma instancia EasyPanel que hoy (dev y
  prod comparten Postgres — cuidado con `push --force`).
- **Internacionalización: bilingüe ES/EN en todo el producto** (decisión
  ampliada 2026-09-12, ver decisión resuelta #1 más abajo) — no solo el
  catálogo público, también el panel admin y la futura app mobile. Se
  resuelve con un paquete compartido `packages/i18n` (diccionarios
  framework-free) creado en Fase 2 y reutilizado en Fases 4 y 7.

### Negocio: fulfillment, pagos, órdenes

- **Fulfillment:** pickup + self-delivery (fee fijo). Courier/Uber Direct
  queda fuera de alcance por ahora.
- **Pagos:** Stripe real (PaymentIntent + webhook) es la decisión congelada.
  **Credenciales de Stripe no disponibles todavía** — se construye el
  sistema listo para conectarlas, sin mockear el flujo en silencio. La fase
  de Stripe queda explícitamente bloqueada hasta recibir credenciales de
  test/live.
- **Persistencia de órdenes:** todas las órdenes se persisten en Postgres
  desde el día uno, sin importar el canal (WhatsApp o tarjeta).
- **Precio y descuentos:** el cálculo de precio/descuento por volumen vive en
  `packages/domain` (fuente de verdad única) — el frontend solo muestra, no
  calcula el total que se cobra.
- **Ciclo de vida de una orden — dos campos independientes:**
  - `payment_status`: `pending | paid | failed | refunded`
  - `fulfillment_status`: `pending | received | in_prep | ready_for_pickup | out_for_delivery | delivered | cancelled`
  - Solo `payment_status = 'paid'` **y** `fulfillment_status = 'received'`
    entran a la cola activa (Kitchen Display) del despachador.

### Usuarios, roles y seguridad

- **`users.role` enum:** `admin | despachador | delivery | customer`. Sin
  tablas de permisos granulares (`permissions`, `role_permissions`) —
  autorización vía guards por rol a nivel de endpoint
  (`requireRole(['admin'])`, etc.).
- **Personal operativo** (`despachador`, `delivery`): `pin_hash` (bcrypt o
  argon2, PIN de 6 dígitos) + `is_active` (revoca sesión al desactivar).
- **Login por PIN (mobile, Fase 7):** endpoint aislado del tráfico web
  público. Validación de integridad del cliente (Play Integrity API /
  DeviceCheck, o como mínimo HMAC de build + rate limiting estricto:
  bloqueo tras 3-5 intentos fallidos por IP/dispositivo). JWT de sesión con
  TTL corto, revocable vía `is_active`. Infraestructura exacta de
  attestation: **decisión pendiente, se cierra al arrancar Fase 7** (no
  bloquea nada anterior).
- **Separación por plataforma:**
  - Web: `admin` en `/admin/*`. `customer` vía Auth.js para preorder y panel
    de usuario (login opcional — ver decisión resuelta #3).
  - Mobile (Expo, Fase 7): `despachador` (cola de preparación + stock) y
    `delivery` (órdenes asignadas + confirmación de entrega), cada uno
    autenticado por PIN.

### Inventario y calendario

- **Inventario numérico por parada** (no booleano, no solo "por día"):
  - `trailer_stops` — instancias reales por fecha (`start_time`, `end_time`
    exactos), **no** un patrón semanal estático.
  - `stop_product_stock` — por parada y producto: `max_stock` y
    `current_stock`. Se descuenta automáticamente y en tiempo real con cada
    preorden pagada (wiring en Fase 3, al confirmar el pago). Al llegar a 0,
    el producto se desactiva solo para esa parada en el canal público (no
    globalmente).
  - `stock_events` — log de auditoría de cada movimiento de stock: venta
    automática, merma (cantidad + motivo), agotamiento anticipado,
    reposición. Reportado por el despachador desde la app (Fase 7) o
    generado automáticamente por el sistema en cada venta.
- **Eventos privados B2B (catering) — completamente aislados del inventario
  público:** `event_bookings` cubre todo el ciclo desde la cotización inicial
  (reemplaza el `console.log` actual de `Events.tsx`) hasta la ejecución.
  Tiene su propio inventario "por encargo" (cantidades acordadas por
  cotización), que **nunca** descuenta de `stop_product_stock`.
- **Conflictos de calendario:** si un `event_booking` está confirmado y se
  intenta crear un `trailer_stop` público que se solapa en fecha/hora, el
  panel admin **advierte visualmente** pero no bloquea — se mantiene
  flexibilidad manual para Oscar.

---

## Decisiones resueltas después del brainstorming inicial

Estas quedaron abiertas durante el brainstorming original y se cerraron el
**2026-09-12**, al arrancar la planificación completa (Fases 1-8), porque
bloqueaban poder planificar en serio Fases 2 y 3. Se documentan acá para que
no se reabran sin que el owner lo pida explícitamente.

1. **Idioma del sitio → Bilingüe ES/EN con toggle, en todo el producto
   (no solo el catálogo).** `products` necesita campos bilingües desde el
   schema (`name_en`/`name_es`, `description_en`/`description_es`, ver
   boceto de schema abajo). El panel admin (Fase 4) y la app mobile
   (Fase 7) también deben ser bilingües — se resuelve con un paquete
   compartido `packages/i18n` de diccionarios framework-free, creado en
   Fase 2 (primera UI real) y reutilizado en Fases 4 y 7. **Cerró Fase 2.**
2. **Convención de nombres en DB → `snake_case`**, confirmado por default
   (sin corrección) al llegar a Fase 1.2 — es el estándar Drizzle, el
   default menos sorpresivo. **Cerró Fase 1.2.**
3. **Checkout de invitado vs. cuenta obligatoria → Checkout de invitado,
   cuenta opcional.** Pickup/self-delivery sigue permitiendo checkout sin
   cuenta, igual que hoy. `orders.customer_id` es **nullable**. Un
   `customer` logueado con Auth.js puede opcionalmente asociar la orden a su
   cuenta para ver historial (Fase 4). **Cerró Fase 1.2 y Fase 3.**
4. **Persistencia del carrito → Sincronizado server-side para un `customer`
   logueado.** Requiere tablas `carts`/`cart_items` (creadas en Fase 1.2,
   ver boceto de schema) y lógica de merge (carrito local invitado ↔ carrito
   server-side al iniciar sesión) construida en Fase 3. Un visitante sin
   cuenta sigue usando `localStorage` como hoy. **Cerró Fase 1.2 y Fase 3.**
5. **Ubicación del scaffold de Next.js 15 mientras convive con el prototipo
   Vite en producción → Se reemplaza `apps/web` ahora.** El código Vite
   actual se mueve a `apps/web-legacy` (referencia, no se deploya más). El
   sitio público en producción (EasyPanel) queda sin catálogo/checkout
   funcional (solo el placeholder por defecto de Next.js) hasta que la
   Fase 2 reconstruya esas pantallas — **downtime funcional aceptado
   explícitamente por el owner**, no un efecto colateral silencioso. El
   servicio `apps/web` de EasyPanel necesita que alguien con acceso al panel
   actualice o pause el build mientras tanto (fuera del alcance de Claude).
   `apps/web-legacy` se elimina del todo en Fase 8. **Cerró Fase 1.1.**

---

## Boceto de schema (Fase 1 — referencia, no DDL final)

```
users              (id, name, email?, role, pin_hash?, is_active, created_at)
products           (id, slug, category, name_en, name_es, description_en, description_es, price_cents, image_url, featured, available, created_at)

trailer_stops        (id, location, lat, lng, start_time, end_time, status, created_at)
stop_product_stock   (id, stop_id -> trailer_stops, product_id -> products, max_stock, current_stock)
stock_events         (id, stop_product_stock_id, event_type, quantity, reason?, reported_by_user_id?, created_at)

event_bookings       (id, client_name, client_company?, client_email, client_phone, event_type, event_date, start_time, end_time, location, estimated_guests, status, notes?, created_at, updated_at)
event_booking_items  (id, event_booking_id, description, quantity, agreed_unit_price_cents)

carts              (id, customer_id -> users, created_at, updated_at)
cart_items         (id, cart_id -> carts, product_id -> products, quantity)

orders             (id, customer_id?, customer_name, customer_email, customer_phone, fulfillment_type, delivery_address?, stop_id?, payment_status, fulfillment_status, subtotal_cents, discount_cents, delivery_fee_cents, total_cents, channel, stripe_payment_intent_id?, created_at, updated_at)
order_items        (id, order_id, product_id, quantity, unit_price_cents, line_discount_cents)
```

Nota: las tablas propias de Auth.js (sesiones, cuentas OAuth si aplica) no
están en este boceto — se agregan en Fase 4 cuando se elige el provider
exacto, porque su forma depende de esa elección y no son schema "de
negocio".

---

## Orden de ejecución

### Fase 1 — Cimientos (dominio, base de datos, monorepo)

**Objetivo:** dejar la base completa (schema de todo el negocio + dominio
hexagonal + tests) sólida antes de construir ninguna UI. Es la fase de mayor
riesgo de ambigüedad — se ejecuta con más detalle y checkpoints que las
siguientes. **Plan bite-sized completo:**
[`docs/superpowers/plans/2026-09-12-fase-1-cimientos.md`](plans/2026-09-12-fase-1-cimientos.md).

**Alcance:**
1. **1.1 — Retirar prototipo descartado y reestructurar el monorepo:**
   eliminar `apps/api`, `lib/api-spec`, `lib/api-zod`, `lib/api-client-react`
   (commit propio, identificable). Crear `packages/domain`, mover `lib/db`
   a `packages/db`, crear `packages/notifications` (esqueleto). Mover el
   prototipo Vite de `apps/web` a `apps/web-legacy` y scaffoldear Next.js 15
   en `apps/web` (ver decisión resuelta #5).
2. **1.2 — Schema completo de Drizzle** en `packages/db`: todas las tablas
   del boceto de arriba (decisiones #2, #3 y #4 ya resueltas). Migraciones
   aplicadas contra el Postgres de EasyPanel (dev=prod, cuidado).
3. **1.3 — `packages/domain`:** entidades + puertos (interfaces de
   repositorio) + casos de uso base para cada dominio (productos, pricing,
   órdenes, stock, usuarios, eventos) + puertos externos (pagos,
   notificaciones). Vitest desde el primer caso de uso escrito.
4. **1.4 — `packages/db` repositorios:** implementaciones concretas de los
   puertos usando Drizzle. Tests de integración contra DB real.

**Criterios de aceptación:** `pnpm run typecheck` limpio, suite de Vitest de
`packages/domain` y `packages/db` en verde, migraciones de Drizzle aplicadas
sin error, el caso de uso "crear orden" probado de punta a punta con un
repositorio real (Postgres).

**Restricciones:** no se toca `apps/web` más allá del scaffold — nada de UI
de catálogo, checkout ni admin todavía. No se instala Stripe SDK todavía
(eso es Fase 3). No se crea `packages/i18n` todavía (eso es Fase 2).

### Fase 2 — Catálogo público bilingüe (primer slice de UI)

**Objetivo:** sitio público real en Next.js 15 (`apps/web`) sirviendo
productos reales desde `packages/db` (reemplaza el placeholder del scaffold
y el `data.ts` hardcodeado de `apps/web-legacy`), con selector de idioma
ES/EN, sin checkout todavía.

**Alcance:**
- Migrar las secciones de `apps/web-legacy` (Hero, Menu, BrandStory,
  FindUs, Events sin el formulario roto, Footer) al App Router de Next.js.
- Crear `packages/i18n`: diccionarios ES/EN framework-free, consumidos acá
  vía la librería de i18n que se elija para Next.js (ej. `next-intl`) y
  reutilizados tal cual en Fase 4 (admin) y Fase 7 (mobile, vía su propia
  librería de i18n para Expo).
- Server Component que usa `listAvailableProducts` (`packages/domain`,
  Fase 1.3) vía `DrizzleProductRepository` (`packages/db`, Fase 1.4) para
  listar el catálogo — reemplaza `apps/web-legacy/src/lib/data.ts`.
- `FindUs` deja de usar el array `schedule` hardcodeado y lee
  `trailer_stops` activos desde Postgres.
- El formulario de cotización de `Events.tsx` pasa de `console.log` a un
  Server Action que llama `requestEventQuote` (`packages/domain`, Fase 1.3);
  el flujo completo de gestión de la cotización (cambiar status, agregar
  items) es Fase 5 — acá solo se persiste la solicitud inicial.

**Schema/archivos:** no crea tablas nuevas (usa `products` y
`trailer_stops` de Fase 1.2). Toca `apps/web/app/**`, `packages/i18n/**`
(nuevo).

**Criterios de aceptación (borrador, se precisan al arrancar la fase):**
`pnpm run typecheck` limpio; el catálogo público muestra productos reales
desde Postgres en ambos idiomas; una cotización de evento enviada desde el
formulario aparece como fila real en `event_bookings`.

### Fase 3 — Checkout, carrito y órdenes

**Objetivo:** `CheckoutModal` reconstruido sobre Next.js con persistencia
real de órdenes, carrito sincronizado server-side para un `customer`
logueado, motor de descuento por volumen ya vive en `packages/domain`
(Fase 1). Stripe: scaffold completo pero bloqueado hasta credenciales.

**Alcance:**
- `CartRepository` (puerto en `packages/domain/src/cart/`) + casos de uso
  `syncCart`/`mergeGuestCart` + `DrizzleCartRepository` (`packages/db`),
  usando `carts`/`cart_items` ya creadas en Fase 1.2. Un visitante sin
  cuenta sigue usando `localStorage`; al loguearse, su carrito local se
  fusiona con el carrito server-side.
- El Server Action de checkout valida el input crudo (dirección, contacto)
  con Zod y llama `createOrder` (`packages/domain`, ya existe desde
  Fase 1.3).
- WhatsApp se mantiene como canal alternativo (`channel: "whatsapp"`),
  también persistiendo la orden vía `createOrder`.
- Stripe: instalar SDK, implementar `PaymentGateway`
  (`apps/web/src/infra/stripe-payment-gateway.ts`, adaptador del puerto de
  `packages/domain/src/payments/ports.ts` de Fase 1.3) + Route Handler de
  webhook que actualiza `payment_status`. Al confirmar `payment_status =
  'paid'`, el webhook llama `decrementStockOnSale` (`packages/domain`,
  Fase 1.3) por cada item de la orden si tiene `stop_id`. **Bloqueado hasta
  recibir credenciales de test/live** — se avisa explícitamente al arrancar
  esta fase si siguen sin llegar; no se mockea el flujo en silencio.

**Schema/archivos:** no crea tablas nuevas. Toca `apps/web/app/checkout/**`,
`packages/domain/src/cart/**` (nuevo), `packages/db/src/repositories/cart-repository.ts`
(nuevo), `apps/web/src/infra/stripe-payment-gateway.ts` (nuevo).

**Criterios de aceptación (borrador):** checkout completo persiste una
orden real vía WhatsApp; vía tarjeta queda armado y probado contra el modo
test de Stripe si las credenciales ya llegaron (si no, se documenta el
bloqueo); el carrito de un `customer` logueado sobrevive a un refresh y a un
dispositivo distinto; una orden pagada con `stop_id` descuenta stock real.

### Fase 4 — Autenticación y panel admin básico

**Objetivo:** Auth.js para `customer` (login opcional) y para `admin`,
guards por rol, primer panel admin: ver órdenes reales, cambiar
`fulfillment_status`.

**Alcance:**
- Auth.js (NextAuth) con `DrizzleAdapter` contra `packages/db`
  (`usersTable`). Provider exacto para el login de `admin` (credentials vs.
  magic link) — **decisión pendiente, se cierra al arrancar esta fase**, no
  bloquea nada anterior. Tablas propias de Auth.js (sesiones/cuentas) se
  agregan acá, no en Fase 1.2, porque su forma depende de esta elección.
- `middleware.ts` en `apps/web` protegiendo `/admin/**` por rol.
- Panel admin: tabla de órdenes (nuevo método `listAll` en `OrderRepository`)
  + acción para cambiar `fulfillment_status` (nuevo caso de uso
  `updateFulfillmentStatus` en `packages/domain/src/orders`).
- Panel admin bilingüe, usando `packages/i18n` (Fase 2).

**Schema/archivos:** agrega tablas de Auth.js (forma exacta a definir al
llegar). Toca `apps/web/app/admin/**`, `apps/web/middleware.ts`,
`packages/domain/src/orders/**`, `packages/db/src/repositories/order-repository.ts`.

**Criterios de aceptación (borrador):** `admin` se loguea, ve órdenes reales,
cambia `fulfillment_status` y el cambio persiste en Postgres. `despachador`
y `delivery` todavía no tienen UI web (llega con la app mobile en Fase 7) —
solo existen como rol en `users`.

### Fase 5 — Inventario y calendario del trailer

**Objetivo:** UI real en el panel admin para `trailer_stops`,
`stop_product_stock`, `stock_events` y `event_bookings` (schema y casos de
uso base ya existen desde Fase 1; el wiring de descuento automático de
stock ya se conectó en Fase 3).

**Alcance:**
- CRUD de `trailer_stops` (crear/editar paradas con `start_time`/`end_time`
  reales, no un patrón semanal).
- Carga y ajuste de stock por parada y producto (`max_stock`, reposición
  manual vía `recordEvent` con `eventType: "restock"`, merma vía
  `eventType: "waste"`).
- Gestión de `event_bookings`: cambiar `status`
  (`quote_requested → quoted → confirmed → completed/cancelled`), agregar
  `event_booking_items` (cotización con cantidades y precio acordado).
- Advertencia visual de solapamiento: al crear un `trailer_stop` público, se
  usa `findOverlapping` (`EventBookingRepository`, ya definido en Fase 1.3)
  contra `event_bookings` confirmados — advierte, no bloquea.

**Schema/archivos:** no crea tablas nuevas. Toca `apps/web/app/admin/**`.

**Criterios de aceptación (borrador):** admin crea una parada real y carga
stock inicial; una cotización de evento se puede llevar de solicitud a
confirmada con items reales; crear una parada que se solapa con un evento
confirmado muestra la advertencia sin bloquear la creación.

### Fase 6 — Notificaciones nativas

**Objetivo:** `packages/notifications` deja de ser esqueleto: adaptador SMTP
propio para confirmaciones de orden y cotizaciones de evento. Scaffold de
Expo push listo, sin consumidor real todavía (no hay app mobile ni tokens de
dispositivo hasta Fase 7).

**Alcance:**
- `SmtpNotificationAdapter` (`packages/notifications/src/smtp/`)
  implementando `NotificationPort` (`packages/domain/src/notifications/ports.ts`,
  Fase 1.3): `sendOrderConfirmation`, `sendEventQuoteRequestReceipt`.
- Wiring: el Server Action de checkout (Fase 3) llama
  `sendOrderConfirmation` tras persistir la orden; `requestEventQuote`
  (Fase 1.3/2) llama `sendEventQuoteRequestReceipt`.
- `ExpoNotificationAdapter` (`packages/notifications/src/expo/`) — adaptador
  completo, sin invocación real hasta que Fase 7 registre tokens de
  dispositivo.
- **Credenciales SMTP:** si no están disponibles al arrancar esta fase, se
  señala explícitamente — no se mockea el envío en silencio.

**Schema/archivos:** `packages/notifications/src/smtp/**`,
`packages/notifications/src/expo/**`.

**Criterios de aceptación (borrador):** una orden real dispara un email de
confirmación real (con credenciales SMTP conectadas) o el flujo queda
documentado como bloqueado si faltan.

### Fase 7 — App mobile (Expo): despachador y delivery

**Objetivo:** hito separado, después de que Fases 1-6 estén sólidas y
probadas. Apps de despachador (Kitchen Display) y delivery (confirmación de
entrega), login por PIN, bilingüe.

**Alcance:**
- `apps/mobile` (Expo) nuevo en el workspace.
- Endpoint de login por PIN aislado del tráfico web público, con rate
  limiting (bloqueo tras 3-5 intentos fallidos por IP/dispositivo) y
  validación de integridad del cliente. **Infraestructura exacta de
  attestation (Play Integrity/DeviceCheck vs. HMAC de build) — decisión
  pendiente, se cierra al arrancar esta fase**, no bloquea nada anterior.
- Kitchen Display: cola de órdenes con `payment_status = 'paid'` **y**
  `fulfillment_status = 'received'`, agrupadas por parada.
- Confirmación de entrega: cambia `fulfillment_status` a `delivered`.
- UI bilingüe usando `packages/i18n` (Fase 2), vía la librería de i18n que
  se elija para Expo.

**Schema/archivos:** no crea tablas de negocio nuevas (usa
`users.pin_hash`, `orders`, `stock_events` ya definidas en Fase 1.2). Puede
agregar una tabla de sesiones JWT revocables o resolverse con JWT stateless
+ `is_active` — a decidir al llegar.

**Criterios de aceptación (borrador):** despachador loguea con PIN, ve la
cola en tiempo real, registra stock events desde el dispositivo; delivery
confirma entregas; intentos de PIN fallidos se bloquean tras el umbral
definido.

### Fase 8 — QA y lanzamiento

**Objetivo:** Playwright E2E, auditoría Lighthouse, cross-browser,
consolidación final de la topología de deploy en EasyPanel.

**Alcance:**
- E2E: flujo completo customer (catálogo bilingüe → checkout invitado →
  WhatsApp/Stripe) y flujo admin (login → cambiar `fulfillment_status`).
- Lighthouse: performance/accesibilidad/SEO del sitio público bilingüe.
- Deploy: un solo servicio Next.js en EasyPanel (reemplaza los dos servicios
  del prototipo — `apps/api` ya no existe desde Fase 1), más el pipeline de
  build/deploy de `apps/mobile` (EAS Build/Submit, fuera de EasyPanel).
- Limpieza final: eliminar `apps/web-legacy` del repo — ya cumplió su
  propósito de referencia durante la migración.

**Criterios de aceptación (borrador):** suite E2E en verde, Lighthouse sin
regresiones críticas, un solo servicio web en producción sirviendo el sitio
Next.js real, `apps/mobile` con build de EAS reproducible.

---

## Notas para quien retome este documento en otra sesión

Si se retoma en una sesión nueva de Claude Code: decir "seguimos con la Fase
N, ya hicimos hasta la Fase N-1" alcanza — este documento y el estado del
repo dan el contexto necesario. No hace falta re-pegar todas las reglas de
proceso, aunque no está de más si se nota desviación.
