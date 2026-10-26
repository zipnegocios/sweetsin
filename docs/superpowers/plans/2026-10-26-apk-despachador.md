# Pantalla del despachador en la APK — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `DespachadorQueueScreen` (botones y colores genéricos, sin manejo de errores) por una pantalla del despachador hecha con el design system, tema `indoor`, que trabaja solo en línea y maneja sesión vencida, conflictos y falta de red.

**Architecture:** Se reutilizan los endpoints que ya existen (`GET /api/mobile/orders/queue`, `GET /api/mobile/delivery-staff`, `PATCH .../status`, `PATCH .../assign`). El servidor deja de devolver el `Order` completo en la cola (solo los campos que la pantalla usa). La app separa la lógica pura (qué acción corresponde a cada orden, cómo se clasifica una respuesta) de la pantalla, igual que la pantalla del delivery. Sin SQLite ni cola de comandos: el despachador es solo en línea.

**Tech Stack:** Expo SDK 57 / React Native 0.86 (`apps/mobile`), Next 15 Route Handlers (`apps/web`), Vitest, `packages/i18n`.

**Spec:** `docs/superpowers/specs/2026-10-20-apk-multirol-design.md` (el despachador trabaja solo en línea, con aviso visible de "sin conexión"). Diseño: `docs/design/mobile-design-system.md` (tema `indoor`). Referencia de patrones: `apps/mobile/src/screens/DeliveryQueueScreen.tsx`.

## Global Constraints

- Solo Android. Sin WebView/PWA. Sin push (descartado); la cola se refresca por polling cada 30 s y al volver a primer plano (`usePolling`).
- Las pantallas importan UI solo de `design-system/index.ts`; sin colores, `fontFamily` ni primitivas de `react-native` (`View`, `Text`, `Button`, `ScrollView`, ...) en `src/screens/` (lo vigila `src/design-rules.test.ts`). Los componentes que falten se crean en el design system, nunca dentro de la pantalla.
- Tema `indoor` para esta pantalla; el resto de la app sigue con `outdoor`. Acciones primarias en barra inferior, actúan sobre la orden seleccionada (mismo patrón que el delivery).
- Textos solo vía `packages/i18n` (`staffApp`), ES y EN con las mismas claves (hay test de paridad); voseo rioplatense en ES como el resto de `staffApp`; sin placeholders `{x}` en los diccionarios.
- Un 401 cierra sesión con el `logout` único de `useAuth()`; un 403 (rol incorrecto) o un 409 se muestran como aviso, nunca cierran sesión.
- Mensajes de commit en español, una sola línea, sin firmas; un commit por tarea, en `main`.

## Review Focus

1. Un 409 al avanzar o asignar (otro despachador ya la movió): la pantalla muestra el motivo y recarga la cola; no deja el botón colgado.
2. Un 401 a mitad de una acción: cierra sesión, no deja la pantalla en blanco ni en bucle.
3. Sin red: banner visible, las acciones quedan deshabilitadas (no se encolan), la última cola cargada sigue visible.
4. Una orden de retiro (`pickup`) en `ready_for_pickup`: no ofrece "Asignar repartidor" (el dominio no tiene transición de retiro a entregada).
5. Sin repartidores activos: mensaje claro y la asignación deshabilitada, no una lista vacía muda.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `apps/web/src/app/api/mobile/orders/queue/route.ts` (+ test) | proyecta la cola a `QueueOrder` |
| `apps/mobile/src/dispatch/types.ts` | `QueueOrder`, `DeliveryStaff` |
| `apps/mobile/src/dispatch/actions.ts` (+ test) | `nextAction`, `parseQueue`, `parseStaff`, `classifyDispatchResponse` |
| `packages/i18n/src/{types,dictionaries/en,dictionaries/es}.ts` | claves `staffApp.dispatch*` |
| `apps/mobile/src/screens/DespachadorQueueScreen.tsx` | pantalla reconstruida |
| `apps/mobile/src/navigation/index.tsx` | envuelve la pantalla en `ThemeProvider theme={indoor}` |
| `apps/mobile/src/design-rules.test.ts` | se vacía `EXCEPTIONS` |

---

### Task 1: La cola del servidor devuelve solo lo necesario

**Files:**
- Modify: `apps/web/src/app/api/mobile/orders/queue/route.ts`
- Test: `apps/web/src/app/api/mobile/orders/queue/route.test.ts` (existe; extenderlo)

**Interfaces:**
- Produces: `GET /api/mobile/orders/queue` → `{ orders: QueueOrder[] }` con `QueueOrder = { id: string; customerName: string; customerPhone: string; fulfillmentType: "pickup" | "self_delivery"; fulfillmentStatus: "received" | "in_prep" | "ready_for_pickup"; deliveryAddress: string | null; totalCents: number; itemCount: number }` (`itemCount` = suma de `quantity` de los ítems). Nada de `customerEmail`, `stripePaymentIntentId` ni `items`.

