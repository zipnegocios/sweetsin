# Jornadas de delivery con stock propio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Con el interruptor `deliveryStockControlEnabled` encendido, un pedido `self_delivery` exige una jornada abierta (o la parada activa en modo `shared`), descuenta su stock todo o nada y pasa por el motor de capacidad; apagado, todo queda como hoy.

**Architecture:** Una jornada es una fila de `trailer_stops` con `kind = 'delivery'` (columna aditiva, default `'trailer'`). Así se reutilizan sin duplicar stock por parada, plantillas, reposición/merma, `decrementForOrder`, `reverseOrderSale`, "requiere atención" y reintento. El pedido se liga con el `orders.stopId` existente. El filtrado por `kind` mantiene las jornadas fuera del sitio público, el calendario y el selector de retiro.

**Tech Stack:** Next.js 15, Drizzle/Postgres, `packages/domain` (TS puro, Vitest), next-intl, Zod.

**Spec:** `docs/superpowers/specs/2026-10-29-jornadas-delivery-design.md` (ruling del plan: la jornada es un `trailer_stop` de `kind='delivery'` en vez de la tabla `delivery_jornadas`; el spec §4 permite reutilizar la estructura de stock).

## Global Constraints

- Hexagonal estricta: `packages/domain` sin imports de Next/Drizzle/etc.
- Cambios de esquema solo aditivos; `pnpm --filter @workspace/db run push` sin `--force` (DB compartida dev/prod).
- Interruptor apagado (default) = comportamiento idéntico al actual; el retiro nunca cambia.
- Dato faltante = "sin límite", nunca "prohibido" (para las reglas de capacidad); sin jornada con el interruptor encendido = rechazo `no_open_jornada`.
- Reglas de repositorio: id no UUID → 404; errores de dominio con `domainErrorResponse`; Server Actions devuelven `{ ok }`; endpoints admin con `authorizeAdmin`.
- Reutilizar lo existente; sin abstracciones especulativas. Textos EN/ES en `packages/i18n`.
- Commits: directo a `main`, una línea en español, sin firmas ni trailers. Horas en Australia/Adelaide (`apps/web/src/lib/adelaide-time.ts`).
- Orden de evaluación al crear: producto disponible → motor de capacidad → jornada/parada existe → cantidad ≤ stock.

## Review Focus

- Interruptor apagado + entrega: pedido idéntico al actual (`stopId: null`, sin stock). Test de regresión.
- Dos pagos concurrentes por la última unidad de una jornada: solo uno descuenta, el otro queda en atención (ya cubierto por `decrementForOrder`; test sobre un pedido de entrega).
- Jornadas (`kind='delivery'`) no aparecen en `/` ni `/es` (paradas públicas), calendario, selector de retiro ni `assertStopCanFulfill` de un pedido de retiro (un retiro con `stopId` de una jornada se rechaza).
- Cerrar una jornada con pedidos pagados sin entregar: no los rompe; nuevos pedidos se rechazan con `no_open_jornada`.
- Modo `shared` sin parada `trailer` activa: rechazo; con parada activa: el pedido de entrega descuenta de ella.

---

### Task 1: Esquema, entidades y repositorios (kind, ajustes)

**Files:**
- Modify: `packages/db/src/schema/trailer-stops.ts`, `packages/db/src/schema/settings.ts`
- Modify: entidades/puertos/repos de `trailer-stops` (`packages/domain/src/trailer-stops/{entities,ports}.ts`, `packages/db/src/repositories/trailer-stop-repository.ts`) y de settings (entidad Settings en el dominio + `settings-repository.ts`)
- Test: `packages/db/src/repositories/trailer-stop-repository.test.ts`, `settings-repository.test.ts`

**Interfaces:**
- Produces: `TrailerStopKind = "trailer" | "delivery"`; `TrailerStop.kind`; `NewTrailerStop.kind?` (default `"trailer"`); `TrailerStopRepository.listVisible(kind?)` y `listAll(kind?)` donde `kind` omitido = `"trailer"` (nunca mezcla); `findById` devuelve cualquier kind. `Settings.deliveryStockControlEnabled: boolean` (default false) y `Settings.deliveryStockMode: "separate" | "shared"` (default `"separate"`), editables por el mismo método de guardado de settings.

