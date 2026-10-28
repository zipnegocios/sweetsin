# Operación del trailer, pedidos ligados a paradas y medición de tiempos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir/cerrar paradas con stock confirmado, reposición y merma en vivo, pedidos de retiro ligados a una parada con descuento atómico de stock y "Agotado", medición de tiempos por tramo con reporte interno, y una página de Settings con interruptores.

**Architecture:** Hexagonal estricta: reglas en `packages/domain` (TS puro, puertos), adaptadores Drizzle en `packages/db`, Server Actions / Route Handlers / UI en `apps/web`. Cada cambio de estado de un pedido escribe un evento de transición en la misma transacción que el cambio, vía un `TransitionContext` opcional que el caller (web, mobile, webhook) pasa. El descuento de stock de un pedido es una sola transacción con `UPDATE ... WHERE current_stock >= n` por línea.

**Tech Stack:** TypeScript 5.9, Drizzle + Postgres, Vitest, Zod (`zod/v4`), Next.js 15 (Server Actions, Route Handlers), next-intl, `packages/i18n`.

**Spec:** `docs/superpowers/specs/2026-10-28-operacion-trailer-medicion-design.md` (incluye la sección "Decisiones tomadas tras la revisión del constructor", que es vinculante).

## Global Constraints

- Commits: directo en `main`, mensaje en español de **una sola línea**, sin cuerpo, sin firmas ni trailers (`Co-Authored-By`, `Claude-Session`) ni metadata de IA. Nunca `--force`, `--no-verify`, ni crear branches. Antes de `git add` revisar `git status`: nunca agregar archivos ajenos (hay cambios de otras sesiones en `.github/workflows/build-dev-apk.yml` y `pnpm-lock.yaml`).
- DB de dev y prod es la misma: `pnpm --filter @workspace/db run push` nunca con `--force`, y solo después de comprobar que el cambio es aditivo. El push va una sola vez, al final de la Tarea 1.
- `packages/domain`: cero imports de Next, Drizzle, Stripe, Expo. Toda regla nueva vive ahí con tests Vitest.
- Tests de `packages/db` son de integración contra la DB real: limpian sus filas en `afterAll` y usan timeout 15000 ms.
- Reutilizar antes de crear: `authorizeAdmin()`, `domainErrorResponse`, `requireAdmin`, `adelaide-time.ts`, patrón `{ ok: true } | { ok: false, error }` en Server Actions, y `stock-template-error.ts` como modelo de mapeo error→clave i18n.
- i18n: toda cadena nueva en `packages/i18n` (types + en + es); el test de paridad debe pasar.
- Horas siempre en Australia/Adelaide en pantalla.
- Mensajes de error de dominio nuevos se agregan a la función `is…ConflictMessage` correspondiente para que la capa web los mapee a 409.
- Aislamiento de fallo: un error al escribir un evento de medición nunca debe impedir un cambio de estado cuando `timingEnabled` está apagado (no se escribe nada); con la medición encendida el evento y el cambio comparten transacción.
- Verificación al cerrar cada tarea: `pnpm run typecheck` y los tests del paquete tocado.

## Review Focus

1. Dos clientes pagan la última unidad a la vez: exactamente uno descuenta, el otro queda "requiere atención" y el stock nunca queda negativo (Tarea 2 y 3).
2. Pedido de varias líneas donde una no alcanza: no se descuenta ninguna (Tarea 2).
3. Cancelar dos veces un pedido pagado no devuelve stock dos veces; cancelar un pedido "requiere atención" no revierte nada (Tarea 2 y 3).
4. La guarda "no bajar de lo vendido" del proyecto 2 sigue correcta con `sale_reversal` (Tarea 2).
5. Reintento offline del mismo "Marcar entregada" no duplica eventos, y una hora del cliente futura o de hace más de 24 h se ignora (Tarea 4 y 7).

---

### Task 1: Esquema y Settings

**Files:**
- Modify: `packages/db/src/schema/orders.ts`, `packages/db/src/schema/stock.ts`, `packages/db/src/schema/settings.ts`, `packages/db/src/schema/index.ts`
- Create: `packages/db/src/schema/order-status-events.ts`
- Modify: `packages/domain/src/settings/entities.ts`, `packages/db/src/repositories/settings-repository.ts`, `packages/db/src/repositories/settings-repository.test.ts`