- [ ] **Step 1: Test** (`projects only the dispatcher fields`): con un repositorio mockeado que devuelve un `Order` completo, la respuesta 200 es exactamente `[{ id, customerName, customerPhone, fulfillmentType, fulfillmentStatus, deliveryAddress, totalCents, itemCount }]` (comparación con `toEqual`, de modo que un campo extra falle) y `itemCount` suma las cantidades. Mantener los tests existentes de 401/403.
- [ ] **Step 2:** `pnpm --filter @workspace/web exec vitest run src/app/api/mobile/orders/queue` → FAIL.
- [ ] **Step 3:** Implementar la proyección en el handler (una función local `toQueueOrder(order: Order)`); mismo patrón que la proyección de `orders/assigned/route.ts`.
- [ ] **Step 4:** Mismo comando → PASS; `pnpm run typecheck` en verde.
- [ ] **Step 5:** `git add` de lo tocado y commit: `Reduce la cola del despachador a los campos que usa la pantalla`.

---

### Task 2: Lógica pura del despachador (app)

**Files:**
- Create: `apps/mobile/src/dispatch/types.ts`, `apps/mobile/src/dispatch/actions.ts`
- Test: `apps/mobile/src/dispatch/actions.test.ts`

**Interfaces:**
- Consumes: forma de `QueueOrder` de la Task 1.
- Produces:
  - `type DispatchAction = { kind: "start_prep" } | { kind: "mark_ready" } | { kind: "assign" } | { kind: "none" }`
  - `nextAction(order: QueueOrder): DispatchAction` — `received` → `start_prep`; `in_prep` → `mark_ready`; `ready_for_pickup` + `self_delivery` → `assign`; `ready_for_pickup` + `pickup` → `none`.
  - `parseQueue(body: unknown): QueueOrder[]` y `parseStaff(body: unknown): DeliveryStaff[]` — validan forma y descartan filas mal formadas (nunca lanzan; cuerpo inválido → `[]`).
  - `type DispatchResult = { kind: "ok" } | { kind: "unauthorized" } | { kind: "conflict"; reason: string } | { kind: "forbidden" } | { kind: "server" }`
  - `classifyDispatchResponse(status: number, body: unknown): DispatchResult` — 2xx → `ok`; 401 → `unauthorized`; 403 → `forbidden`; 409 → `conflict` con `body.error` si es string (si no, `""`); cualquier otro → `server`.

- [ ] **Step 1: Tests** con los casos anteriores (una fila por estado/tipo para `nextAction`; `parseQueue` descarta una fila sin `id` y conserva las válidas; `parseQueue("x")` → `[]`; `classifyDispatchResponse(409, { error: "Cannot move to in_prep from status: in_prep" })` → `conflict` con ese motivo; 500 → `server`).
- [ ] **Step 2:** `pnpm --filter mobile run test -- dispatch` → FAIL.
- [ ] **Step 3:** Implementar. TypeScript puro, sin imports de React Native (el test corre en Node).
- [ ] **Step 4:** PASS + `pnpm --filter mobile run typecheck`.
- [ ] **Step 5:** `git add` y commit: `Agrega la logica pura del despachador para acciones y respuestas`.

---

### Task 3: Textos ES/EN del despachador

**Files:**
- Modify: `packages/i18n/src/types.ts`, `packages/i18n/src/dictionaries/en.ts`, `packages/i18n/src/dictionaries/es.ts`

**Interfaces:**
- Produces claves en `staffApp` (strings planos, sin `{x}`): `dispatchTitle`, `dispatchEmptyTitle`, `dispatchEmptyBody`, `dispatchLoading`, `dispatchLoadError`, `dispatchOfflineBanner` ("Sin conexión. Las acciones se habilitan al reconectar."), `dispatchStartPrep`, `dispatchMarkReady`, `dispatchAssignTitle`, `dispatchAssignConfirm`, `dispatchNoStaff`, `dispatchPickupNoAction`, `dispatchActionFailed`, `dispatchConflictTitle`, `dispatchForbidden`, `dispatchItems`, `dispatchSelectOrder`.

- [ ] **Step 1:** Agregar las claves al tipo y a ambos diccionarios (el test de paridad de `packages/i18n` es la verificación; ES con voseo como el resto).
- [ ] **Step 2:** `pnpm --filter @workspace/i18n run test && pnpm run typecheck` → PASS.
- [ ] **Step 3:** `git add` y commit: `Agrega los textos ES y EN de la pantalla del despachador`.

---

### Task 4: Pantalla del despachador con el design system

**Files:**
- Modify: `apps/mobile/src/screens/DespachadorQueueScreen.tsx` (reescritura), `apps/mobile/src/navigation/index.tsx`, `apps/mobile/src/design-rules.test.ts`
- Create (solo si hace falta un componente que el design system no tiene, p. ej. una fila seleccionable para elegir repartidor): en `apps/mobile/src/design-system/molecules/` + export en `index.ts`, usando solo tokens del tema.

**Interfaces:**
- Consumes: `nextAction`, `parseQueue`, `parseStaff`, `classifyDispatchResponse` (Task 2); `usePolling`, `isNetworkError`, `useAuth().logout`, `apiFetch`; `Banner`, `Button`, `Card`, `EmptyState`, `OfflineBanner`, `ScreenHeader`, `ScreenLayout` (`scroll={false}`), `StatusPill`, `Text`, `Touchable`, `useTheme`; claves de la Task 3.
- Produces: `DespachadorQueueScreen()` sin props.

