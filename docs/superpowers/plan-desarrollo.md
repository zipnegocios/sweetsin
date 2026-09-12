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
  - `apps/mobile` (Expo) — planeado para Fase 1 tardía (ver más abajo), una
    vez que la base web/API esté sólida y probada. Hito separado para no
    mezclar contextos de build ni bloquear el frontend web.
- **Descartado explícitamente:** `apps/api` (Express 5), el pipeline
  `lib/api-spec` + `lib/api-zod` + `lib/api-client-react` (OpenAPI + Orval),
  y Resend como proveedor de notificaciones.
- **Testing:** Vitest en `packages/domain` obligatorio desde el día uno (es
  la razón de ser de Hexagonal — el motor de reglas de negocio nace
  testeado). Tests de integración en `packages/db` contra DB real o
  Testcontainers, validando que los repositorios cumplen los puertos. E2E
  con Playwright se pospone al sprint de QA pre-lanzamiento.
- **DB:** PostgreSQL + Drizzle ORM, misma instancia EasyPanel que hoy (dev y
  prod comparten Postgres — cuidado con `push --force`).

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
- **Login por PIN (mobile, Fase 1 tardía):** endpoint aislado del tráfico web
  público. Validación de integridad del cliente (Play Integrity API /
  DeviceCheck, o como mínimo HMAC de build + rate limiting estricto:
  bloqueo tras 3-5 intentos fallidos por IP/dispositivo). JWT de sesión con
  TTL corto, revocable vía `is_active`.
- **Separación por plataforma:**
  - Web: `admin` en `/admin/*`. `customer` vía Auth.js para preorder y panel
    de usuario.
  - Mobile (Expo, Fase 1 tardía): `despachador` (cola de preparación +
    stock) y `delivery` (órdenes asignadas + confirmación de entrega), cada
    uno autenticado por PIN.

### Inventario y calendario

- **Inventario numérico por parada** (no booleano, no solo "por día"):
  - `trailer_stops` — instancias reales por fecha (`start_time`, `end_time`
    exactos), **no** un patrón semanal estático.
  - `stop_product_stock` — por parada y producto: `max_stock` y
    `current_stock`. Se descuenta automáticamente y en tiempo real con cada
    preorden pagada. Al llegar a 0, el producto se desactiva solo para esa
    parada en el canal público (no globalmente).
  - `stock_events` — log de auditoría de cada movimiento de stock: venta
    automática, merma (cantidad + motivo), agotamiento anticipado,
    reposición. Reportado por el despachador desde la app (Fase 1 tardía) o
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

## Decisiones pendientes (no cerradas explícitamente — señaladas, no asumidas en silencio)

Estas quedaron abiertas durante el brainstorming. No se resuelven acá por
decisión unilateral — se marcan para resolver antes de la fase que las
necesita:

1. **Idioma del sitio.** El copy público apunta a inglés, pero el WhatsApp de
   `Events.tsx`/`Footer.tsx` ya está en español. Afecta si `products` y
   contenido similar necesitan campos bilingües. **Debe resolverse antes de
   la Fase 2 (catálogo público).**
2. **Convención de nombres en DB.** Se asume `snake_case` en columnas
   Postgres (estándar Drizzle) por ser el default menos sorpresivo — pero no
   fue confirmado explícitamente. Se usa este default salvo corrección antes
   de la Fase 1.2 (schema Drizzle).
3. **Checkout de invitado vs. cuenta obligatoria.** Con Auth.js para
   `customer`, ¿el pickup/self-delivery sigue permitiendo checkout sin
   cuenta (como hoy), o pasa a requerir login? Afecta si `orders.customer_id`
   es obligatorio o nullable. **Debe resolverse antes de la Fase 3
   (checkout).**
4. **Persistencia del carrito.** ¿Sigue siendo efímero/local (`localStorage`)
   incluso para un `customer` logueado, o se sincroniza server-side para que
   sobreviva entre dispositivos? **Debe resolverse antes de la Fase 3.**

---

## Boceto de schema (Fase 1 — referencia, no DDL final)

```
users              (id, name, email?, role, pin_hash?, is_active, created_at)
products           (id, name, slug, category, description, price_cents, image_url, featured, available, created_at)

trailer_stops        (id, location, lat, lng, start_time, end_time, status, created_at)
stop_product_stock   (id, stop_id -> trailer_stops, product_id -> products, max_stock, current_stock)
stock_events         (id, stop_product_stock_id, event_type, quantity, reason?, reported_by_user_id?, created_at)

event_bookings       (id, client_name, client_company?, client_email, client_phone, event_type, event_date, start_time, end_time, location, estimated_guests, status, notes?, created_at, updated_at)
event_booking_items  (id, event_booking_id, description, quantity, agreed_unit_price_cents)

orders             (id, customer_id?, customer_name, customer_email, customer_phone, fulfillment_type, delivery_address?, stop_id?, payment_status, fulfillment_status, subtotal_cents, discount_cents, delivery_fee_cents, total_cents, channel, stripe_payment_intent_id?, created_at, updated_at)
order_items        (id, order_id, product_id, quantity, unit_price_cents, line_discount_cents)
```

