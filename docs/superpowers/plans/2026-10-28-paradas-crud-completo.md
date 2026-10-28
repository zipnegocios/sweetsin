# Paradas del trailer: CRUD completo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el admin pueda editar, cancelar, reactivar y eliminar paradas del trailer, y que el sitio público muestre los cambios con etiquetas (opción A) y un aviso fijo.

**Architecture:** Las reglas (transiciones, etiquetas derivadas, eliminación) viven en `packages/domain/src/trailer-stops`; `packages/db` implementa los puertos nuevos; `apps/web` expone lo mismo por Server Actions (panel) y Route Handlers `/api/admin/trailer-stops/**` (futura APK admin). El sitio público solo lee y pinta etiquetas derivadas.

**Tech Stack:** TypeScript, Drizzle + Postgres, Next.js 15, next-intl, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-paradas-crud-completo-design.md`

## Global Constraints

- Commits: el implementador solo hace `git add`; el owner commitea. Mensaje sugerido en español, una sola línea, sin firmas ni metadata de IA. Trabajo directo en `main`, sin branches.
- Hexagonal estricta: `packages/domain` sin imports de Next, Drizzle ni Stripe.
- Reutilizar antes de crear (`trailer-stop-form.tsx`, `requireAdmin`, `StatusBadge`, `LocationPicker`). Nada especulativo.
- Dev y producción comparten la misma Postgres: todo test que escriba en la DB limpia sus filas en `afterAll`, con un prefijo propio (`Plan1 Test`). No usar `push --force`.
- i18n: toda clave nueva en `en.ts`, `es.ts` y `types.ts` de `packages/i18n` (el test de paridad debe seguir verde).
- Horas: se escriben y se muestran siempre en `Australia/Adelaide`; en DB se guardan en UTC.
- Estados: `scheduled → cancelled`, `cancelled → scheduled` (reactivar), `scheduled|active → completed`. `completed` no se edita ni se reactiva. Cancelar solo desde `scheduled`.
- Cambio de esquema: requiere `pnpm --filter @workspace/db run push` antes de usar el código nuevo.
- Endpoints: autorización admin por sesión de Auth.js (ver Task 4). La autenticación por token de la APK admin queda para el proyecto de la APK.

## Review Focus

1. Editar con `startTime >= endTime` debe rechazarse (dominio, no solo formulario). Test en Task 1.
2. Editar, cancelar o reactivar una parada `completed` debe rechazarse. Test en Task 1.
3. Eliminar una parada con pedidos asociados no borra nada (ni stock). Test en Task 2.
4. Editar el lugar y luego volverlo al original hace desaparecer la etiqueta "Cambió de lugar". Test en Task 1.
5. Una parada `cancelled` cuyo `endTime` ya pasó no aparece en el sitio público. Test en Task 2.
6. Horas en horario de verano (ACDT) y de invierno (ACST) se convierten bien. Test en Task 3.

---

### Task 1: Dominio de paradas (editar, transiciones, etiquetas, eliminar)

**Files:**
- Modify: `packages/domain/src/trailer-stops/entities.ts`, `ports.ts`, `use-cases.ts`
- Test: `packages/domain/src/trailer-stops/use-cases.test.ts`

**Interfaces:**
- Produces:
  - `TrailerStop` gana campos nullables: `originalLocation: string | null`, `originalLat: number | null`, `originalLng: number | null`, `originalStartTime: Date | null`, `originalEndTime: Date | null`.
  - Puerto `TrailerStopRepository` cambia `listActive()` por `listVisible(): Promise<TrailerStop[]>` y suma `update(id: string, patch: Partial<Omit<TrailerStop, "id">>): Promise<void>`, `countOrders(id: string): Promise<number>`, `deleteWithStock(id: string): Promise<void>`.
  - `listVisibleTrailerStops(repo)` reemplaza a `listActiveTrailerStops`.
  - `updateTrailerStop(repo, id, input: { location: string; lat: number; lng: number; startTime: Date; endTime: Date }): Promise<TrailerStop>`
  - `reactivateTrailerStop(repo, id): Promise<void>`
  - `deleteTrailerStop(repo, id): Promise<void>`
  - `getStopChanges(stop: TrailerStop): { locationChanged: boolean; dateChanged: boolean }`
  - `cancelTrailerStop` y `completeTrailerStop` ahora validan el estado de origen.

- [ ] **Step 1: Write the failing tests** en `use-cases.test.ts` (actualizar `fakeRepo` con los métodos nuevos y `fakeStop` con los `original*` en `null`):
  - `updateTrailerStop` lanza si no existe la parada (mensaje `Stop not found`).
  - lanza si `status === "completed"` (`Completed stops cannot be edited`).
  - lanza si `startTime >= endTime` (`startTime must be before endTime`).
  - la primera edición que cambia el lugar guarda `originalLocation/Lat/Lng/StartTime/EndTime` con los valores previos; una segunda edición **no** pisa los `original*`.
  - `getStopChanges` devuelve `locationChanged: true` si `location` difiere de `originalLocation`, `dateChanged: true` si `startTime` o `endTime` difieren de los originales, y `{false,false}` cuando los `original*` son `null` o iguales (caso: editar el lugar y volverlo al original).
  - `cancelTrailerStop` lanza si el estado no es `scheduled`; `reactivateTrailerStop` lanza si no es `cancelled`; `completeTrailerStop` lanza si está `cancelled` o `completed`.
  - `deleteTrailerStop` lanza `Stop has orders` si `countOrders > 0` y no llama a `deleteWithStock`; si es 0, llama a `deleteWithStock(id)`.

- [ ] **Step 2: Run** `pnpm --filter @workspace/domain exec vitest run src/trailer-stops` — Expected: FAIL (funciones no definidas).

- [ ] **Step 3: Implement** entidades, puerto y casos de uso. `updateTrailerStop` guarda los `original*` solo si son `null` y algo cambió, copiando los valores previos; persiste con `repo.update`. Los `original*` se comparan por `getTime()` en fechas.

- [ ] **Step 4: Run** el mismo comando — Expected: PASS.

- [ ] **Step 5: Stage** `git add packages/domain/src/trailer-stops`. Mensaje sugerido: `Agrega edición, reactivación, eliminación y etiquetas de cambio a las paradas del dominio`.

---

### Task 2: Persistencia de paradas (esquema + repositorio)

**Files:**
- Modify: `packages/db/src/schema/trailer-stops.ts`, `packages/db/src/repositories/trailer-stop-repository.ts`
- Test: `packages/db/src/repositories/trailer-stop-repository.test.ts`

**Interfaces:**
- Consumes: puerto y entidad de Task 1.
- Produces: `DrizzleTrailerStopRepository` implementa `listVisible`, `update`, `countOrders`, `deleteWithStock` (además de lo que ya tenía, sin `listActive`).

- [ ] **Step 1: Write the failing tests** (prefijo de datos `Plan1 Test <Date.now()>`, `afterAll` borra por ese prefijo):
  - `listVisible` incluye una parada `scheduled` futura y una `cancelled` futura; excluye una `completed` futura y una `cancelled` cuyo `endTime` ya pasó.
  - `update` persiste `location`, `originalLocation` y fechas; `findById` los devuelve.
  - `deleteWithStock` borra la parada, sus filas de `stop_product_stock` y sus `stock_events` en una transacción (crear la parada con 1 fila de stock y 1 evento, borrar, verificar 0 filas en las tres tablas).
  - `countOrders` devuelve 0 sin pedidos (el caso con pedidos se cubre en el dominio con el fake).

- [ ] **Step 2: Run** `pnpm --filter @workspace/db exec vitest run src/repositories/trailer-stop-repository.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement.** Schema: cinco columnas nullables (`original_location`, `original_lat`, `original_lng`, `original_start_time`, `original_end_time`). Repositorio: `listVisible` = misma consulta de hoy pero sin `ne(status, "cancelled")`. `deleteWithStock` usa `db.transaction`: borra `stock_events` por `stop_product_stock_id` de la parada, luego `stop_product_stock`, luego la parada. `countOrders` cuenta `orders.stop_id`.