Comportamiento (la lógica pura ya está probada en la Task 2; la pantalla se verifica en el dispositivo):
- Cabecera con título y "Salir" (`ScreenHeader`); `OfflineBanner` visible cuando falla la red (`isNetworkError`); la última cola cargada sigue visible.
- Lista de tarjetas (`Card` + `StatusPill`): nombre, tipo (retiro o entrega), dirección si existe, total e ítems. Tocar una tarjeta la selecciona (por defecto, la primera); la seleccionada se marca con borde y el texto "Seleccionada", no solo color.
- Barra inferior (`bottomBar`): el botón primario según `nextAction(selected)` (`Empezar preparación` / `Marcar listo` / `Asignar repartidor`); `none` muestra el texto `dispatchPickupNoAction` en vez de un botón.
- "Asignar repartidor" abre una lista de repartidores activos (de `/api/mobile/delivery-staff`); elegir uno y confirmar llama a `PATCH .../assign`. Sin repartidores: `dispatchNoStaff` y el botón deshabilitado.
- Acciones deshabilitadas con `loading` mientras la petición corre y sin red; resultado vía `classifyDispatchResponse`: `ok` → recarga; `unauthorized` → `logout()`; `conflict` → `Alert` con `dispatchConflictTitle` + motivo y recarga; `forbidden`/`server` → aviso `dispatchActionFailed`.
- Polling cada 30 s con `usePolling`; carga inicial con `dispatchLoading`; cola vacía con `EmptyState`; un 401 al cargar la cola también cierra sesión.

- [ ] **Step 1:** En `design-rules.test.ts` vaciar `EXCEPTIONS` (la lista queda `[]`; el test "cada excepción es un archivo real" debe seguir pasando). Correr: FAIL porque la pantalla vieja viola la regla.
- [ ] **Step 2:** Reescribir `DespachadorQueueScreen.tsx` según el comportamiento de arriba, siguiendo la estructura de `DeliveryQueueScreen.tsx` (estado, `run` con `useCallback`, `cancelled` ref, `usePolling`).
- [ ] **Step 3:** En `navigation/index.tsx`, envolver la pantalla del rol `despachador` en `<ThemeProvider theme={indoor}>` (importar `ThemeProvider` e `indoor` de `../design-system`); sin tocar la rama del delivery. Usar `headerShown: false`.
- [ ] **Step 4:** `pnpm --filter mobile run test && pnpm --filter mobile run typecheck && pnpm --filter mobile exec expo export --platform android` → PASS (incluye el test de arquitectura del design system y el de reglas de pantallas).
- [ ] **Step 5:** `git add` y commit: `Reconstruye la pantalla del despachador con el sistema de diseno`.

---

### Task 5: Documentación y lista de verificación

**Files:**
- Modify: `CLAUDE.md` (Where things live / Architecture decisions: el despachador ya no está diferido; solo en línea; tema `indoor` en uso), `handoff.md` (agregar, sin borrar), `docs/superpowers/checklist-dispositivo-delivery.md` (agregar sección "Despachador")

- [ ] **Step 1:** Actualizar `CLAUDE.md` y `handoff.md`; quitar de lo diferido la pantalla del despachador (mapa de flota y admin siguen diferidos).
- [ ] **Step 2:** Checklist del despachador (casillas con resultado esperado): login con PIN de despachador; ver la cola; empezar preparación; marcar listo; asignar a un repartidor y verificar que aparece en la app del delivery en ≤ 30 s; modo avión muestra el banner y deshabilita acciones sin cerrar la app; conflicto (otra sesión mueve la misma orden) muestra el motivo; orden de retiro no ofrece asignar; sin repartidores activos muestra el aviso; sesión vencida vuelve al login; escala de fuente 130 % y 200 % sin cortes; TalkBack lee estado y acción.
- [ ] **Step 3:** `git add CLAUDE.md handoff.md docs/superpowers/checklist-dispositivo-delivery.md` y commit: `Documenta la pantalla del despachador y su lista de verificacion`.

---

## Self-review

- **Cobertura:** cola, empezar preparación, marcar listo, asignar (Task 4); diseño y tema `indoor` (Task 4); solo en línea con banner (Task 4); 401/409/403 (Tasks 2 y 4); textos ES/EN (Task 3); reducción del payload (Task 1); docs y verificación (Task 5).
- **Consistencia de tipos:** `QueueOrder` se define una vez en el servidor (Task 1) y en `dispatch/types.ts` (Task 2); `nextAction` y `classifyDispatchResponse` los consume solo la Task 4.
- **Fuera de alcance, a propósito:** mapa de flota, historial de órdenes, ver la posición de los repartidores, órdenes de retiro hasta "entregada" (el dominio no tiene esa transición; hoy esas órdenes quedan en `ready_for_pickup`), notificación al despachador (push descartado), filtros y búsqueda.