**Interfaces:**
- Produces (schema):
  - `orderStatusEventsTable` (`order_status_events`): `id uuid pk`, `orderId uuid not null → orders.id`, `kind` enum `order_event_kind` (`fulfillment` | `payment`), `fromStatus text null`, `toStatus text not null`, `recordedAt timestamptz not null default now`, `occurredAt timestamptz not null`, `actorUserId uuid null → users.id`, `source` enum `order_event_source` (`web` | `mobile` | `webhook` | `system`). Índice por `order_id`.
  - `stockEventTypeEnum` gana el valor `sale_reversal`; `stockEventsTable.orderId uuid null → orders.id`.
  - `ordersTable.attentionReason text null`.
  - `settingsTable` gana seis booleanos con estos defaults: `requireStockConfirmationOnOpen` true, `allowMultipleActiveStops` false, `liveStockEnabled` true, `autoSoldOutEnabled` true, `timingEnabled` true, `showPerStaffBreakdown` true (columnas snake_case en SQL).
- Produces (domain): `AppSettings` gana esos seis campos booleanos con los mismos nombres camelCase.

- [ ] **Step 1: Test.** En `settings-repository.test.ts` agregar: `get()` devuelve los seis defaults en una fila recién creada; `update({ timingEnabled: false })` persiste y los demás campos no cambian; el test restaura la fila original en `afterAll`.
- [ ] **Step 2: Run** `pnpm --filter @workspace/db run test settings-repository` → falla (campos inexistentes).
- [ ] **Step 3: Implement** las columnas y tablas descritas, el export en `schema/index.ts`, la ampliación de `AppSettings` y el mapeo en `toSettings` de `DrizzleSettingsRepository`. Corregir los literales de `AppSettings` que rompan el typecheck (tests y fakes existentes) agregando los defaults.
- [ ] **Step 4: Run** los tests de settings y `pnpm run typecheck` → pasan. (`apps/web` puede mostrar errores si algún fake de `AppSettings` quedó sin corregir: corregirlos aquí.)
- [ ] **Step 5: Push de esquema.** Verificar con `git diff` que todo el cambio es aditivo (tablas, columnas con default o nullable, un valor nuevo de enum), luego correr `pnpm --filter @workspace/db run push` (sin `--force`) y confirmar que no pide eliminar nada. Si pide eliminar algo, detenerse y avisar.
- [ ] **Step 6: Commit** `git add` de los archivos de esta tarea → `Agrega esquema de eventos de pedido, reversa de stock, atención de pedidos e interruptores de Settings`; push a `main`.

---

### Task 2: Stock — descuento atómico, reversa, vendido y resumen

**Files:**
- Modify: `packages/domain/src/stock/entities.ts`, `ports.ts`, `use-cases.ts`, `use-cases.test.ts`
- Modify: `packages/db/src/repositories/stock-repository.ts`, `stock-repository.test.ts`

**Interfaces:**
- Consumes: esquema de la Tarea 1.
- Produces (domain):
  - `StockEventType` incluye `"sale_reversal"`; `StockEvent` gana `orderId?: string | null`.
  - `StockRepository` gana:
    - `decrementForOrder(stopId: string, orderId: string, lines: { productId: string; quantity: number }[]): Promise<{ ok: true } | { ok: false; productId: string }>` — una transacción; por línea `UPDATE ... SET current_stock = current_stock - q WHERE stop_id AND product_id AND current_stock >= q`; si alguna línea no actualiza fila (no existe o no alcanza) se revierte todo y devuelve `{ ok:false, productId }`; por línea exitosa inserta evento `sale` con `orderId`; si la fila queda en 0 inserta un evento `early_sellout` (cantidad 0, sin pedido) salvo que ya tenga uno con el stock actual aún en 0 sin reposición posterior.
    - `reverseOrderSale(orderId: string): Promise<void>` — para cada evento `sale` del pedido que no tenga ya un `sale_reversal` del mismo pedido y fila, incrementa `current_stock` y registra `sale_reversal` con `orderId`; idempotente.
    - `summarizeByStop(stopId: string): Promise<{ productId: string; maxStock: number; currentStock: number; sold: number; wasted: number; soldOut: boolean }[]>` (`soldOut` = `currentStock === 0`).
  - `sumSold` pasa a ser `sum(sale) − sum(sale_reversal)` en el repositorio.
  - Casos de uso nuevos: `restockStopProduct`, `wasteStopProduct` (ver firma abajo) y `confirmedStopSales` no se crean; las ventas las dispara la Tarea 3.
  - `restockStopProduct(deps: { stops: TrailerStopRepository; stock: StockRepository }, stopId: string, productId: string, quantity: number, reportedByUserId: string | null): Promise<void>` y `wasteStopProduct(..., reason: string | null, ...)` mismos deps: exigen cantidad entera positiva ("Quantity must be a positive integer"), parada con `status === "active"` ("Stop is not active"), fila existente ("Stock row not found"); merma mayor al stock actual → "Waste exceeds current stock". Reutilizan `restockProduct` / `reportStockWaste`.
  - `isStockConflictMessage` incluye "Stop is not active" y "Waste exceeds current stock".