- [ ] **Step 4: Aplicar esquema** `pnpm --filter @workspace/db run push` (sin `--force`; revisar que solo agregue columnas). Luego repetir Step 2 — Expected: PASS.

- [ ] **Step 5: Stage** `git add packages/db/src`. Mensaje sugerido: `Agrega columnas originales y borrado transaccional de paradas en el repositorio`.

---

### Task 3: Helper de hora de Adelaida

**Files:**
- Create: `apps/web/src/lib/adelaide-time.ts`
- Test: `apps/web/src/lib/adelaide-time.test.ts`

**Interfaces:**
- Produces:
  - `parseAdelaideLocal(value: string): Date` — recibe `"YYYY-MM-DDTHH:mm"` (valor de `datetime-local`) y devuelve el instante UTC correspondiente en hora de Adelaida.
  - `toAdelaideLocalInput(date: Date): string` — inverso, para precargar el formulario de edición.

- [ ] **Step 1: Write the failing test:** `parseAdelaideLocal("2026-10-28T10:00")` es `2026-10-27T23:30:00.000Z` (ACDT, +10:30); `parseAdelaideLocal("2026-07-01T10:00")` es `2026-07-01T00:30:00.000Z` (ACST, +9:30); `toAdelaideLocalInput` invierte ambos.

