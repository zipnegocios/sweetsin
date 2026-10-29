# Motor de capacidad y reglas por producto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evaluar antes de aceptar un pedido de entrega a domicilio si se puede despachar (topes, antelación, capacidad de preparación y traslado), estimar el tiempo y dar al cliente una salida de negociación.

**Architecture:** Funciones puras en `packages/domain/src/capacity` (estimación y evaluación), un repositorio Drizzle para reglas/pasos/ajustes, integración opcional en `createOrder` (solo `self_delivery` y solo con el interruptor encendido), y una página admin `/admin/capacity` con endpoints `/api/admin/capacity/**`.

**Tech Stack:** TypeScript, Drizzle + Postgres, Zod (`zod/v4`), Next.js 15 (Server Actions / Route Handlers), next-intl, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-motor-capacidad-reglas-design.md` (autoridad; ante conflicto gana el spec).

## Global Constraints

- Commits directo a `main`, mensaje de UNA línea en español, sin firmas ni metadata de IA; `git add` solo de los archivos propios; nunca `--force` ni `--no-verify`.
- `db push` solo en la Tarea 1, solo aditivo, nunca `--force` (la base de desarrollo y producción es la misma).
- Hexagonal estricta: `packages/domain` sin imports de Drizzle/Next/Stripe.
- Motor apagado (`capacityEngineEnabled = false`, default) = comportamiento actual intacto. Retiro nunca lo limita el motor.
- Dato faltante = "sin límite", nunca "prohibido". Enteros positivos al guardar.
- Textos en inglés y español (tuteo). Horas en Australia/Adelaide (`apps/web/src/lib/adelaide-time.ts`).
- Server Actions devuelven `{ ok }`; rutas admin con `authorizeAdmin`, `domainErrorResponse`, id no UUID → 404.
- Reutilizar antes de crear (helpers, tipos, estilos existentes).

## Review Focus

- Motor apagado: las pruebas actuales del checkout y de `createOrder` pasan sin cambios.
- Retiro con cantidad enorme no es rechazado por el motor.
- Producto sin regla o con campos vacíos no bloquea ni lanza.
- Cantidad exactamente igual al tope pasa; tope + 1 se rechaza con la cantidad permitida.
- `scheduled_for` pasado, o a más de 60 días, se rechaza; sin él, con antelación requerida, se pide la hora.
- Mensaje de rechazo siempre trae razón + salida por WhatsApp y el carrito se conserva.

---

### Task 1: Esquema, ajustes y repositorio de reglas

**Files:**
- Create: `packages/db/src/schema/capacity.ts` (`productCapacityRulesTable`, `productPrepStepsTable`)
- Modify: `packages/db/src/schema/{settings,orders,index}.ts`, `packages/domain/src/settings/entities.ts`, `packages/db/src/repositories/{settings-repository,index}.ts`
- Create: `packages/domain/src/capacity/{entities,ports,index}.ts`, `packages/db/src/repositories/capacity-repository.ts` (+ `.test.ts`)
- Modify: `packages/domain/package.json` (export `./capacity`)

**Interfaces:**
- Produces (`packages/domain/src/capacity/entities.ts`):
  `ProductCapacityRule { productId; soldOnline: boolean; deliveryMaxQty: number|null; leadTimeMinutes: number|null; batchUnits: number|null; batchSeconds: number|null }`,
  `PrepStep { id; productId; position; name; seconds; mode: "per_batch"|"per_unit" }`,
  `CapacitySettings { capacityEngineEnabled; workAreaUnits: number|null; vehicleCapacityUnits: number|null; tripMinutes: number|null; maxDeliveryTrips: number|null; showEstimateToCustomer }`.
- Produces `CapacityRepository`: `getSettings()`, `saveSettings(patch)`, `listRules()`, `getRule(productId)`, `saveRule(rule)` (upsert), `listSteps(productId?)`, `replaceSteps(productId, steps)` (atómico), `lastModifiedAt()`.
- `AppSettings`/`SettingsRepository` reflejan las columnas nuevas de `settings` (`capacity_engine_enabled` default false, `work_area_units`, `vehicle_capacity_units`, `trip_minutes`, `max_delivery_trips`, `show_estimate_to_customer` default false); `orders.scheduled_for` timestamptz nullable.

- [ ] **Step 1: Write failing tests** en `capacity-repository.test.ts`: (a) `saveRule` crea y luego actualiza la misma fila por `productId`; (b) `replaceSteps` reemplaza todo o nada y respeta `position`; (c) `getSettings` devuelve `capacityEngineEnabled=false` por defecto; (d) rechaza enteros ≤ 0 (validación en el repositorio/entidad con Zod `zod/v4`).
- [ ] **Step 2: Run** `pnpm --filter @workspace/db run test -- capacity-repository` → FAIL.
- [ ] **Step 3: Implement** esquema, entidades, puerto y repositorio; añadir las columnas a `settings`/`orders` y exponerlas en `DrizzleSettingsRepository` y `AppSettings`.
- [ ] **Step 4: Aplicar** `pnpm --filter @workspace/db run push` (revisar que solo agregue tablas/columnas; nunca `--force`).
- [ ] **Step 5: Run** tests de `packages/db` y `pnpm run typecheck` → PASS.
- [ ] **Step 6: Commit** `git commit -m "Agrega el esquema y el repositorio de reglas de capacidad"`.

### Task 2: Funciones puras de estimación y evaluación

**Files:**
- Create: `packages/domain/src/capacity/{estimate,evaluate}.ts` (+ `estimate.test.ts`, `evaluate.test.ts`); exportar en `index.ts`

**Interfaces:**
- Consumes: entidades de la Tarea 1.
- Produces:
  `estimatePreparation(lines: {productId; quantity}[], rules: Map<string, ProductCapacityRule>, steps: Map<string, PrepStep[]>, workAreaUnits: number|null): { seconds: number; perProduct: { productId; seconds; hasData: boolean }[] }`;
  `estimateTransport(totalUnits, vehicleCapacityUnits: number|null, tripMinutes: number|null): { trips: number; minutes: number }`;
  `evaluateDeliveryOrder(input: { lines; rules; steps; settings: CapacitySettings; now: Date; scheduledFor: Date|null; productNames?: Map<string,string> }): { ok: boolean; reasons: CapacityReason[]; estimate: { prepSeconds; trips; transportMinutes } }`;
  `CapacityReason { code: "not_sold_online"|"over_delivery_cap"|"lead_time"|"over_vehicle_trips"|"scheduled_for_invalid"; productId?; allowedQty?; earliestAt?: Date; maxTrips?; neededTrips? }`.

- [ ] **Step 1: Write failing tests** (casos del spec §6): 1.000 uds con lote de 50 y 90 s = 1.800 s; cantidad 1 = 1 lote; `unidadesPorLote = min(workAreaUnits, batchUnits)`; pasos `per_batch` y `per_unit` se suman; sin regla ni datos = 0 s y `hasData:false`; 250 uds y vehículo de 100 = 3 viajes; `maxDeliveryTrips = 2` → `over_vehicle_trips`; tope igual a la cantidad pasa, +1 → `over_delivery_cap` con `allowedQty`; `soldOnline=false` → `not_sold_online`; antelación 120 min y `scheduledFor` en 30 min → `lead_time` con `earliestAt`; sin `scheduledFor` y con antelación → `lead_time`; `scheduledFor` pasado o > 60 días → `scheduled_for_invalid`; settings con motor apagado → `ok:true` sin razones.
- [ ] **Step 2: Run** `pnpm --filter @workspace/domain run test -- capacity` → FAIL.
- [ ] **Step 3: Implement** las tres funciones según spec §3 (preparación = suma secuencial de productos; todo campo nulo se trata como "sin límite").
- [ ] **Step 4: Run** → PASS; `pnpm run typecheck`.
- [ ] **Step 5: Commit** `git commit -m "Agrega la estimación y evaluación de capacidad en el dominio"`.

### Task 3: Integración en createOrder y checkout

**Files:**
- Modify: `packages/domain/src/orders/{use-cases,ports,entities}.ts` (+ tests), `packages/db/src/repositories/order-repository.ts` (+ test), `apps/web/src/app/actions/checkout.ts` (+ `checkout.test.ts`), `apps/web/src/lib/` (mapeo de errores de checkout existente)

**Interfaces:**
- Consumes: `evaluateDeliveryOrder`, `CapacityRepository`.
- Produces: `createOrder(deps: { …; capacity?: CapacityRepository }, input: NewOrderInput & { scheduledFor?: Date|null }, options)`. Si `fulfillmentType === "self_delivery"`, `deps.capacity` existe y `capacityEngineEnabled`, evalúa y, si `!ok`, lanza `CapacityRejectedError` (clase en dominio, con `reasons`). `orders.scheduled_for` se persiste. Resultado del checkout: `{ ok: false, error: "capacityRejected", reasons: [...] }` (razones serializables, con nombre del producto en en/es según el locale).

- [ ] **Step 1: Write failing tests**: motor apagado → sin cambios (regresión); retiro grande no se rechaza; entrega con `over_delivery_cap` lanza `CapacityRejectedError`; `scheduledFor` se guarda en el pedido; el checkout devuelve `capacityRejected` con razones y el WhatsApp del negocio.
- [ ] **Step 2: Run** tests de dominio y web → FAIL.
- [ ] **Step 3: Implement** la integración; el esquema Zod del checkout acepta `scheduledFor` ISO opcional solo para `self_delivery`; cablear `DrizzleCapacityRepository` en la acción.
- [ ] **Step 4: Run** `pnpm run typecheck` y tests → PASS (incluidas todas las pruebas previas de checkout y orders).
- [ ] **Step 5: Commit** `git commit -m "Integra la evaluación de capacidad en el pedido de entrega a domicilio"`.

### Task 4: API y acciones admin, calibración

**Files:**
- Create: `apps/web/src/app/api/admin/capacity/{settings/route.ts,products/[id]/route.ts,simulate/route.ts,calibration/route.ts}` (+ tests), `apps/web/src/app/actions/admin-capacity.ts` (+ test), `apps/web/src/lib/capacity-calibration.ts`
- Modify (solo lectura de datos existentes): consumir `DrizzleOrderTimingRepository.listForReport` y `segmentDurations` de `@workspace/domain/order-timing` para la mediana por producto.

**Interfaces:**
- Produces: `GET/PUT /api/admin/capacity/settings`; `GET/PUT /api/admin/capacity/products/[id]` (regla + pasos); `POST /api/admin/capacity/simulate` (body `{ lines, scheduledFor? }` → resultado de `evaluateDeliveryOrder`); `GET /api/admin/capacity/calibration` → `{ productId; configuredSeconds|null; measuredMedianSeconds|null; sampleSize }[]` (muestra < 10 marcada `smallSample`). Server Actions `saveCapacitySettingsAction`, `saveProductRuleAction`, `simulateAction` devuelven `{ ok }`.

- [ ] **Step 1: Write failing tests**: 401/403 sin admin; id no UUID → 404; valores ≤ 0 → 400; simulate no escribe nada; calibración sin datos devuelve `measuredMedianSeconds: null`; muestra pequeña marcada.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** reutilizando `authorizeAdmin`, `domainErrorResponse`, `runAdminAction`. **Step 4: Run** typecheck + tests → PASS.
- [ ] **Step 5: Commit** `git commit -m "Agrega la API admin de capacidad, simulador y calibración"`.

### Task 5: Página `/admin/capacity`

**Files:**
- Create: `apps/web/src/app/[locale]/admin/capacity/page.tsx` y componentes en `apps/web/src/components/admin/capacity/` (formulario de ajustes, tabla de reglas por producto con pasos, simulador, columna de calibración); i18n en `packages/i18n` (en/es)
- Modify: el menú lateral admin (donde se registró `/admin/settings`)

**Interfaces:**
- Consumes: acciones y GET de la Tarea 4. `export const dynamic = "force-dynamic"`.

- [ ] **Step 1: Write failing tests** de la lógica pura de la página (formateo de segundos a "X min Y s", mapeo de razones a textos con las claves i18n; paridad de claves en/es).
- [ ] **Step 2: Implement** la página: interruptor general, ajustes del área/vehículo, tabla editable (cinco reglas + pasos), simulador con razones, mediana medida junto al tiempo configurado con aviso de muestra pequeña, "sin datos" si no hay; cada campo con su explicación; hora de última modificación.
- [ ] **Step 3: Run** `pnpm run typecheck`, tests y `pnpm run build` → PASS.
- [ ] **Step 4: Commit** `git commit -m "Agrega la página admin de capacidad con simulador y calibración"`.

### Task 6: Sitio público y checkout

**Files:**
- Modify: componente del menú (etiqueta "Solo en el trailer" y tope visible), checkout modal y cart drawer, `apps/web/src/app/actions/pickup-stops.ts`-estilo para exponer reglas públicas mínimas (nuevo `apps/web/src/app/actions/capacity-public.ts`: solo `soldOnline`, `deliveryMaxQty`, `leadTimeMinutes`, `showEstimateToCustomer`), i18n en/es.

**Interfaces:**
- Produces: en el checkout con entrega: mensaje de rechazo (razón + cantidad permitida + botón WhatsApp ya existente) sin vaciar el carrito; selector de fecha y hora (Australia/Adelaide) cuando el carrito incluye un producto con antelación; estimación "aproximada" solo si `showEstimateToCustomer`.

- [ ] **Step 1: Write failing tests** de la función pura que arma el estado del checkout a partir de las reglas públicas (qué productos bloquean entrega, si se exige hora, antelación mínima) y del mapeo de razones del servidor a mensajes.
- [ ] **Step 2: Implement** UI y textos (tuteo, en/es). Con el motor apagado, la acción pública devuelve reglas vacías y la UI no cambia.
- [ ] **Step 3: Run** typecheck, tests y build → PASS.
- [ ] **Step 4: Commit** `git commit -m "Muestra en el sitio los topes de entrega y el rechazo con salida por WhatsApp"`.

### Task 7: Documentación

**Files:**
- Modify: `CLAUDE.md` (bullet del proyecto 4 en Architecture decisions), `handoff.md` (5 secciones, sin borrar intentos fallidos; guía de prueba manual del spec §10)

- [ ] **Step 1:** Documentar cambios de esquema (ya aplicados), endpoints, interruptor apagado por defecto y limitaciones del spec §9.
- [ ] **Step 2: Run** `pnpm run typecheck && pnpm run test && pnpm run build`.
- [ ] **Step 3: Commit** `git commit -m "Documenta el proyecto 4 y actualiza el handoff"`.