- [ ] **Step 1: Tests de dominio** (fake en memoria): `restockStopProduct` falla en parada `scheduled`/`completed`; `wasteStopProduct` igual a stock actual deja 0; mayor → "Waste exceeds current stock"; cantidad 0, -1 y 1.5 → "Quantity must be a positive integer"; ambas guardan `reportedByUserId`.
- [ ] **Step 2: Tests de repositorio** (DB real, parada y productos de prueba, limpieza en `afterAll`): (a) `decrementForOrder` con 3 líneas donde la 2ª no alcanza → `{ ok:false, productId }` y el stock de las 3 filas queda intacto y no hay eventos; (b) dos llamadas **concurrentes** (`Promise.all`) que piden la última unidad → exactamente una `ok:true`; (c) línea que deja el stock en 0 registra un solo `early_sellout`; (d) `reverseOrderSale` devuelve el stock y registra `sale_reversal`; llamarla dos veces no devuelve dos veces; sobre un pedido sin ventas no hace nada; (e) `sumSold` descuenta las reversas, y `setQuantity` por debajo de lo vendido neto sigue rechazado por el caso de uso `setStopProductQuantity`; (f) `summarizeByStop` cuenta vendido, merma y agotado.
- [ ] **Step 3: Run** → fallan.
- [ ] **Step 4: Implement** los puertos, el repositorio y los casos de uso. La reversa suma al stock sin tope por `maxStock` y no mira el estado de la parada.
- [ ] **Step 5: Run** tests de `packages/domain` y `packages/db` (stock) → pasan.
- [ ] **Step 6: Commit** → `Agrega descuento atómico por pedido, reversa de ventas y reposición y merma de paradas activas`; push.

---

### Task 3: Pedidos — dominio (eventos, pago, cancelación, atención, retiro entregado, validación)

**Files:**
- Modify: `packages/domain/src/orders/entities.ts`, `ports.ts`, `use-cases.ts`, `use-cases.test.ts`, `index.ts`

**Interfaces:**
- Consumes: `StockRepository.decrementForOrder`, `reverseOrderSale` (Tarea 2); `TrailerStopRepository.findById`.
- Produces:
  - `Order.attentionReason?: string | null`.
  - `TransitionContext { actorUserId: string | null; source: "web" | "mobile" | "webhook" | "system"; occurredAt?: Date; record: boolean }` exportado desde `orders`.
  - Cambios en `OrderRepository` (las implementa la Tarea 4): `markAsPaid(orderId, ctx?)`, `updateFulfillmentStatus(orderId, status, ctx?)`, `assignDelivery(orderId, deliveryUserId, ctx?)`, más `setAttention(orderId: string, reason: string | null): Promise<void>`, `cancelPendingOrdersForStop(stopId: string, ctx?: TransitionContext): Promise<number>`, `countPaidUndeliveredForStop(stopId: string): Promise<number>`, `countUndeliveredForStop(stopId: string): Promise<number>` (pagados o no, ni `delivered` ni `cancelled`).
  - `ALLOWED_TRANSITIONS.ready_for_pickup` incluye `"delivered"`.
  - `markPickupDelivered(deps: { orders: OrderRepository }, orderId: string, ctx?: TransitionContext): Promise<Order>` — error "Only pickup orders can be handed over" si el tipo no es `pickup`, y "Cannot mark delivered from status: X" si no está `ready_for_pickup`.
  - `changeOrderFulfillmentStatus(deps, orderId, target, options?)` gana `options.ctx?: TransitionContext`; `delivered` se despacha por tipo (`pickup` → `markPickupDelivered`, delivery → `markOrderDelivered` como hoy); `cancelled` sobre un pedido con `paymentStatus === "paid"`, `stopId` y sin `attentionReason` llama `deps.stock?.reverseOrderSale(orderId)`; todas las rutas pasan `ctx` al repositorio. `deps` gana `stock?: StockRepository`.
  - `confirmOrderPayment(deps, orderId, ctx?)`: si hay `stopId`, llama `decrementForOrder` **antes** de pasar a `received`; si devuelve `{ok:false}` → `markAsPaid`, `setAttention(orderId, "insufficient_stock:<productId>")`, el pedido queda `pending` y no se notifica a la cola; si la parada está `cancelled` → `setAttention(orderId, "stop_cancelled")` igual. Idempotente como hoy (pedido ya pagado → no-op sin segundo descuento).
  - `retryOrderStock(deps: { orders; stock }, orderId, ctx?)`: exige `attentionReason` no nulo y `stopId`; reintenta `decrementForOrder`; si ok → `setAttention(null)` y pasa a `received`; si no, lanza "Stock still insufficient".
  - `resolveOrderAttention(deps: { orders }, orderId, ctx?)`: exige `attentionReason`; lo limpia y pasa a `received` sin tocar stock.
  - `createOrder` gana `deps.stops?` y `deps.stock?`; cuando `input.stopId` no es null: exige `fulfillmentType === "pickup"` ("Only pickup orders can target a stop"), parada existente ("Stop not found") en estado `active` o `scheduled` y con `endTime` futuro ("Stop not available"), fila de stock por producto ("Product not available at this stop") y `quantity <= currentStock` ("Quantity exceeds availability"). Sin `stopId` no cambia nada.
  - Nuevo `isOrderConflictMessage(message): boolean` con los mensajes anteriores y los ya existentes de transición.