- [ ] **Step 1: Tests (fallan):** en `trailer-stop-repository.test.ts`: crear una parada `kind:"delivery"`; `listAll()` y `listVisible()` no la devuelven, `listAll("delivery")` sí, `findById` sí. En `settings-repository.test.ts`: defaults `false`/`"separate"` y round-trip de ambos valores.
- [ ] **Step 2:** columnas: enum `trailer_stop_kind ('trailer','delivery')` + `trailer_stops.kind` not null default `'trailer'`; `settings.delivery_stock_control_enabled` boolean not null default false; `settings.delivery_stock_mode` text/enum not null default `'separate'`. Para una jornada `location` toma el nombre ("Delivery"), `lat/lng` 0 y `startTime/endTime` = apertura y apertura+24h (placeholders; no se muestran).
- [ ] **Step 3:** actualizar entidad, puerto, repositorio y mapeo de settings; ajustar los callers de `listAll/listVisible` solo si el tipo lo exige (el default mantiene su comportamiento).
- [ ] **Step 4:** `pnpm --filter @workspace/db run push` (revisar el diff: solo columnas/enum nuevos), luego `pnpm --filter @workspace/db run test` y `pnpm run typecheck`: verde.
- [ ] **Step 5:** commit `Agrega el tipo de parada delivery y los ajustes de control de stock a domicilio`.

### Task 2: Dominio — jornadas y reglas del pedido a domicilio

**Files:**
- Create: `packages/domain/src/delivery-jornadas/{use-cases,errors,index}.ts` (+ `use-cases.test.ts`)
- Modify: `packages/domain/src/orders/use-cases.ts` (+ test), `packages/domain/src/index.ts` (exports)

**Interfaces:**
- Consumes: `TrailerStopRepository`, `StockRepository` (`findByStopAndProduct`), `Settings` de Task 1 (el implementador localiza el puerto de settings existente y lo recibe como dependencia opcional `settings` en `createOrder`).
- Produces:
  - `openJornada(deps: { stops: TrailerStopRepository }, input: { name?: string }, now: Date): Promise<TrailerStop>` — rechaza (`Error("A jornada is already open")`) si hay otra `delivery` con `status:"active"`; crea con `kind:"delivery"`, `status:"active"`.
  - `closeJornada(deps, id): Promise<void>` — solo `kind:"delivery"` y `active`; pasa a `completed`.
  - `class DeliveryRejectedError extends Error { reasons: { code: "no_open_jornada" }[] }` en `errors.ts`.
  - `createOrder(deps & { settings? }, input, options)`: para `self_delivery`, **después** del motor de capacidad y solo si `settings.deliveryStockControlEnabled`: en modo `separate` busca la jornada `delivery` activa, en `shared` la parada `trailer` activa; si no hay → `throw new DeliveryRejectedError`; si hay, usa `input.stopId = ` ese id (sobrescribe el del cliente), valida que cada línea tenga fila de stock (si no, `Error("Product not available at this stop")`) y que la cantidad ≤ `currentStock` cuando `enforceAvailability`. `assertStopCanFulfill` pasa a aceptar `self_delivery` solo contra una parada resuelta por este camino; un `pickup` cuyo `stopId` es de `kind:"delivery"` se rechaza con `Error("Stop not available")`.
  - Con el interruptor apagado `createOrder` no cambia (sin consultar paradas).

- [ ] **Step 1: Tests (fallan)** en `delivery-jornadas/use-cases.test.ts`: abrir crea activa; segunda apertura rechaza; cerrar solo una `delivery` activa. En `orders/use-cases.test.ts`: (a) interruptor apagado → `stopId:null`, no llama a stops/stock; (b) encendido sin jornada → `DeliveryRejectedError` con `no_open_jornada`; el retiro sigue pasando; (c) encendido, `separate`, con jornada → pedido con `stopId` de la jornada; cantidad = stock pasa, stock + 1 lanza "Quantity exceeds availability"; (d) producto sin fila → rechazo; (e) `shared` sin parada activa → rechazo, con parada activa → `stopId` de ella; (f) el motor de capacidad rechaza antes que la jornada; (g) retiro contra una jornada → "Stop not available".
- [ ] **Step 2:** implementar lo de Interfaces; `confirmOrderPayment`, `retryOrderStock` y la cancelación ya funcionan por `stopId` (verificar con un test de dominio de confirmación de un pedido `self_delivery` con `stopId`: descuenta, y sin stock queda `insufficient_stock:<id>`).
- [ ] **Step 3:** `pnpm --filter @workspace/domain run test` y `pnpm run typecheck`: verde.
- [ ] **Step 4:** commit `Agrega las jornadas de delivery y las reglas de stock del pedido a domicilio en el dominio`.

### Task 3: Checkout — cableado, disponibilidad y rechazo en el sitio