---

## Orden de ejecución

### Fase 1 — Cimientos (dominio, base de datos, monorepo)

**Objetivo:** dejar la base completa (schema de todo el negocio + dominio
hexagonal + tests) sólida antes de construir ninguna UI. Es la fase de mayor
riesgo de ambigüedad — se ejecuta con más detalle y checkpoints que las
siguientes.

**Alcance:**
1. **1.1 — Reestructuración del monorepo:** crear `packages/domain`,
   `packages/db`, `packages/notifications` (esqueleto). Retirar `apps/api`,
   `lib/api-spec`, `lib/api-zod`, `lib/api-client-react` (mover a un
   commit propio, identificable). Scaffold de Next.js 15 en `apps/web`
   (puede convivir temporalmente con el código Vite viejo hasta que se migre
   contenido, a definir al llegar).
2. **1.2 — Schema completo de Drizzle** en `packages/db`: todas las tablas
   del boceto de arriba, con las decisiones pendientes #2 y #3 ya resueltas.
   Migraciones aplicadas contra el Postgres de EasyPanel (dev=prod, cuidado).
3. **1.3 — `packages/domain`:** entidades + puertos (interfaces de
   repositorio) + casos de uso base para cada dominio (productos, órdenes,
   usuarios, stock, eventos). Vitest desde el primer caso de uso escrito.
4. **1.4 — `packages/db` repositorios:** implementaciones concretas de los
   puertos usando Drizzle. Tests de integración contra DB real/Testcontainers.

**Criterios de aceptación (a definir con precisión al arrancar la fase, una
vez resueltas las decisiones pendientes #2 y #3):** `pnpm run typecheck`
limpio, suite de Vitest de `packages/domain` en verde, migraciones de
Drizzle aplicadas sin error, al menos un caso de uso completo (ej. "crear
orden") probado de punta a punta con un repositorio real.

**Restricciones:** no se toca `apps/web` más allá del scaffold — nada de UI
de catálogo, checkout ni admin todavía. No se instala Stripe SDK todavía
(eso es Fase 3).

### Fase 2 — Catálogo público (primer slice de UI)

Sitio público en Next.js 15 sirviendo productos reales desde `packages/db`
(reemplaza `data.ts` hardcodeado), sin checkout. Requiere resolver la
decisión pendiente #1 (idioma) antes de arrancar. *Detalle completo del
prompt de trabajo se define al llegar a esta fase.*

### Fase 3 — Checkout y órdenes

`CheckoutModal` reconstruido sobre Next.js, persistencia real de órdenes vía
`packages/domain`, motor de descuento por volumen movido al dominio. Stripe:
scaffold completo (PaymentIntent + webhook) pero **bloqueado hasta recibir
credenciales** — se avisa explícitamente al arrancar esta fase si siguen sin
llegar. WhatsApp se mantiene como canal alternativo, también persistiendo la
orden. Requiere resolver las decisiones pendientes #3 y #4 antes de arrancar.
*Detalle completo al llegar.*

### Fase 4 — Autenticación y panel admin básico

Auth.js para `customer`, login admin, guards por rol. Primer panel admin:
ver órdenes, cambiar `fulfillment_status`. *Detalle al llegar.*

### Fase 5 — Inventario y calendario del trailer

`trailer_stops`, `stop_product_stock`, `stock_events`, `event_bookings` con
UI real en el panel admin (crear paradas, cargar stock, registrar eventos de
inventario, gestionar cotizaciones de eventos con la advertencia visual de
solapamiento). *Detalle al llegar.*

### Fase 6 — Notificaciones nativas

`packages/notifications`: SMTP propio para confirmaciones de orden y
cotizaciones de evento. Scaffold de Expo push (sin app mobile todavía, solo
el adaptador). *Detalle al llegar.*

### Fase 7 — App mobile (Expo): despachador y delivery

Hito separado, después de que Fases 1-6 estén sólidas y probadas. Login por
PIN + validación de integridad de cliente, Kitchen Display para despachador,
flujo de confirmación de entrega para delivery. *Detalle completo al llegar
— incluye la decisión de infraestructura de attestation (Play
Integrity/DeviceCheck vs. HMAC de build) todavía no cerrada en detalle de
implementación.*

### Fase 8 — QA y lanzamiento

Playwright E2E, auditoría Lighthouse, cross-browser, revisión de la
topología de deploy en EasyPanel (probablemente colapsa a un solo servicio
Next.js + el futuro backend/servicio de `apps/mobile`). *Detalle al llegar.*

---

## Notas para quien retome este documento en otra sesión

Si se retoma en una sesión nueva de Claude Code: decir "seguimos con la Fase
N, ya hicimos hasta la Fase N-1" alcanza — este documento y el estado del
repo dan el contexto necesario. No hace falta re-pegar todas las reglas de
proceso, aunque no está de más si se nota desviación.