- [ ] **Step 1: Tests** (fakes en memoria): `markPickupDelivered` feliz y rechazado para `self_delivery`; `changeOrderFulfillmentStatus` a `delivered` en retiro y en delivery; `confirmOrderPayment` con stock suficiente descuenta y pasa a `received`; con una línea corta no descuenta nada, deja `pending` con `attentionReason`; pago repetido no descuenta dos veces; cancelar pagado con stock revierte una vez, cancelar de nuevo no revierte; cancelar uno con atención no revierte; `retryOrderStock` tras reponer lo deja `received` sin atención; `resolveOrderAttention`; `createOrder` rechaza delivery con parada, parada `completed`/`cancelled`/vencida, producto sin fila, cantidad mayor a la disponible, y acepta el caso válido; los eventos reciben el `ctx` en cada transición.
- [ ] **Step 2: Run** `pnpm --filter @workspace/domain run test` → fallan.
- [ ] **Step 3: Implement.** Mantener los demás casos de uso compatibles (`ctx` opcional). El typecheck de `packages/db` y `apps/web` queda roto hasta la Tarea 4 y 7 (aceptado, la Tarea 4 lo restaura en `db`).
- [ ] **Step 4: Run** los tests de dominio → pasan.
- [ ] **Step 5: Commit** → `Agrega al dominio de pedidos eventos de transición, descuento todo o nada, atención de pedidos y retiro entregado`; push.

---

### Task 4: Pedidos — repositorio, eventos de transición y consulta del reporte

**Files:**
- Modify: `packages/db/src/repositories/order-repository.ts`, `order-repository.test.ts`, `index.ts`
- Create: `packages/domain/src/order-timing/ports.ts` (solo el puerto y los tipos de fila), `packages/domain/src/order-timing/index.ts`; export en `packages/domain/package.json` (`./order-timing`)
- Create: `packages/db/src/repositories/order-timing-repository.ts` y su test

**Interfaces:**
- Consumes: puertos de la Tarea 3, esquema de la Tarea 1.
- Produces:
  - `DrizzleOrderRepository` implementa los métodos nuevos. Cuando `ctx?.record` es `true`: `markAsPaid`, `updateFulfillmentStatus` y `assignDelivery` leen el estado actual, y **solo si cambia** insertan en `order_status_events` (misma transacción que el UPDATE) `{ kind, fromStatus, toStatus, occurredAt: ctx.occurredAt válida ?? now, recordedAt: now, actorUserId, source }`. Una `occurredAt` en el futuro o anterior a 24 h respecto del servidor se descarta y se usa la del servidor. `assignDelivery` registra `out_for_delivery` y usa `ctx.actorUserId` (quien asigna). `cancelPendingOrdersForStop` cancela (con evento) los pedidos `paymentStatus=pending` de la parada y devuelve cuántos. `findQueueForDespachador` excluye pedidos con `attentionReason` no nulo (ya quedan fuera por no estar `received`, se deja explícito con un test).
  - Tipos de dominio en `order-timing/ports.ts`:
    - `TimingEvent { kind: "fulfillment" | "payment"; fromStatus: string | null; toStatus: string; occurredAt: Date; actorUserId: string | null }`.
    - `TimingOrderRow { orderId: string; stopId: string | null; fulfillmentType: "pickup" | "self_delivery"; channel: "web" | "whatsapp"; totalCents: number; units: number; coffeeUnits: number; sweetUnits: number; createdAt: Date; cancelled: boolean; events: TimingEvent[] }`.
    - `OrderTimingRepository { listForReport(filter: { from: Date; to: Date; stopId?: string }): Promise<TimingOrderRow[]> }` (filtra por `orders.created_at`; `coffeeUnits`/`sweetUnits` salen de `products.category`: `coffee` vs `sin`+`virtue`).
  - `DrizzleOrderTimingRepository implements OrderTimingRepository`.