- [ ] **Step 2: Run** `pnpm --filter @workspace/web exec vitest run src/lib/adelaide-time.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** con `Intl.DateTimeFormat` y `timeZone: "Australia/Adelaide"` (calcular el offset de ese instante y restarlo; sin dependencias nuevas).

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Stage** `git add apps/web/src/lib/adelaide-time*`. Mensaje sugerido: `Agrega helper de hora de Adelaida para las paradas`.

---

### Task 4: Acciones del panel y endpoints admin

**Files:**
- Modify: `apps/web/src/app/actions/admin-trailer-stops.ts` (acciones nuevas, y `createTrailerStopAction` recibe `startTime`/`endTime` ya en ISO sin cambios)
- Create: `apps/web/src/app/api/admin/_lib/authorize-admin.ts`, `apps/web/src/app/api/admin/trailer-stops/route.ts`, `.../[id]/route.ts`, `.../[id]/cancel/route.ts`, `.../[id]/reactivate/route.ts`, `.../[id]/complete/route.ts`
- Test: `apps/web/src/app/api/admin/trailer-stops/route.test.ts`, `.../[id]/route.test.ts`

**Interfaces:**
- Consumes: casos de uso de Task 1, repositorio de Task 2.
- Produces:
  - Acciones: `updateTrailerStopAction(id: string, input: { location: string; lat: number; lng: number; startTime: string; endTime: string }): Promise<TrailerStop>`, `reactivateTrailerStopAction(id)`, `deleteTrailerStopAction(id)`.
  - `authorizeAdmin(): Promise<Response | null>` — usa la sesión de Auth.js (`auth()`); devuelve 401 si no hay sesión y 403 si el rol no es `admin`, `null` si pasa.
  - Endpoints: `GET /api/admin/trailer-stops` (lista), `POST` (crea), `GET/PATCH/DELETE /api/admin/trailer-stops/[id]`, `POST .../cancel`, `.../reactivate`, `.../complete`. Errores de dominio → 409 con `{ error }`; parada inexistente → 404; cuerpo inválido → 400.

- [ ] **Step 1: Write the failing tests** (mockeando `@/auth` y el repositorio, mismo estilo que `orders/queue/route.test.ts`): sin sesión → 401; rol `delivery` → 403; `PATCH` con fin anterior al inicio → 409; `DELETE` de parada con pedidos → 409; `DELETE` de parada sin pedidos → 200 y se llamó a `deleteWithStock`; `PATCH` inexistente → 404.

- [ ] **Step 2: Run** `pnpm --filter @workspace/web exec vitest run src/app/api/admin/trailer-stops` — Expected: FAIL.

- [ ] **Step 3: Implement.** Las acciones y los handlers llaman a los mismos casos de uso; las acciones agregan `requireAdmin()`, los handlers `authorizeAdmin()`. Validar el cuerpo con Zod (`zod/v4`).

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Stage** `git add apps/web/src/app/actions apps/web/src/app/api/admin`. Mensaje sugerido: `Agrega acciones y endpoints de administración para editar, reactivar y eliminar paradas`.

---

### Task 5: Panel admin (editar, detalle, eliminar)

**Files:**
- Modify: `apps/web/src/components/admin/trailer-stop-form.tsx`, `trailer-stop-row-actions.tsx`, `apps/web/src/app/[locale]/admin/trailer-stops/page.tsx`, `[id]/page.tsx`, `packages/i18n/src/dictionaries/{en,es}.ts`, `packages/i18n/src/types.ts`
- Create: `apps/web/src/app/[locale]/admin/trailer-stops/[id]/edit/page.tsx`, `apps/web/src/components/admin/delete-stop-button.tsx`

**Interfaces:**
- Consumes: acciones de Task 4, helper de Task 3.
- Produces: `TrailerStopForm` acepta `stop?: TrailerStop`; con `stop` presente precarga los campos (`toAdelaideLocalInput`), oculta la selección de productos y llama a `updateTrailerStopAction`; sin él, crea como hoy pero interpretando las horas con `parseAdelaideLocal`. `DeleteStopButton({ stopId, stockCount }: { stopId: string; stockCount: number })` pide confirmación y, si `stockCount > 0`, muestra que el stock se elimina con la parada.

- [ ] **Step 1: Claves i18n (en y es):** `stopsEditButton`, `stopsReactivateButton`, `stopsDeleteButton`, `stopsDeleteConfirm`, `stopsDeleteStockWarning` (con `{count}`), `stopsDeleteError`, `stopsEditTitle`, `stopsBackToList`. Verificar `pnpm --filter @workspace/i18n exec vitest run` (paridad) en verde.

- [ ] **Step 2: Implementar** `trailer-stop-form` en modo edición y la página `[id]/edit`. Las horas del listado y del detalle se muestran en Adelaida (con hora, no solo fecha).

- [ ] **Step 3: Detalle `[id]/page.tsx`:** agregar mapa de solo lectura (`LocationMap`), badge de estado, enlace "Volver", botones Editar / Cancelar / Reactivar / Eliminar según el estado (`completed` no muestra acciones de edición). `TrailerStopRowActions` suma Reactivar para `cancelled`; el listado suma Editar.

- [ ] **Step 4: Verificar** `pnpm run typecheck` — Expected: sin errores.

- [ ] **Step 5: Stage** los archivos tocados. Mensaje sugerido: `Agrega edición, detalle completo y eliminación de paradas en el panel`.

---

### Task 6: Sitio público (etiquetas, "antes" y aviso)

**Files:**
- Modify: `apps/web/src/components/sections/find-us.tsx`, `find-us-client.tsx`, `packages/i18n/src/dictionaries/{en,es}.ts`, `packages/i18n/src/types.ts`

**Interfaces:**
- Consumes: `listVisibleTrailerStops`, `getStopChanges` de Task 1.
- Produces: claves `findUs.notice`, `findUs.cancelled`, `findUs.locationChanged`, `findUs.dateChanged`, `findUs.before`.

- [ ] **Step 1: i18n.** `notice`: EN `Stops may change without notice.`; ES `Las paradas pueden cambiar sin previo aviso.` Etiquetas EN `Cancelled`, `Location changed`, `Date changed`, `before:`; ES `Cancelada`, `Cambió de lugar`, `Cambió de fecha`, `antes:`. Paridad en verde.

- [ ] **Step 2: Implementar.** `find-us.tsx` usa `listVisibleTrailerStops`. `find-us-client.tsx`: aviso bajo el título; parada `cancelled` con día, horario y lugar tachados y etiqueta; etiquetas de cambio a partir de `getStopChanges`, con el dato anterior en gris (`originalLocation`, y día/horario original). El mapa de una parada cancelada sigue seleccionable pero la primera seleccionada por defecto es la primera no cancelada.

- [ ] **Step 3: Verificar** `pnpm run typecheck` y `pnpm --filter @workspace/web run build` — Expected: sin errores.

- [ ] **Step 4: Verificación manual** (`pnpm --filter @workspace/web run dev`): en inglés (`/`) y español (`/es`), con una parada cancelada, una con cambio de lugar, una con cambio de fecha y una eliminada: la eliminada no deja rastro; el aviso se ve; los tachados y "antes" se ven. Registrar el resultado.

- [ ] **Step 5: Stage** los archivos tocados. Mensaje sugerido: `Muestra paradas canceladas y cambios con etiquetas y aviso fijo en el sitio público`.

---

### Task 7: Cierre

**Files:**
- Modify: `CLAUDE.md` (sección Architecture decisions, un bullet breve: estados, `original*`, eliminación con stock, endpoints `/api/admin/trailer-stops`), `handoff.md` (5 secciones, sin borrar intentos previos)

- [ ] **Step 1:** `pnpm run typecheck && pnpm run test` — Expected: todo verde.
- [ ] **Step 2:** Actualizar `CLAUDE.md` y `handoff.md`.
- [ ] **Step 3: Stage** y dejar al owner los comandos de commit.