**Files:**
- Modify: `apps/web/src/app/actions/checkout.ts` (+ test), `apps/web/src/components/cart/checkout-modal.tsx`, CartProvider/`cart-store.tsx` si hace falta, `apps/web/src/app/actions/capacity-public.ts` o una acción pública nueva mínima, `packages/i18n` (EN/ES), `apps/web/src/lib/business-contact.ts` (solo uso).
- Test: `checkout.test.ts`, test de la lib pública si se agrega.

**Interfaces:**
- Consumes: `DeliveryRejectedError` y `createOrder` de Task 2.
- Produces: el resultado de checkout `{ ok:false, error:"deliveryRejected", reasons, whatsappUrl }` (misma forma y salida WhatsApp que `capacityRejected`); acción pública `getDeliveryAvailability(): Promise<{ enabled: boolean; open: boolean; stock: Record<productId, number> }>` — solo ids y cantidades; `enabled:false` o error de lectura → `{enabled:false,open:false,stock:{}}`.

- [ ] **Step 1: Tests (fallan):** checkout con `DeliveryRejectedError` devuelve `deliveryRejected` con `whatsappUrl`; con interruptor apagado el flujo actual no cambia; la acción pública devuelve vacío si está apagado o falla la lectura y las cantidades de la jornada activa si está encendido.
- [ ] **Step 2:** cablear `settings` y el manejo del error en `checkout.ts`; el checkout de entrega muestra panel de rechazo con WhatsApp y, si `enabled`, tope por producto por cantidad disponible y "Agotado" (reutilizar el patrón del proyecto 4 y del retiro); sin vaciar el carrito.
- [ ] **Step 3:** textos EN/ES. `pnpm --filter @workspace/web run test` y typecheck: verde.
- [ ] **Step 4:** commit `Muestra en el checkout la disponibilidad y el rechazo de las entregas a domicilio`.

### Task 4: Admin — ajustes, jornadas y endpoints

**Files:**
- Create: `apps/web/src/app/api/admin/jornadas/**` (`route.ts` GET/POST, `[id]/route.ts` GET, `[id]/close/route.ts`, `[id]/stock/[productId]/{restock,waste}/route.ts` reusando la lógica de stock existente), `apps/web/src/app/actions/admin-jornadas.ts`, página `/admin/jornadas` (+ `[id]`) y componentes bajo `components/admin/jornadas/`
- Modify: `/admin/settings` (interruptor + selector de modo, con línea explicativa), `GET/PUT /api/admin/settings`, sidebar, detalle de pedido admin (muestra "Jornada: <nombre>" si el stop es `delivery`), i18n.
- Test: tests de rutas/acciones siguiendo `api/admin/capacity/**`.

**Interfaces:**
- Consumes: `openJornada`, `closeJornada`, repos de stock y plantillas (copiar plantilla al abrir, como hace la creación de paradas).
- Produces: endpoints de spec §6 con `authorizeAdmin`; id no UUID → 404; jornada inexistente o `kind` distinto de `delivery` → 404; abrir con otra abierta → 409 vía `domainErrorResponse`; reposición y merma respetan `liveStockEnabled` (409 si apagado).

- [ ] **Step 1: Tests (fallan):** 401/403 sin admin, 404 de id no UUID y de parada `trailer`, 409 al abrir una segunda, apertura con stock inicial, cierre, restock/waste.
- [ ] **Step 2:** implementar endpoints y acciones reutilizando las funciones de stock de paradas; páginas y settings; el detalle de la jornada muestra stock vendido/disponible (`summarizeByStop`) y, en cerradas, el sobrante.
- [ ] **Step 3:** verificar que `/admin/trailer-stops`, el calendario y el selector de retiro no listan jornadas (test o chequeo por grep de los callers de `listAll/listVisible`).
- [ ] **Step 4:** suite web + typecheck + `pnpm run build`: verde.
- [ ] **Step 5:** commit `Agrega el panel y los endpoints admin de jornadas de delivery y sus ajustes`.

### Task 5: Documentación y guía de prueba

**Files:** `CLAUDE.md` (bullet del proyecto 5 en Architecture decisions), `handoff.md` (5 secciones, incluida la guía manual: encender el interruptor, abrir jornada con stock 5, pedir 6 → máximo 5; sin jornada → rechazo con WhatsApp; retiro intacto).

- [ ] **Step 1:** redactar ambos; incluir diferidos (sobrante informativo, una jornada a la vez, `shared` mezcla ventas).
- [ ] **Step 2:** `pnpm run test` y `pnpm run typecheck` completos: verde.
- [ ] **Step 3:** commit `Documenta el proyecto 5 y actualiza el handoff`.