- [ ] **Step 1: Tests de integración** (DB real, limpieza en `afterAll`): una transición con `record:true` inserta un evento con from/to/actor/source; la misma transición repetida (no-op) no inserta; `record:false` o sin `ctx` no inserta; `occurredAt` futura o de hace 25 h se reemplaza por la hora del servidor, una de hace 1 h se respeta; el UPDATE y el evento son atómicos (forzar un fallo de inserción de evento y comprobar que el estado no cambió); `cancelPendingOrdersForStop` cancela solo `pending` de esa parada y deja pagados; `countPaidUndeliveredForStop` y `countUndeliveredForStop`; `setAttention` ida y vuelta; `listForReport` devuelve unidades de café y dulces correctas en un pedido mixto y respeta el rango de fechas.
- [ ] **Step 2: Run** → fallan.
- [ ] **Step 3: Implement** repositorios y puerto. Restaura el typecheck de `packages/db`.
- [ ] **Step 4: Run** `pnpm --filter @workspace/db run test order-repository order-timing` y `pnpm run typecheck` en `packages/domain` y `packages/db` → pasan.
- [ ] **Step 5: Commit** → `Registra eventos de transición de pedidos en el repositorio y agrega la consulta del reporte de tiempos`; push.

---

### Task 5: Paradas — abrir, cerrar y cancelar con pedidos

**Files:**
- Modify: `packages/domain/src/trailer-stops/ports.ts`, `use-cases.ts`, `use-cases.test.ts`
- Modify: `packages/db/src/repositories/trailer-stop-repository.ts` (si hace falta un método) y su test
- Modify: los callers de `cancelTrailerStop` (`apps/web/src/app/actions/admin-trailer-stops.ts` y la ruta `apps/web/src/app/api/admin/trailer-stops/[id]/...`) para la nueva firma

**Interfaces:**
- Consumes: `OrderRepository.countPaidUndeliveredForStop`, `countUndeliveredForStop`, `cancelPendingOrdersForStop` (Tarea 3); `StockRepository.summarizeByStop` (Tarea 2).
- Produces:
  - `openTrailerStop(deps: { stops: TrailerStopRepository }, id: string, options: { allowMultipleActive: boolean }): Promise<void>` — solo desde `scheduled` ("Only scheduled stops can be opened"; una parada ya `active` es no-op); si otra parada está `active` y `!allowMultipleActive` → lanza `Another stop is active: <location>`; no valida hora ni stock. (El ajuste de cantidades al abrir lo hace la UI con `setStopProductQuantity` existente antes de llamar a este caso de uso.)
  - `getStopCloseSummary(deps: { stock: StockRepository; orders: OrderRepository }, stopId: string): Promise<{ products: ReturnType<StockRepository["summarizeByStop"]> extends Promise<infer T> ? T : never; undeliveredOrders: number }>` (el implementador escribe el tipo explícito).
  - `closeTrailerStop(deps: { stops; orders }, id: string, options: { confirmUndelivered: boolean }): Promise<void>` — solo desde `active` ("Only active stops can be closed"); con pedidos sin entregar y sin confirmación → "Stop has undelivered orders"; no toca stock.
  - `cancelTrailerStop(deps: { stops; orders }, id: string): Promise<void>` — solo `scheduled` como hoy; si `countPaidUndeliveredForStop > 0` → "Stop has paid orders"; si no, `cancelPendingOrdersForStop` y luego cancela.
  - `isStopConflictMessage` acepta los mensajes nuevos (el de "Another stop is active" por `startsWith`).

- [ ] **Step 1: Tests de dominio** (fakes): abrir desde `scheduled`/`active`(no-op)/`cancelled`/`completed`; abrir con otra activa (rechazo con nombre) y con `allowMultipleActive:true`; abrir con parada sin stock es válido; cerrar con y sin pedidos sin entregar, con y sin confirmación, desde `scheduled`; cancelar con pagados pendientes (rechazo), con solo `pending` (los cancela y cancela la parada), sin pedidos.
- [ ] **Step 2: Run** → fallan.
- [ ] **Step 3: Implement** y adaptar los callers de `cancelTrailerStop` a la nueva firma (pasando `{ stops, orders }`).
- [ ] **Step 4: Run** tests de dominio y `pnpm run typecheck` → pasan.
- [ ] **Step 5: Commit** → `Agrega abrir y cerrar paradas y protege la cancelación cuando hay pedidos pagados`; push.

---

### Task 6: Medición — cálculo puro y reporte

**Files:**
- Create: `packages/domain/src/order-timing/segments.ts`, `report.ts`, `report.test.ts`; actualizar `index.ts`

**Interfaces:**
- Consumes: tipos `TimingEvent`, `TimingOrderRow` (Tarea 4).
- Produces (todo puro, sin I/O):
  - `type Segment = "queue" | "prep" | "assignment" | "delivery" | "pickupWait" | "total"`.
  - `segmentDurations(row: TimingOrderRow): Partial<Record<Segment, number>>` en milisegundos. Tramos: queue = `received→in_prep`; prep = `in_prep→ready_for_pickup`; assignment = `ready_for_pickup→out_for_delivery` (solo delivery); delivery = `out_for_delivery→delivered` (solo delivery); pickupWait = `ready_for_pickup→delivered` (solo retiro); total = `received→delivered`. Se toma la primera ocurrencia de cada `toStatus` de tipo `fulfillment`. Un tramo falta si falta alguno de sus extremos o la duración sería negativa. Pedido `cancelled` → `{}`.
  - `percentile(values: number[], p: number): number | null` (método nearest-rank; vacío → `null`).
  - `classifyComposition(coffeeUnits: number, sweetUnits: number): "coffee" | "sweets" | "mixed"`.
  - `sizeBucket(units: number): "1-5" | "6-20" | "21-50" | "51+"`.
  - `buildFulfillmentReport(rows: TimingOrderRow[], options: { groupBy: "none" | "day" | "type" | "channel" | "size" | "composition" | "stop" | "staff"; dayKey: (d: Date) => string; minSample: number }): { groups: { key: string; orders: number; inProgress: number; segments: Partial<Record<Segment, { count: number; medianMs: number; p90Ms: number; smallSample: boolean }>> }[]; slowest: { orderId: string; totalMs: number }[] }` — los cancelados se excluyen; `inProgress` cuenta los que no tienen `total` aún; `slowest` son los 10 mayores `total`; `smallSample` = `count < minSample`. El día se calcula con `dayKey(row.createdAt)`. Con `groupBy: "staff"` la clave del grupo es el `actorUserId` del evento que **cierra** cada tramo (quien lo movió al estado final; `"system"` si es `null`) y cada tramo se agrupa por separado, por lo que un pedido puede aportar a varias personas; el test cubre un pedido con dos actores distintos.
  - `reportToCsv(report): string` — encabezado `group,segment,count,median_seconds,p90_seconds,small_sample`, una fila por grupo y tramo con datos, segundos con un decimal.

- [ ] **Step 1: Tests** con filas construidas a mano: recorrido completo de delivery y de retiro; orden sin evento `received` → sin `total`/`queue`; cancelado excluido; duración negativa descartada; `percentile` con 1, 2 y 10 valores y vacío; clasificación solo café / solo dulces / mixto y borde 0 y 0; buckets en 1, 5, 6, 20, 21, 50, 51; `minSample` marca grupos con menos de 5; agrupación por día con un `dayKey` de Adelaida en las noches del cambio de horario (no pierde ni duplica); `slowest` ordena y limita a 10; CSV con encabezado y redondeo; un grupo sin datos de un tramo no emite fila de ese tramo.
- [ ] **Step 2: Run** → fallan.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter @workspace/domain run test` → pasa.
- [ ] **Step 5: Commit** → `Agrega el cálculo de tiempos por tramo y el reporte de despacho`; push.

---

### Task 7: Capa web — Server Actions, Route Handlers admin y endpoints mobile

**Files:**
- Create: `apps/web/src/lib/transition-context.ts` (helper `buildTransitionContext(opts: { actorUserId: string | null; source; occurredAt?: Date }): Promise<TransitionContext>` que lee `timingEnabled` de `DrizzleSettingsRepository` y devuelve `record` en consecuencia)
- Modify: `apps/web/src/app/actions/admin-orders.ts` (pasa `ctx` con `source:"web"` y el id del admin; agrega acciones `retryOrderStockAction`, `resolveOrderAttentionAction` que devuelven `{ ok }`), `apps/web/src/app/api/webhooks/stripe/route.ts` (`source:"webhook"`, actor `null`), `apps/web/src/app/api/mobile/orders/[id]/status/route.ts` (acepta `"delivered"` para pedidos de retiro con rol `despachador`, `source:"mobile"`), `.../deliver/route.ts` (acepta `occurredAt` ISO opcional en el cuerpo, la pasa en `ctx`)
- Modify: `apps/web/src/app/actions/admin-trailer-stops.ts` (acciones `openTrailerStopAction`, `closeTrailerStopAction`, `restockStopProductAction`, `wasteStopProductAction`, `getStopCloseSummaryAction`)
- Create: `apps/web/src/app/actions/admin-settings.ts` (`getSettingsAction`, `updateSettingsAction`)
- Create rutas admin: `api/admin/trailer-stops/[id]/open/route.ts`, `.../close/route.ts`, `.../stock/[productId]/restock/route.ts`, `.../stock/[productId]/waste/route.ts`, `api/admin/settings/route.ts` (GET/PUT), `api/admin/reports/fulfillment/route.ts` (GET, `?from&to&stopId&groupBy&format=csv`), `api/admin/orders/[id]/retry-stock/route.ts`, `.../resolve-attention/route.ts`
- Modify: `apps/web/src/app/api/mobile/orders/queue/route.ts` y la proyección para que un pedido con `attentionReason` no aparezca (ya lo excluye el repositorio; solo un test que lo fije)
- Tests: un `route.test.ts` por ruta nueva siguiendo el patrón de las rutas hermanas (401 sin sesión, 403 sin rol, 404 id inexistente o no UUID, 409 conflicto de dominio, 200 feliz).

**Interfaces:**
- Consumes: casos de uso de las Tareas 2, 3, 5 y 6; `authorizeAdmin()`, `domainErrorResponse` (ampliar su lista de mensajes conocidos con `isStockConflictMessage`, `isOrderConflictMessage`, `isStopConflictMessage`).
- Reglas: `liveStockEnabled` apagado → restock/waste responden 409 `{ error: "Live stock is disabled" }`. `openTrailerStopAction` lee `allowMultipleActiveStops` de Settings; `closeTrailerStopAction` acepta `confirmUndelivered`. `getSettingsAction`/`updateSettingsAction` incluyen `deliveryFeeCents` y `deliveryEvidenceRequired`, con validación Zod (`deliveryFeeCents` entero ≥ 0). El reporte construye `dayKey` con `adelaide-time.ts`, omite el desglose por persona si `showPerStaffBreakdown` es falso y responde `text/csv` con `?format=csv`.
- Las Server Actions nuevas devuelven `{ ok: true, ... } | { ok: false, error }` y nunca lanzan.

- [ ] **Step 1: Tests** de cada ruta y acción nueva según la lista de arriba, más: el webhook de Stripe pasa `source:"webhook"`; `deliver` ignora `occurredAt` futura; `status` con `"delivered"` rechaza (409) un pedido que no es de retiro.
- [ ] **Step 2: Run** `pnpm --filter @workspace/web run test` → fallan.
- [ ] **Step 3: Implement.** Reutilizar los helpers existentes; no duplicar validaciones de dominio en las rutas.
- [ ] **Step 4: Run** tests y `pnpm run typecheck` completo → pasan (restaura `apps/web`).
- [ ] **Step 5: Commit** → `Agrega acciones y endpoints admin y mobile para abrir y cerrar paradas, stock en vivo, Settings y reporte`; push.

---

### Task 8: Panel admin — Settings, abrir/cerrar, stock en vivo, atención de pedidos y reporte

**Files:**
- Create: `apps/web/src/app/[locale]/admin/settings/page.tsx`, `apps/web/src/app/[locale]/admin/reports/fulfillment/page.tsx`, `apps/web/src/components/admin/settings-form.tsx`, `stop-open-dialog.tsx`, `stop-close-dialog.tsx`, `stop-live-stock.tsx`, `fulfillment-report.tsx`
- Modify: `apps/web/src/app/[locale]/admin/trailer-stops/[id]/page.tsx` (botones Abrir / Cerrar, panel de stock en vivo con reposición y merma, marca "pasó la hora de cierre"), la lista de órdenes del admin (`apps/web/src/app/[locale]/admin/orders/page.tsx` y su componente de fila: badge "Requiere atención" con motivo y acciones Reintentar descuento / Marcar resuelto / Cancelar; botón "Entregado al cliente" en pedidos de retiro `ready_for_pickup`), `layout.tsx` y `admin-sidebar.tsx` (entradas Settings y Reportes), `packages/i18n` (types + en + es)
- Modify: `apps/web/src/lib/stock-template-error.ts` o un archivo hermano `stop-operation-error.ts` con el mapeo mensaje de dominio → clave i18n (más test)

**Interfaces:**
- Consumes: acciones de la Tarea 7. Todas devuelven `{ ok }`; los componentes bloquean doble envío (patrón del proyecto 2) y muestran el error traducido.
- Comportamiento: Abrir muestra la tabla de stock (vendido, disponible, cantidad editable con `setStopProductQuantity` existente) y "Confirmar y abrir"; con `requireStockConfirmationOnOpen` apagado es un clic. Cerrar muestra el resumen (`getStopCloseSummaryAction`) y, si hay pedidos sin entregar, exige un segundo clic de confirmación. Settings: seis interruptores con una línea explicativa cada uno más los dos ajustes existentes; guardado con feedback. Reporte: filtros (rango, parada, agrupar por), tabla por tramo con mediana y P90, etiqueta "muestra pequeña" y "sin datos", lista de los 10 más lentos con enlace al pedido, pedidos en curso aparte, botón "Exportar CSV" que llama al endpoint.

- [ ] **Step 1: Tests** de lo testeable sin navegador: el mapeo de errores (cada mensaje nuevo → clave existente, desconocido → clave genérica), paridad i18n (existente), y tests de componentes solo si el proyecto ya tiene el patrón para componentes admin; si no, cubrir con las acciones ya testeadas.
- [ ] **Step 2: Implement** páginas y componentes, reutilizando `stop-stock-editor.tsx` para la tabla de stock de apertura en vez de duplicar el editor.
- [ ] **Step 3: Run** `pnpm run typecheck`, tests de `apps/web` y `packages/i18n`, y `pnpm --filter @workspace/web run build` → pasan.
- [ ] **Step 4: Commit** → `Agrega al panel Settings, apertura y cierre de paradas, stock en vivo, atención de pedidos y reporte de despacho`; push.

---

### Task 9: Sitio público — elegir parada, disponibilidad y "Agotado"

**Files:**
- Modify: `apps/web/src/app/actions/checkout.ts` (acepta `stopId` opcional solo para `pickup`, valida con Zod, pasa `stops` y `stock` a `createOrder`; error de dominio → mensaje traducible), `apps/web/src/components/cart/checkout-modal.tsx`, `cart-drawer.tsx`, el contexto/estado del carrito (localStorage) y la sección de menú (`apps/web/src/components/sections/` donde se listan los productos), `packages/i18n` (textos de parada, "Agotado", avisos de recorte)
- Create: Server Action o Route Handler público de solo lectura que devuelva, para las paradas elegibles (`active` y `scheduled` con `endTime` futuro), `{ stopId, location, startTime, endTime, availability: { productId, available }[] }`; página con `export const dynamic = "force-dynamic"` si consulta DB en un Server Component.

**Interfaces:**
- Consumes: `createOrder` extendido (Tarea 3) y `autoSoldOutEnabled` de Settings.
- Comportamiento: para retiro el cliente elige primero la parada (selector arriba del carrito/menú); los productos muestran disponibilidad y "Agotado" (deshabilitado) cuando es 0 si `autoSoldOutEnabled`; la cantidad de cada línea se limita al disponible al agregarla; al cambiar de parada las líneas se recortan a lo disponible y se muestra un aviso con lo que cambió; al enviar, el servidor revalida y, si el stock cambió, devuelve el máximo disponible por producto para reintentar. Delivery y pedidos sin parada se comportan como hoy (`stopId: null`). Sin paradas elegibles el selector explica que no hay paradas abiertas y no bloquea el flujo de delivery.

- [ ] **Step 1: Tests:** schema Zod de `placeOrderAction` (rechaza `stopId` con `self_delivery`, acepta `pickup` con UUID); lógica pura de recorte de carrito (extraer a un módulo testeable: cantidades mayores al disponible se recortan, productos sin fila se eliminan, producto agotado se elimina) con casos de cambio de parada y de stock 0.
- [ ] **Step 2: Run** → fallan.
- [ ] **Step 3: Implement** reutilizando el estado de carrito existente.
- [ ] **Step 4: Run** tests, typecheck y `build` → pasan.
- [ ] **Step 5: Commit** → `Permite elegir parada en el retiro, limitar al stock disponible y mostrar Agotado`; push.

---

### Task 10: Documentación, verificación completa y cierre

**Files:**
- Modify: `CLAUDE.md` (bullet de Architecture decisions del proyecto 3: apertura/cierre, descuento todo o nada, "requiere atención", `sale_reversal`, eventos de transición, reporte, Settings; cambios de esquema ya aplicados), `handoff.md` (5 secciones, sin borrar intentos fallidos previos)

- [ ] **Step 1:** `pnpm run typecheck`, `pnpm run test`, `pnpm run build` → todos pasan; anotar los conteos.
- [ ] **Step 2:** Comprobar en la DB que no quedaron filas de prueba (paradas, plantillas, pedidos, productos, eventos de pruebas) y que `git status` solo muestra archivos ajenos a este proyecto.
- [ ] **Step 3:** Escribir la guía de prueba manual en el navegador en `handoff.md`: crear parada con stock, abrirla, hacer un pedido de retiro que agote un producto y ver "Agotado", pagarlo desde el panel, reponer, cerrar con pedidos pendientes, recorrer un pedido por todos los estados, abrir el reporte y exportar CSV, apagar `timingEnabled` y comprobar que no se registran eventos.
- [ ] **Step 4: Commit** → `Documenta el proyecto 3 y actualiza el handoff`; push.
