# APK Android — Fundación, diseño UI/UX, delivery offline y evidencia de entrega (Plan 1 de 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar `apps/mobile` compilable como APK firmada en GitHub Actions, sin HMAC, con un design system propio de las apps móviles APK, independiente del de la web (íconos, splash, tokens, tipografía, componentes, estados de red y accesibilidad), con push validado, con un delivery que sigue operando durante cortes de red cortos y que puede adjuntar foto + GPS como evidencia de entrega.

**Architecture:** El servidor es la autoridad: el teléfono nunca decide estado. El delivery guarda una caché de solo lectura de sus órdenes asignadas y una cola local de comandos "entregada" (TypeScript puro con almacenamiento inyectado; `expo-sqlite` solo implementa la interfaz). La evidencia se sube **directo a R2 con una URL prefirmada que genera el servidor**, así la APK (pública) nunca contiene credenciales de R2.

**Tech Stack:** Expo SDK 57 / React Native 0.86.3, `expo-sqlite`, `expo-image-picker`, `expo-location`, `expo-localization`, `expo-image` (GIF animados), `expo-font` + `@expo-google-fonts/{fraunces,dm-sans,dm-mono}`, `expo-splash-screen`, `Animated` de React Native (sin librerías de animación nuevas), `sharp` (script de íconos), Vitest, GitHub Actions (`expo prebuild` + Gradle + `apksigner`), Next.js route handlers, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (R2), `packages/domain`, `packages/i18n`.

**Spec:** `docs/superpowers/specs/2026-10-20-apk-multirol-design.md` (incluye las enmiendas del 2026-10-20: decisiones nuevas de este plan y "diseño UI/UX y sistema de diseño en mobile"). Design systems: el de la web ya existe y **no se toca**; el de las apps móviles se funda en la Task 9 (`docs/design/mobile-design-system.md`).

**Planes siguientes:** **Plan 2** — rol admin en la APK (login email+contraseña+biométrico, Route Handlers admin, pantallas de Órdenes con histórico de entregas y visualización de la evidencia, Paradas y stock, Eventos y calendario), índice en `orders.assigned_delivery_user_id` y guard de middleware de `/dispatch` y `/delivery`. **Plan 3** — ver "Fuera de alcance".

## Decisiones que necesitan tu confirmación antes de ejecutar

1. **Una orden pagada hoy nunca entra sola a la cola.** `confirmOrderPayment`/`markAsPaid` solo cambian `paymentStatus`; nada mueve la orden de `pending` a `received` (solo el selector manual del panel admin). `CLAUDE.md` describe la intención ("una orden paga entra a `received`"). Task 3 hace que `confirmOrderPayment` la mueva a `received` y notifique. Task 4 hace que marcar `paid` desde el panel admin (el camino real hoy, porque Stripe no tiene credenciales) pase por `confirmOrderPayment`: **efecto nuevo: descuenta stock (si la orden tiene `stopId`), entra a la cola y dispara push.** No es retroactivo para órdenes ya pagadas.
2. **R2:** busqué en el repo y no existe ningún cliente, variable ni credencial de R2 (solo se lo menciona como servicio externo en `docs/superpowers/SweetSin_Prompt_ClaudeCode.md`). Hay que proveer credenciales de servidor (Task 12, paso manual) y el acceso es por URL prefirmada.
3. **La evidencia es un par foto + GPS** (ambos requeridos para registrarla) y **no se encola offline**: si falla, se avisa y la entrega se puede marcar igual.
4. Se guarda la **clave del objeto** (`deliveryEvidenceKey`), no una URL: el bucket es privado y la foto muestra el domicilio del cliente.
5. El flag `deliveryEvidenceRequired` vive en la tabla `settings` (mismo patrón que `deliveryFeeCents`), no en una constante.
6. Task 12 modifica el esquema de la **base compartida dev=prod** (columnas nullable/booleano con default: aditivo, no destructivo) y requiere tu OK antes de correr el `push`.
7. `expo-image-picker` (cámara del sistema) en vez de `expo-camera`: menos código, sin pantalla de cámara propia.
8. Idioma de la APK: el del dispositivo (`expo-localization`), con `en` (`DEFAULT_LOCALE`) como respaldo.
9. **Los íconos de `apps/mobile/assets/` son los de la plantilla de Expo** (chevron azul) y se reemplazan (Task 6). El ícono es la mascota sobre fondo Midnight Navy (se aprueba con una vista previa; alternativa: Cream). **Resolución de la fuente:** la mascota plana más grande del repo es `apps/web/public/devil-icon.png` (373×343; `attached_assets/favicon.png` es de 187×172 y no sirve como fuente). Alcanza para el ícono adaptativo, pero el splash y el `icon.png` de 1024 px quedan algo blandos: conviene pedirle al diseñador un **SVG o PNG de mayor resolución** de la mascota plana. El logo 3D de 2048 px es de otro estilo ("peluche") y no se usa como ícono.
10. **Animaciones de marca:** `videologo.gif` (8 s) e `isotipo.gif` (2,5 s) son transparentes y de bucle infinito. Se usan solo en el inicio de sesión, la carga y los estados vacíos, con respaldo estático si el teléfono tiene "reducir movimiento"; nunca en pantallas de trabajo. Se **copian** a `apps/mobile/assets/brand/` (la app no depende de la carpeta pública de la web).
11. **Dos design systems independientes (decisión del owner):** el de la web no se toca; el de mobile se funda en la Task 9. Parte de la marca (paleta, tipografías, radios y voz) copiada una sola vez como punto de partida y evoluciona por su cuenta: la app no importa nada de la web ni comprueba paridad con ella. Al fundarlo se define lo que la web no tiene: el dorado `#C9943A` como token base y un verde de éxito `#2F7D5B` (decisión mía: la paleta no tiene verde y "entregado/sincronizado" necesita un estado positivo). Validar con el diseñador.
12. **Las tres pantallas existentes (inicio de sesión, despachador, delivery) se reconstruyen con el kit de diseño y se traducen enteras** (Tasks 11 y 14); antes eran formularios con botones por defecto y texto en español fijo.
13. **Pregunta sobre el ciclo de trabajo de UI (no reabro la decisión, la planteo):** sin Expo Go y sin `expo-dev-client`, cada ajuste visual exige compilar un APK en el workflow (varios minutos). El plan lo mitiga agrupando la revisión visual (Task 11 primera integración, Task 15 revisión completa), pero para pulir la UI con comodidad serviría un **build de desarrollo** (`expo-dev-client`, un APK aparte que no se distribuye al staff) con recarga en vivo. Dime si lo quieres para la etapa de diseño.

## Global Constraints

- Solo Android/APK. Fuera de alcance: Expo Go, iOS/IPA, WebView/PWA embebida, módulo TV, pedidos presenciales, pantallas de staff, sincronización bidireccional de tablas (PowerSync/ElectricSQL), WebSockets/SSE.
- "El teléfono nunca decide estado": toda transición la valida el servidor con casos de uso de `packages/domain`.
- Offline solo para **delivery**; despachador (y admin, Plan 2) trabajan solo en línea con aviso visible de "sin conexión".
- Detección de red: por fallo de `fetch`, nunca `navigator.onLine`.
- "Tiempo real" = polling (30 s) + refresco al volver a primer plano + push de orden nueva.
- Almacenamiento local: `expo-sqlite`; sesión en `expo-secure-store` (ya existe).
- Build: GitHub Actions propio con `expo prebuild` + Gradle. No EAS Build.
- La APK no contiene secretos ni credenciales de R2; toda credencial vive en el servidor.
- **i18n:** todo string **nuevo** en `apps/mobile` sale de `packages/i18n` (namespace nuevo `staffApp`, reutilizando claves de `dispatch`/`common` que ya existan). Las pantallas que se reconstruyen con el kit de diseño (inicio de sesión, delivery, despachador) se traducen enteras.
- **UI/UX:** el design system mobile (`docs/design/mobile-design-system.md`) es independiente del de la web; toda pantalla se construye solo con el kit `apps/mobile/src/ui/` y los tokens de `apps/mobile/src/theme/`; sin colores ni fuentes literales en `screens/` (lo comprueba un test, Task 9). Tema claro único; vertical; ver "Criterios de calidad de UI".
- Antes de escribir código en `apps/mobile`: leer `apps/mobile/AGENTS.md` (docs de Expo v57: https://docs.expo.dev/versions/v57.0.0/).
- Reglas de `CLAUDE.md`: Claude nunca ejecuta `git commit` ni `git push` (solo `git add` y sugerir el comando); commits en español, una línea, sin firmas; trabajar en `main`; reutilizar antes de crear; razonar en español con la estructura de 4 pasos.
- Base de datos compartida dev=prod: los tests que escriban datos limpian lo que crean (prefijo identificable); un `push` de esquema requiere OK del owner.

## Decisiones registradas (para que no queden como pendientes abiertos)

- **Sin guard adicional en logout ni en la cola de comandos:** cada delivery tiene su propio dispositivo de trabajo, así que sesión y cola local siempre corresponden al mismo usuario. Logout borra la caché de órdenes (datos de clientes) pero **no** la cola de comandos (solo guarda `orderId`).
- **Confirmación del cliente ("sí, lo recibí")**: `fulfillmentStatus` sigue siendo un único campo y `delivered` solo lo dispara el delivery (`markOrderDelivered`). No se agrega ningún campo ni lógica para la confirmación del cliente; el modelo de este plan no la bloquea (la evidencia cuelga de `orderId`; no se toca el enum de estados).
- **Retención de evidencia:** 7 días por defecto, ampliable a 30, **pendiente de confirmación del equipo legal**. No se implementa borrado automático aquí; la regla de ciclo de vida del bucket R2 queda como tarea de infraestructura separada. Se documenta en `handoff.md` y en un comentario del adaptador R2.

## Fuera de alcance (Plan 3 futuro, posterior al Plan 2)

Flujo de disputas del cliente: "producto no recibido", tipificaciones de reclamo, vista de la foto de evidencia en el panel del cliente y estado `disputed` en la orden. No se crea ningún endpoint, tabla ni pantalla para esto en el Plan 1. La foto solo la ve el propio delivery (indicador "evidencia enviada") y, en el Plan 2, el admin.

## Review Focus

1. Reintento de "entregada" tras respuesta perdida → éxito idempotente; reintento de otro usuario sobre `delivered` → rechazado (Task 1).
2. Pasar de `pending` a `delivered` desde el panel admin → rechazado como lo rechazaría el dominio; marcar `paid` dos veces (reintento del webhook o doble clic) → una sola notificación y un solo descuento de stock (Tasks 3–4).
3. Corte de red a mitad del vaciado de la cola → los restantes quedan en orden, sin duplicar ni perder; token vencido → quedan en cola (Task 10).
4. Evidencia: clave de otra orden o de una orden no asignada → rechazada; fallo de la subida → "Entregar" sigue funcionando (Tasks 12–13).
5. Login con body que no es JSON → 400, no 500 (Task 2).

## Criterios de calidad de UI (aplican a las Tasks 6, 9, 11, 13 y 14; se verifican en la Task 15)

Derivan del spec (enmienda II). Una pantalla no está terminada si incumple alguno:

1. **Contraste AA:** 4,5:1 texto normal y 3:1 texto grande (≥ 18 sp en negrita) y componentes. Texto pequeño nunca sobre relleno Sin Red ni en rojo sobre Cream (usar Sin Red Dark). El test de contraste (Task 9) recorre los pares permitidos.
2. **Tocables ≥ 48×48 dp**, separación ≥ 8 dp; acción primaria a todo el ancho (52 dp) en la zona del pulgar.
3. **Escala de fuente 130 % y 200 %** sin cortes ni solapes.
4. **El estado se dice con texto + glifo + color**, nunca solo color.
5. **Estados completos en cada pantalla:** cargando, vacío, error, sin conexión, pendiente de sincronizar, éxito.
6. **Reducir movimiento** del sistema: sin animaciones de entrada y GIF reemplazados por la imagen estática.
7. **Sin animación en bucle en pantallas de trabajo**; los GIF solo en inicio de sesión, carga y estados vacíos.
8. **Voz de marca** ligera solo en estados vacíos y de éxito; errores y acciones críticas, neutros y claros.
9. **Tipografías incluidas en la APK** (la app abre sin red); el splash espera a que carguen.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `packages/domain/src/orders/{entities,ports,use-cases}.ts` | idempotencia de entrega, `received`+push al pagar, `changeOrderFulfillmentStatus`, `recordDeliveryEvidence`, puerto `DeliveryEvidenceStorage` |
| `packages/db/src/schema/{orders,settings}.ts` + repos | columnas de evidencia y flag `delivery_evidence_required` |
| `apps/web/src/lib/staff-notifications.ts` | construye el `ExpoNotificationAdapter` (reusado por webhook, acción admin y ruta de asignación) |
| `apps/web/src/app/actions/admin-orders.ts` + `components/admin/order-status-form.tsx` | cambios de estado vía dominio |
| `apps/web/src/infra/r2-delivery-evidence-storage.ts`, `lib/delivery-evidence-key.ts` | URL prefirmada y claves de evidencia |
| `apps/web/src/app/api/mobile/orders/[id]/evidence/**` | endpoints de evidencia |
| `apps/mobile/src/i18n/index.ts` | adaptador de `packages/i18n` para mobile |
| `apps/mobile/src/offline/*`, `src/api/network.ts` | cola, clasificación de respuestas, SQLite, caché |
| `apps/mobile/src/evidence/*` | flujo de subida (puro) y captura (dispositivo) |
| `apps/mobile/scripts/generate-brand-assets.mjs`, `assets/*`, `assets/brand/*` | íconos, splash, ícono de notificación y animaciones de marca |
| `docs/design/mobile-design-system.md` | design system de las apps móviles: principios, tokens en tres capas, especificación de componentes, tabla de estados, movimiento, voz y uso de la marca |
| `apps/mobile/src/theme/*` | tokens, tipografía, movimiento y utilidad de contraste |
| `apps/mobile/src/ui/*` | kit: `Button`, `Card`, `StatusPill`, `ScreenHeader`, `EmptyState`, `BrandMark`, `OfflineBanner` |
| `apps/mobile/src/hooks/use-polling.ts`, `use-reduce-motion.ts`, `screens/*` | comportamiento y pantallas |
| `.github/workflows/build-apk.yml` | build, firma, inspección y publicación |

---

### Task 1: `markOrderDelivered` idempotente

**Files:**
- Modify: `packages/domain/src/orders/use-cases.ts:137-152`
- Test: `packages/domain/src/orders/use-cases.test.ts` (bloque `describe("markOrderDelivered")`, ~línea 561; usar `makeFakeOrderRepo` y `baseOrder` de ese archivo)

**Interfaces:**
- Produces: `markOrderDelivered(deps: { orders: OrderRepository }, orderId: string, actingUserId: string): Promise<Order>` — misma firma; devuelve la orden sin escribir si ya está `delivered` y `assignedDeliveryUserId === actingUserId`.

- [ ] **Step 1: Tests** en el bloque existente:
  - `"es idempotente: el mismo delivery reintenta sobre una orden ya delivered"` — orden `delivered` asignada a `"delivery-1"`; `const spy = vi.spyOn(repo, "updateFulfillmentStatus")`; esperar `result.fulfillmentStatus === "delivered"` y `expect(spy).not.toHaveBeenCalled()`.
  - `"rechaza el reintento de otro usuario sobre una orden ya delivered"` — mismo escenario con `"delivery-2"` → `rejects.toThrow()` (probablemente ya pasa: queda como regresión).
- [ ] **Step 2: Correr y ver fallar el primero**
  Run: `pnpm --filter @workspace/domain exec vitest run src/orders/use-cases.test.ts`
  Expected: FAIL ("Cannot mark delivered from status: delivered").
- [ ] **Step 3: Implementar** — tras `findById` y la comprobación de existencia: si `order.fulfillmentStatus === "delivered" && order.assignedDeliveryUserId === actingUserId`, devolver `order` sin llamar a `updateFulfillmentStatus`. El resto no cambia.
- [ ] **Step 4: Verificar**
  Run: `pnpm --filter @workspace/domain exec vitest run`
  Expected: PASS.
- [ ] **Step 5: Stage y commit sugerido**
  `git add packages/domain/src/orders/use-cases.ts packages/domain/src/orders/use-cases.test.ts`
  Sugerido: `git commit -m "Hace idempotente la entrega de una orden para soportar reintentos offline"`

---

### Task 2: Quitar la firma HMAC del login

**Files:**
- Modify: `apps/web/src/lib/mobile-auth.ts` (eliminar `verifyAppSignature` y el import de `node:crypto`), `mobile-auth.test.ts` (eliminar su `describe` y los imports `verifyAppSignature`/`createHmac`)
- Modify: `apps/web/src/app/api/mobile/auth/login/route.ts` (sin chequeo de `x-app-signature`; `JSON.parse` dentro de try/catch → 400), `route.test.ts` (reescribir)
- Modify: `apps/mobile/src/api/client.ts` (eliminar `crypto-js`, `signBody`, `APP_SECRET` y el `if` de `X-App-Signature`), `apps/mobile/package.json`, `pnpm-lock.yaml`
- Modify: `CLAUDE.md` (Run & Operate: quitar `EXPO_PUBLIC_APP_SECRET`; Architecture decisions Fase 7: quitar la validación de integridad por HMAC y dejar la seguridad en PIN + lockout + JWT corto + `is_active`)

**Interfaces:**
- Produces: `POST /api/mobile/auth/login` acepta `{ email, pin }` sin cabecera de firma → `200 { token, role, name }` | `400` | `401`.

- [ ] **Step 1: Reescribir `route.test.ts`** (`beforeAll` solo fija `MOBILE_JWT_SECRET`): `"responde 400 si el body no es JSON"` (`body: "no-es-json"`); `"responde 400 si el pin no tiene 6 dígitos"` (prueba además que ya no se exige firma); `"responde 401 con credenciales inválidas"` (`no-existe@sweetsin.test`, sin cabecera de firma).
- [ ] **Step 2: Correr y ver fallar**
  Run: `pnpm --filter @workspace/web exec vitest run src/app/api/mobile/auth/login/route.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implementar** los cambios listados; desinstalar con `pnpm --filter mobile remove crypto-js @types/crypto-js`.
- [ ] **Step 4: Verificar**
  Run: `pnpm --filter @workspace/web exec vitest run src/lib/mobile-auth.test.ts src/app/api/mobile/auth/login/route.test.ts && pnpm run typecheck`
  Expected: PASS. Además `grep -rln "APP_SECRET\|verifyAppSignature\|crypto-js" apps packages --include=*.ts --include=*.tsx --include=package.json` (ignorando `node_modules`) no devuelve archivos.
- [ ] **Step 5: Avisar al owner** que borre `EXPO_PUBLIC_APP_SECRET` de `apps/web/.env.local` y de EasyPanel (fuera de git).
- [ ] **Step 6: Stage y commit sugerido**
  `git add apps/web apps/mobile/src/api/client.ts apps/mobile/package.json pnpm-lock.yaml CLAUDE.md`
  Sugerido: `git commit -m "Elimina la firma HMAC del login mobile y responde 400 ante JSON invalido"`

---

### Task 3: Orden pagada entra a `received` y notifica al despachador

**Files:**
- Modify: `packages/domain/src/orders/use-cases.ts` (`confirmOrderPayment`, líneas ~59-74), `use-cases.test.ts` (bloque `describe("confirmOrderPayment")`, ~línea 239; extender `fakeOrderRepoWithOrder` con `updateFulfillmentStatus` si no lo tiene)
- Create: `apps/web/src/lib/staff-notifications.ts`
- Modify: `apps/web/src/app/api/webhooks/stripe/route.ts`, `apps/web/src/app/api/mobile/orders/[id]/assign/route.ts` (usar el helper en vez de construir el adaptador inline)

**Interfaces:**
- Consumes: `listActiveStaff(repo, "despachador")` (`@workspace/domain/users`), `StaffNotificationPort.notifyNewOrderInQueue(despachadorUserIds: string[], order: { id: string; customerName: string })`.
- Produces:
  ```ts
  confirmOrderPayment(
    deps: { orders: OrderRepository; stock: StockRepository; users?: UserRepository; notifications?: StaffNotificationPort },
    orderId: string,
  ): Promise<void>
  // apps/web/src/lib/staff-notifications.ts
  export function createStaffNotifications(): StaffNotificationPort; // new ExpoNotificationAdapter(new DrizzlePushTokenRepository(), new DrizzlePushLogRepository())
  ```

- [ ] **Step 1: Tests** (los existentes de `confirmOrderPayment` deben seguir pasando sin pasar `users`/`notifications`):
  - orden `pending` → tras confirmar, `fulfillmentStatus === "received"`.
  - con `notifications` (mock con `vi.fn()`) y 2 despachadores activos → `notifyNewOrderInQueue` se llama **una vez** con los 2 ids y `{ id, customerName }`.
  - si `notifyNewOrderInQueue` lanza → `confirmOrderPayment` no lanza y la orden queda `paid` + `received`.
  - orden ya `paid` (reintento del webhook) → no cambia estado, no notifica, no descuenta stock otra vez.
  - orden que ya no está `pending` (p. ej. `received`) → no vuelve a cambiar estado ni notifica.
- [ ] **Step 2: Correr y ver fallar**
  Run: `pnpm --filter @workspace/domain exec vitest run src/orders/use-cases.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implementar** — tras `markAsPaid` y el descuento de stock: si `order.fulfillmentStatus === "pending"`, `updateFulfillmentStatus(orderId, "received")` y, si hay `users` y `notifications`, notificar a `listActiveStaff(users, "despachador")` dentro de un `try/catch` mudo (mismo principio que `assignDeliveryToOrder`: un fallo de push nunca bloquea). El `return` temprano por `paid` se mantiene.
- [ ] **Step 4: Implementar el helper `createStaffNotifications`** y usarlo en el webhook (pasando `users: new DrizzleUserRepository()` y `notifications`) y en la ruta `assign`.
- [ ] **Step 5: Verificar**
  Run: `pnpm --filter @workspace/domain exec vitest run && pnpm run typecheck`
  Expected: PASS. (El webhook no se puede probar de punta a punta sin credenciales de Stripe; el camino real hoy es Task 4.)
- [ ] **Step 6: Stage y commit sugerido**
  `git add packages/domain/src/orders apps/web/src/lib/staff-notifications.ts apps/web/src/app/api`
  Sugerido: `git commit -m "Mueve la orden pagada a received y notifica al despachador"`

---

### Task 4: Cambios de estado del panel admin pasan por el dominio

**Files:**
- Modify: `packages/domain/src/orders/use-cases.ts`, `use-cases.test.ts`
- Modify: `apps/web/src/app/actions/admin-orders.ts` (`updateOrderStatusAction`)
- Create: `apps/web/src/app/actions/admin-orders.test.ts`
- Modify: `apps/web/src/components/admin/order-status-form.tsx`
- Modify: `packages/i18n/src/types.ts`, `dictionaries/en.ts`, `dictionaries/es.ts` (clave `admin.statusChangeError`)

**Interfaces:**
- Consumes: `markOrderInPrep`, `markOrderReady`, `assignDeliveryToOrder`, `markOrderDelivered`, `confirmOrderPayment` (Tasks 1 y 3), `createStaffNotifications`.
- Produces:
  ```ts
  // dominio
  changeOrderFulfillmentStatus(
    deps: { orders: OrderRepository; users: UserRepository; notifications?: StaffNotificationPort },
    orderId: string,
    target: FulfillmentStatus,
    options?: { deliveryUserId?: string },
  ): Promise<Order>
  // acción
  updateOrderStatusAction(input: { orderId: string; fulfillmentStatus?: FulfillmentStatus; paymentStatus?: PaymentStatus; deliveryUserId?: string }): Promise<{ ok: true } | { error: string }>
  ```
  Transiciones permitidas: `pending→received|cancelled`, `received→in_prep|cancelled`, `in_prep→ready_for_pickup|cancelled`, `ready_for_pickup→out_for_delivery|cancelled`, `out_for_delivery→delivered|cancelled`; `delivered` y `cancelled` son terminales; mismo estado = sin efecto. `in_prep`/`ready_for_pickup` delegan en `markOrderInPrep`/`markOrderReady`; `out_for_delivery` exige `options.deliveryUserId` y delega en `assignDeliveryToOrder`; `delivered` (forzado por admin) delega en `markOrderDelivered` con el `assignedDeliveryUserId` de la orden; `received` y `cancelled` usan `updateFulfillmentStatus`. Cualquier otra combinación lanza `Error("Invalid transition: <actual> → <destino>")`.

- [ ] **Step 1: Tests de dominio** (`describe("changeOrderFulfillmentStatus")`): `pending→delivered` rechaza; `pending→received` ok; `received→in_prep` ok; `ready_for_pickup→out_for_delivery` sin `deliveryUserId` rechaza y con un delivery activo asigna; `out_for_delivery→delivered` ok; `delivered→in_prep` rechaza; cualquier estado no terminal → `cancelled` ok; mismo estado = sin escritura (espiar `updateFulfillmentStatus`); id inexistente rechaza.
- [ ] **Step 2: Test de la acción** (`admin-orders.test.ts`; `vi.mock("@/lib/require-admin")` que resuelve, y `vi.mock("@workspace/db/repositories")` con repos falsos en memoria): `updateOrderStatusAction({ orderId, fulfillmentStatus: "delivered" })` sobre una orden `pending` devuelve `{ error }` y **no** llama a `updateFulfillmentStatus` — hoy falla porque la acción escribe directo. Otro caso: `paymentStatus: "paid"` sobre una orden `pending` la deja `paid` + `received`; llamarla dos veces no notifica dos veces.
- [ ] **Step 3: Correr y ver fallar**
  Run: `pnpm --filter @workspace/domain exec vitest run src/orders/use-cases.test.ts && pnpm --filter @workspace/web exec vitest run src/app/actions/admin-orders.test.ts`
  Expected: FAIL.
- [ ] **Step 4: Implementar** `changeOrderFulfillmentStatus` y reescribir la acción: `requireAdmin()`; **primero** el pago (`"paid"` → `confirmOrderPayment` con `stock`, `users` y `createStaffNotifications()`; otros estados de pago → `updatePaymentStatus` como hoy), **después** el estado de cumplimiento vía `changeOrderFulfillmentStatus`; capturar los errores de dominio y devolver `{ error: message }`.
- [ ] **Step 5: Ajustar el formulario** — enviar solo los campos que cambiaron respecto de los props iniciales (si no, marcar `paid` con el selector de cumplimiento en `pending` produciría una transición inválida) y mostrar `t("statusChangeError")` cuando la acción devuelva `{ error }`. Agregar la clave a `types.ts`, `en.ts` y `es.ts`.
- [ ] **Step 6: Verificar**
  Run: `pnpm --filter @workspace/domain exec vitest run && pnpm --filter @workspace/web exec vitest run && pnpm --filter @workspace/i18n exec vitest run && pnpm run typecheck`
  Expected: PASS (incluye el test de paridad de i18n).
- [ ] **Step 7: Stage y commit sugerido**
  `git add packages apps/web`
  Sugerido: `git commit -m "Hace que el panel admin cambie estados de orden mediante las reglas del dominio"`

---

### Task 5: Arnés de `apps/mobile`: tests, typecheck, configuración Android e i18n

**Files:**
- Modify: `apps/mobile/package.json` (scripts `typecheck: "tsc --noEmit"` y `test: "vitest run"`; devDependency `vitest`; dependencia `"@workspace/i18n": "workspace:*"`; instalar con `pnpm --filter mobile exec expo install expo-sqlite expo-localization`)
- Modify: `apps/mobile/app.json` — `name: "Sweet Sin Staff"`, `slug: "sweetsin-staff"`, `android.package: "au.com.sweetsin.staff"`, `android.versionCode: 1` (decisiones del plan, corregibles); quitar `ios` y `web`
- Modify: `apps/mobile/.gitignore` — agregar `/android` y `/ios`
- Create: `apps/mobile/vitest.config.ts` (`environment: "node"`, `include: ["src/**/*.test.ts"]`)
- Create: `apps/mobile/src/i18n/index.ts`, `index.test.ts`
- Modify: `packages/i18n/src/types.ts`, `dictionaries/en.ts`, `dictionaries/es.ts` (namespace nuevo `staffApp`; las claves se van agregando en las tareas que las usan; antes de agregar una, revisar `common` y `dispatch` y reutilizar si existe)

**Interfaces:**
- Produces:
  ```ts
  // apps/mobile/src/i18n/index.ts
  export function resolveLocale(languageCode: string | null | undefined): Locale; // "es"→"es"; "en"→"en"; cualquier otro o vacío→DEFAULT_LOCALE
  export const strings: Dictionary; // dictionaries[resolveLocale(getLocales()[0]?.languageCode)] de expo-localization, calculado al cargar el módulo
  ```
  Uso en pantallas: `strings.staffApp.<clave>` y `strings.dispatch.<clave>` (los diccionarios no usan marcadores `{x}`: componer en código).

- [ ] **Step 1: Test de `resolveLocale`**: `"es"→"es"`, `"en"→"en"`, `"pt"→"en"`, `null→"en"`, `undefined→"en"`.
- [ ] **Step 2: Correr y ver fallar**
  Run: `pnpm --filter mobile run test`
  Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implementar** `i18n/index.ts` y aplicar los demás cambios de archivos; crear el namespace `staffApp` (puede nacer con una clave, p. ej. `offlineBanner`, para que el test de paridad cubra desde ya el patrón).
- [ ] **Step 4: Verificar typecheck, tests y que Metro resuelve el paquete del workspace**
  Run: `pnpm --filter mobile run typecheck && pnpm --filter mobile run test && pnpm --filter @workspace/i18n exec vitest run && pnpm --filter mobile exec expo export --platform android`
  Expected: todo PASS y el bundle JS se genera. Si Metro no resuelve `@workspace/i18n` (fuente `.ts` de otro paquete) o falla por el `node_modules` aislado de pnpm, consultar la guía de monorepos de Expo SDK 57, resolver aquí y anotarlo en "Intentos fallidos" del `handoff.md`.
- [ ] **Step 5: Verificar el gate raíz**
  Run: `pnpm run typecheck`
  Expected: PASS y `apps/mobile` aparece en la salida.
- [ ] **Step 6: Stage y commit sugerido**
  `git add apps/mobile packages/i18n pnpm-lock.yaml`
  Sugerido: `git commit -m "Prepara apps/mobile con vitest, typecheck, config Android e i18n compartido"`

---

### Task 6: Identidad visual de la app (íconos, splash, notificación y marca)

Reemplaza los íconos de la plantilla de Expo por los de Sweet Sin antes del primer APK distribuible.

**Files:**
- Create: `apps/mobile/scripts/generate-brand-assets.mjs` (usa `sharp`, reproducible e idempotente), `apps/mobile/src/brand/assets.test.ts`
- Create (copias de `apps/web/public/`): `apps/mobile/assets/brand/isotipo.gif`, `apps/mobile/assets/brand/videologo.gif`, `apps/mobile/assets/brand/mascot.png` (desde `devil-icon.png`; respaldo estático de los GIF)
- Replace: `apps/mobile/assets/icon.png`, `android-icon-foreground.png`, `android-icon-monochrome.png`, `splash-icon.png`; Create: `apps/mobile/assets/notification-icon.png`; Delete: `android-icon-background.png` (el fondo es un color sólido) y `favicon.png` (sin web)
- Modify: `apps/mobile/app.json`, `apps/mobile/package.json` (devDependency `sharp`; `expo-splash-screen` con `expo install`), `apps/mobile/.gitignore` (`/assets/.preview`)

**Interfaces:**
- Produces: `node scripts/generate-brand-assets.mjs` (desde `apps/mobile`). Fuente única de la mascota: `apps/web/public/devil-icon.png` (373×343, con alfa). Genera:
  - primer plano adaptativo: lienzo cuadrado del tamaño que use la plantilla de Expo v57, mascota escalada a ≈ 56 % del lienzo y centrada (la zona segura del ícono adaptativo es el 61 % central);
  - monocromo (íconos temáticos de Android 13+): la misma composición como silueta blanca (RGB 255, alfa de la mascota);
  - `notification-icon.png` 96×96: silueta blanca recortada con 8 % de margen (Android pinta de gris cualquier ícono de notificación que no sea monocromo);
  - `splash-icon.png`: mascota centrada sobre lienzo cuadrado transparente;
  - `icon.png` 1024×1024: mascota sobre Midnight Navy `#0F1B3D`, **sin canal alfa**;
  - `assets/.preview/icon-preview.png`: el ícono bajo máscara circular, cuadrada redondeada y "squircle", para revisión visual.
- `app.json` (valores): `icon: "./assets/icon.png"`; `android.adaptiveIcon: { foregroundImage: "./assets/android-icon-foreground.png", monochromeImage: "./assets/android-icon-monochrome.png", backgroundColor: "#0F1B3D" }`; plugins `["expo-splash-screen", { image: "./assets/splash-icon.png", backgroundColor: "#0F1B3D", imageWidth: 200 }]` y `["expo-notifications", { icon: "./assets/notification-icon.png", color: "#E63946" }]` (confirmar los nombres de opciones en los docs de Expo v57).

- [ ] **Step 1: Tests** (`assets.test.ts`, con `sharp` en Node): `icon.png` mide 1024×1024 y no tiene alfa; el primer plano y el monocromo son cuadrados y tienen alfa; en el monocromo y en `notification-icon.png`, todo píxel con alfa > 0 es blanco puro y entre el 5 % y el 60 % de los píxeles son opacos (es una silueta, no un cuadrado lleno); `notification-icon.png` mide 96×96; los dos GIF existen y pesan ≤ 1 MB; cada ruta que referencia `app.json` (`icon`, ícono adaptativo, imágenes de plugins) existe y `backgroundColor` es `#0F1B3D`.
- [ ] **Step 2: Correr y ver fallar**
  Run: `pnpm --filter mobile run test`
  Expected: FAIL (los activos son los de la plantilla de Expo).
- [ ] **Step 3: Implementar el script**, ejecutarlo, copiar los GIF y la mascota, borrar lo que sobra y actualizar `app.json`. Leer antes en los docs de Expo v57 las dimensiones del ícono adaptativo y las opciones de `expo-splash-screen`.
- [ ] **Step 4: Verificar**
  Run: `pnpm --filter mobile run test && pnpm --filter mobile run typecheck && pnpm --filter mobile exec expo prebuild --platform android --no-install --clean`
  Expected: tests PASS y el prebuild genera `android/` con los íconos (si la máquina local no puede, lo cubre el workflow de la Task 7; no commitear `android/`).
- [ ] **Step 5 (owner, manual): revisar `assets/.preview/icon-preview.png`.** Aprobar la mascota sobre Navy o pedir Cream. Pedir al diseñador un SVG o PNG de mayor resolución de la mascota plana (ver decisión 9).
- [ ] **Step 6: Stage y commit sugerido**
  `git add apps/mobile pnpm-lock.yaml`
  Sugerido: `git commit -m "Reemplaza los iconos de la plantilla de Expo por la identidad de Sweet Sin"`

---

### Task 7: Workflow de build, firma e inspección de la APK

**Files:**
- Create: `.github/workflows/build-apk.yml`

**Interfaces:**
- Produces: workflow `workflow_dispatch` con input `api_base_url` (default `https://sweetsin.com.au`). Publica el artefacto `sweetsin-staff-<run_number>` con `app-release.apk` **sin cifrar** (la APK ya no lleva secretos, ver Task 2).
- Consumes secrets del repo: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

- [ ] **Step 1 (owner, manual): generar el keystore de release y cargar los 4 secretos.**
  `keytool -genkeypair -v -keystore sweetsin-staff.jks -alias sweetsin -keyalg RSA -keysize 2048 -validity 10000`; guardar el `.jks` y sus contraseñas fuera del repo (`*.jks` ya está en `.gitignore`) y en un gestor de contraseñas; `base64 -w0 sweetsin-staff.jks` → `ANDROID_KEYSTORE_BASE64`. **Perder el keystore impide actualizar la APK instalada en los teléfonos.**
- [ ] **Step 2: Escribir el workflow** en `ubuntu-24.04`, pasos en orden:
  1. checkout; `pnpm/action-setup` (`pnpm@11.13.0`, el `packageManager` del repo); `actions/setup-node` Node 24; `actions/setup-java` Temurin 17.
  2. `pnpm install --frozen-lockfile`.
  3. Gate: `pnpm run typecheck`, `pnpm --filter mobile run test`, `pnpm --filter @workspace/domain run test`.
  4. Guardas: fallar si `grep -rn "APP_SECRET" apps/mobile/src` encuentra algo o si `api_base_url` está vacío.
  5. `jq --argjson v "$GITHUB_RUN_NUMBER" '.expo.android.versionCode = $v' apps/mobile/app.json` (versionCode = `run_number`).
  6. En `apps/mobile`: `npx expo prebuild --platform android --clean --no-install` con `EXPO_PUBLIC_API_BASE_URL` = input; luego `cd android && ./gradlew assembleRelease`.
  7. Firma: `zipalign -p 4` y `apksigner sign --ks <keystore decodificado> --ks-key-alias "$ANDROID_KEY_ALIAS" --ks-pass env:ANDROID_KEYSTORE_PASSWORD --key-pass env:ANDROID_KEY_PASSWORD` (la plantilla de Expo firma el release con la clave de debug; `apksigner` lo re-firma). Borrar el keystore decodificado al final (`if: always()`).
  8. Inspección: `aapt2 dump badging app-release.apk`; fallar si `package: name` ≠ `au.com.sweetsin.staff`, `versionCode` ≠ `$GITHUB_RUN_NUMBER` o `application-label` ≠ `Sweet Sin Staff`, o si no aparece `application-icon-*` (los íconos de la Task 6 llegaron al APK); imprimir los `uses-permission`; `apksigner verify --print-certs` debe mostrar el certificado de release, no el de debug.
  9. `actions/upload-artifact` con la APK firmada.
- [ ] **Step 3: Validar el YAML**
  Run: `pnpm dlx @action-validator/cli .github/workflows/build-apk.yml` (o `actionlint`)
  Expected: sin errores.
- [ ] **Step 4: Stage y commit sugerido; el owner hace commit y push** (el workflow debe estar en `main` para poder despacharse)
  `git add .github/workflows/build-apk.yml`
  Sugerido: `git commit -m "Agrega workflow de GitHub Actions para compilar y firmar la APK de staff"`
- [ ] **Step 5: Despachar y observar** (pedir confirmación al owner: usa secretos del repo)
  Run: `gh workflow run build-apk.yml && gh run watch`
  Expected: run verde, artefacto presente, `aapt2` con el `applicationId` y `versionCode` esperados. Si Gradle falla resolviendo `react-native` desde el `node_modules` aislado de pnpm, consultar la guía de monorepos/pnpm de Expo SDK 57 y registrar el intento en `handoff.md` ("Intentos fallidos").

---

### Task 8: Push de punta a punta en un teléfono real (validación temprana)

Se hace justo después del primer build para saber pronto si Firebase/FCM funciona con builds locales, antes de invertir el resto del plan.

**Files:**
- Modify (cuando existan los archivos): `apps/mobile/app.json` (`android.googleServicesFile`, `extra.eas.projectId`), `apps/mobile/google-services.json`

- [ ] **Step 1 (owner, manual — pregunta abierta; verificar primero en https://docs.expo.dev/push-notifications/push-notifications-setup/):** el push de Expo en Android exige un proyecto de Firebase con `google-services.json`, una clave de cuenta de servicio FCM v1 subida al servicio de push de Expo (documentada con `eas credentials`, que no implica usar EAS Build) y un `projectId` de Expo en `extra.eas.projectId`. Confirmar si el flujo funciona con builds locales. Si no funciona, el push queda fuera hasta decidirlo con el owner; la APK funciona igual (`registerPushToken` ya captura sus errores). El `google-services.json` no es secreto; la clave de cuenta de servicio sí y **no** se commitea.
- [ ] **Step 2: Despachar de nuevo el workflow** con la configuración de push, instalar la APK del artefacto en un teléfono Android real (permitir fuentes desconocidas) y entrar como despachador y como delivery.
- [ ] **Step 3: Checklist de push en el dispositivo:**
  1. Tras el login, existe una fila en la tabla de tokens de push para ese usuario (consulta a la base).
  2. Asignar una orden al delivery desde el despachador → llega la notificación `notifyDeliveryAssigned` y queda una fila `sent` en `push_logs`.
  3. Marcar una orden de prueba como `paid` desde el panel admin → llega al despachador la notificación de orden nueva (`notifyNewOrderInQueue`, Tasks 3–4) y la orden aparece en su cola.
- [ ] **Step 4: Anotar el resultado** (funciona / bloqueado y por qué) en `handoff.md`; limpiar las órdenes de prueba.
- [ ] **Step 5: Stage y commit sugerido**
  `git add apps/mobile/app.json apps/mobile/google-services.json handoff.md`
  Sugerido: `git commit -m "Configura FCM para el push de la APK y registra el resultado de la prueba real"`

---

### Task 9: Design system de las apps móviles (documento, tokens, tipografía, kit, marca y movimiento)

Funda el design system de las apps móviles, independiente del de la web (que no se toca): primero se documenta y el owner o el diseñador lo revisa, y recién entonces se implementa. Los componentes son presentacionales; la lógica y los datos viven en las pantallas.

**Files:**
- Create: `docs/design/mobile-design-system.md`
- Create: `apps/mobile/src/theme/tokens.ts` (+ `tokens.test.ts`), `contrast.ts` (+ `contrast.test.ts`), `typography.ts`, `motion.ts`
- Create: `apps/mobile/src/ui/{Button,Card,StatusPill,ScreenHeader,EmptyState,BrandMark,OfflineBanner}.tsx`, `apps/mobile/src/hooks/use-reduce-motion.ts`
- Create: `apps/mobile/src/ui/design-rules.test.ts`
- Modify: `apps/mobile/App.tsx` (carga de tipografías y `expo-splash-screen` retenido hasta que carguen), `apps/mobile/package.json` (`pnpm --filter mobile exec expo install expo-font expo-splash-screen expo-image @expo-google-fonts/fraunces @expo-google-fonts/dm-sans @expo-google-fonts/dm-mono`)
- Modify: `packages/i18n` (claves `staffApp` que necesiten los componentes, p. ej. el texto de accesibilidad de la mascota)

**Interfaces:**
- Produces (`tokens.ts`):
  ```ts
  export const colors: {
    red: "#E63946"; redDark: "#B82B36"; redLight: "#FF5C6A"; navy: "#0F1B3D"; navyMid: "#1A2F5F"; navyLight: "#253D78";
    gold: "#C9943A"; goldLight: "#F5D06B"; cream: "#F7F3EE"; creamDark: "#EDE7DC"; vanilla: "#FDFAF7"; abyss: "#080D1A";
    success: "#2F7D5B";
  };
  export const semantic: { background; surface; textPrimary; textMuted; border; actionFill; actionLabel; link; info; success; warning; danger }; // derivados de `colors`: background = cream, surface = vanilla, textPrimary = navy, actionFill = red, link = redDark, success = success, warning = gold, danger = redDark, info = navyLight; `textMuted` debe cumplir 4,5:1 sobre cream y vanilla (se valida en `textPairs`)
  export const radius: { pill: 100; card: 20; inner: 14; small: 8 };
  export const space: { xs: 4; sm: 8; md: 12; lg: 16; xl: 24; xxl: 32 };
  export const touch: { min: 48; primaryButton: 52 };
  export const textPairs: { fg: string; bg: string; size: "normal" | "large"; use: string }[]; // únicas combinaciones de texto permitidas
  ```
- Produces (`contrast.ts`): `contrastRatio(foreground: string, background: string): number` — fórmula WCAG 2.x sobre colores `#RRGGBB`.
- Produces (`typography.ts`): `fonts` (`display`, `displayBlack`, `displayItalic`, `body`, `bodyMedium`, `bodyBold`, `mono`, `monoMedium`: nombres exportados por los paquetes `@expo-google-fonts`, p. ej. `Fraunces_700Bold`; verificarlos en cada paquete) y `text` (`title` 24 sp Fraunces 700, `heading` 18, `body` 16 DM Sans, `bodyStrong`, `label` 11 sp DM Mono en mayúsculas con `letterSpacing` ≈ 0,2 em, `button` 18 sp DM Sans 700), con `lineHeight` explícito.
- Produces (`motion.ts`): `STAGGER_MS = 60`, `ENTER_MS = 400`, `easeOut` (de `Easing` de React Native).
- Produces (`use-reduce-motion.ts`): `useReduceMotion(): boolean` — `AccessibilityInfo.isReduceMotionEnabled()` y suscripción a `reduceMotionChanged`.
- Produces (kit):
  ```ts
  Button({ label: string; onPress: () => void; variant?: "primary" | "secondary" | "ghost"; loading?: boolean; disabled?: boolean; accessibilityHint?: string })
  // primary: relleno Sin Red, etiqueta ≥ 18 sp negrita, píldora, alto 52; secondary: contorno Navy, alto 48; ghost: texto Sin Red Dark, alto ≥ 48. Presionado: escala 0,98. loading: indicador y no tocable.
  Card({ index?: number; children })       // fondo Vanilla, radio 20, borde `semantic.border`; si hay `index`, entra con escalonado y `easeOut` salvo que `useReduceMotion()`
  StatusPill({ status: "received" | "in_prep" | "ready_for_pickup" | "out_for_delivery" | "delivered" | "cancelled" | "pending_sync" | "evidence_sent"; label: string })  // glifo + texto en DM Mono mayúsculas; color según `semantic`
  ScreenHeader({ title: string; actionLabel?: string; onAction?: () => void })  // mascota estática 32 dp a la izquierda, título Fraunces 700, acción ghost ≥ 48 dp
  EmptyState({ title: string; message: string })   // `BrandMark` animado de 96 dp + título y mensaje en Fraunces light italic
  BrandMark({ variant: "isotipo" | "videologo"; size: number; animated?: boolean; playOnceMs?: number })
  // `expo-image` con el GIF de `assets/brand/`; sin animación (usa `mascot.png`) si `animated` es falso, si `useReduceMotion()` o si la carga falla; con `playOnceMs` pasa a la imagen estática tras ese tiempo
  OfflineBanner({ visible: boolean; message: string })  // relleno Gold, texto Navy + glifo, desliza al entrar, `accessibilityLiveRegion="polite"`
  ```
  Todos con `accessibilityRole`/`accessibilityLabel` adecuados.

- [ ] **Step 0: Escribir `docs/design/mobile-design-system.md`** (apoyarse en la skill `design-system`) con: (1) principios (los 9 de la enmienda II del spec); (2) **tokens en tres capas**: base (tabla de colores con filas `| nombre | #RRGGBB |`, escala de espacio, radios, tamaños tocables, tipografías, tiempos de movimiento), semánticos (fondo, superficie, texto, acción, enlace, éxito, advertencia, peligro, información) y de componente (p. ej. fondo y etiqueta del botón primario por estado); (3) **especificación de cada componente del kit**: variantes, estados (normal, presionado, deshabilitado, cargando, error), medidas, contraste y accesibilidad; (4) **tabla de estados de orden y de sincronización**: estado → texto, glifo y color; (5) movimiento y reducción de movimiento; (6) voz de marca para vacíos, éxitos y errores; (7) uso de la identidad (mascota, GIF, cuándo cada uno). Los valores de partida se toman de la marca una sola vez; el documento es desde ese momento la única fuente de verdad del diseño mobile. **Detenerse y pedir la revisión del owner o del diseñador antes de implementar el kit.**
- [ ] **Step 1: Tests**:
  - `tokens.test.ts` — **coherencia documento ↔ código**: la tabla de tokens de color de `docs/design/mobile-design-system.md` (filas `| nombre | #RRGGBB |`) coincide con `colors` (mismos nombres y valores, sin distinguir mayúsculas). Es una verificación interna del design system mobile; no se compara con la web.
  - `contrast.test.ts` — `contrastRatio("#000000", "#FFFFFF")` ≈ 21; todo elemento de `textPairs` cumple ≥ 4,5 (`normal`) o ≥ 3 (`large`); además fija la prohibición: `contrastRatio(colors.red, colors.cream)` < 4,5 (por eso el rojo de texto sobre claro usa `redDark`) y `contrastRatio(colors.redDark, colors.cream)` ≥ 4,5. Pares mínimos en `textPairs`: Navy sobre Cream y sobre Vanilla; Sin Red Dark sobre Cream y sobre Vanilla; Vanilla sobre Sin Red (`large`); Vanilla sobre Sin Red Dark; Navy sobre Gold; Vanilla sobre `success`.
  - `design-rules.test.ts` — recorre `apps/mobile/src/screens/**/*.tsx` y falla si encuentra un color literal (`#RRGGBB`/`rgb(`) o `fontFamily:`: las pantallas solo usan tokens y el kit.
- [ ] **Step 2: Correr y ver fallar**
  Run: `pnpm --filter mobile run test`
  Expected: FAIL (módulos inexistentes).
- [ ] **Step 3: Implementar tokens, contraste, tipografía y movimiento; luego el kit y `use-reduce-motion.ts`; cargar las tipografías en `App.tsx` reteniendo el splash** (`SplashScreen.preventAutoHideAsync()` y ocultarlo al terminar la carga o si esta falla, para no dejar la app colgada en el splash). Leer en los docs de Expo v57 las APIs de `expo-image` (GIF animados), `expo-font` y `expo-splash-screen`.
- [ ] **Step 4: Verificar**
  Run: `pnpm --filter mobile run test && pnpm --filter mobile run typecheck && pnpm --filter mobile exec expo export --platform android`
  Expected: PASS y el bundle incluye tipografías y GIF. La revisión visual de los componentes se hace en la primera integración (Task 11) y en la Task 15.
- [ ] **Step 5: Stage y commit sugerido**
  `git add apps/mobile packages/i18n pnpm-lock.yaml`
  Sugerido: `git commit -m "Agrega el sistema de diseno mobile con tokens, tipografias y kit de componentes"`

---

### Task 10: Cola de comandos, clasificación de respuestas y detección de red (TS puro)

**Files:**
- Create: `apps/mobile/src/offline/command-queue.ts`, `command-queue.test.ts`
- Create: `apps/mobile/src/offline/deliver-sender.ts`, `deliver-sender.test.ts`
- Create: `apps/mobile/src/api/network.ts`, `network.test.ts`

**Interfaces:**
- Produces (`command-queue.ts`):
  ```ts
  export interface DeliverCommand { orderId: string; createdAt: number }
  export interface CommandStore {
    list(): Promise<DeliverCommand[]>; // ordenado por createdAt ascendente
    add(command: DeliverCommand): Promise<void>;
    remove(orderId: string): Promise<void>;
  }
  export type SendResult =
    | { kind: "ok" } | { kind: "retry" } | { kind: "unauthorized" } | { kind: "conflict"; reason: string };
  export interface FlushReport {
    synced: string[]; conflicts: { orderId: string; reason: string }[]; remaining: number; unauthorized: boolean;
  }
  export function enqueueDeliver(store: CommandStore, orderId: string, now?: () => number): Promise<DeliverCommand>;
  export function flushQueue(store: CommandStore, send: (command: DeliverCommand) => Promise<SendResult>): Promise<FlushReport>;
  ```
- Produces (`deliver-sender.ts`): `makeDeliverSender(fetchFn: (path: string, init: RequestInit) => Promise<Response>): (command: DeliverCommand) => Promise<SendResult>`
- Produces (`network.ts`): `isNetworkError(error: unknown): boolean`

- [ ] **Step 1: Tests** (con un `CommandStore` en memoria definido en el propio test):
  - `command-queue.test.ts`: `enqueueDeliver` dos veces sobre el mismo `orderId` deja un solo comando; `flushQueue` envía por `createdAt` y deja el store vacío; con A, B, C y `send` devolviendo `ok`, `retry` → `synced: ["A"]`, `remaining: 2`, C no se intentó, B y C siguen en orden; `conflict` elimina el comando, lo reporta con su `reason` y continúa; `unauthorized` detiene el vaciado, conserva el comando y devuelve `unauthorized: true`.
  - `deliver-sender.test.ts` (con `Response` falsas): 200 → `ok`; 401 → `unauthorized`; 409 con `{ error: "Cannot mark delivered from status: cancelled" }` → `conflict` con esa razón; 403 sin JSON → `conflict` con razón `"HTTP 403"`; 503 → `retry`; `fetchFn` que lanza `TypeError` → `retry`. Debe consultar `/api/mobile/orders/<orderId>/deliver` con `method: "PATCH"`.
  - `network.test.ts`: `isNetworkError(new TypeError("Network request failed"))` → `true`; `new Error("x")` → `false`; `"x"` → `false`.
- [ ] **Step 2: Correr y ver fallar**
  Run: `pnpm --filter mobile run test`
  Expected: FAIL.
- [ ] **Step 3: Implementar.** `flushQueue` recorre `store.list()` en orden y se detiene en el primer `retry` o `unauthorized`. `makeDeliverSender`: `res.ok` → `ok`; 401 → `unauthorized`; ≥ 500 → `retry`; otro estado → `conflict` con el `error` del JSON o `"HTTP <status>"`; excepción de red (`isNetworkError`) → `retry`; cualquier otra excepción se propaga.
- [ ] **Step 4: Verificar**
  Run: `pnpm --filter mobile run test && pnpm --filter mobile run typecheck`
  Expected: PASS.
- [ ] **Step 5: Stage y commit sugerido**
  `git add apps/mobile/src`
  Sugerido: `git commit -m "Agrega la cola de comandos offline y la clasificacion de respuestas para delivery"`

---

### Task 11: Persistencia SQLite y pantalla de delivery offline (primera integración del diseño)

**Files:**
- Create: `apps/mobile/src/offline/db.ts`, `sqlite-command-store.ts`, `assigned-cache.ts`
- Create: `apps/mobile/src/hooks/use-polling.ts`
- Modify: `apps/mobile/src/screens/DeliveryQueueScreen.tsx` (reescritura completa con el kit de la Task 9)
- Modify: `packages/i18n/src/{types,dictionaries/en,dictionaries/es}.ts` (claves `staffApp.*` que use la pantalla: banner de sin conexión, "pendiente de sincronizar", "guardada, se enviará al volver la red", "sesión vencida", título de conflicto, etiquetas de teléfono y dirección, "navegar", "llamar", "salir", estado vacío; reutilizar `dispatch.deliveryEmpty` y `dispatch.markDeliveredButton`)

**Interfaces:**
- Consumes: `CommandStore`, `enqueueDeliver`, `flushQueue`, `makeDeliverSender` (Task 10); `apiFetch`, `isNetworkError`; `useAuth().logout`; `strings` (Task 5); `ScreenHeader`, `Card`, `StatusPill`, `Button`, `EmptyState`, `OfflineBanner`, `BrandMark`, tokens y `text` (Task 9).
- Produces:
  ```ts
  // db.ts — base "sweetsin.db"; crea deliver_commands(order_id TEXT PRIMARY KEY, created_at INTEGER)
  //         y assigned_orders(order_id TEXT PRIMARY KEY, payload TEXT NOT NULL) si no existen
  export function getDb(): Promise<import("expo-sqlite").SQLiteDatabase>;
  // sqlite-command-store.ts
  export const sqliteCommandStore: CommandStore;
  // assigned-cache.ts
  export type AssignedOrder = {
    id: string; customerName: string; customerPhone: string; deliveryAddress: string | null;
    deliveryEvidenceKey?: string | null;
  };
  export function replaceAssigned(orders: AssignedOrder[]): Promise<void>;
  export function loadAssigned(): Promise<AssignedOrder[]>;
  export function clearAssigned(): Promise<void>;
  // use-polling.ts — ejecuta callback al montar, cuando AppState pasa a "active" y cada intervalMs; limpia al desmontar
  export function usePolling(callback: () => void | Promise<void>, intervalMs: number): void;
  ```

`expo-sqlite` no corre en Node: estas piezas no tienen test unitario (la lógica que importa está en Task 10); se verifican con typecheck y en dispositivo (Task 15).

- [ ] **Step 1: Implementar `db.ts`, `sqlite-command-store.ts`, `assigned-cache.ts`** (leer la API de `expo-sqlite` en los docs de v57).
- [ ] **Step 2: Implementar `use-polling.ts`.**
- [ ] **Step 3: Reescribir `DeliveryQueueScreen`**. Comportamiento:
  - `refresh()`: `flushQueue(sqliteCommandStore, makeDeliverSender(apiFetch))`, luego `GET /api/mobile/orders/assigned`. Si responde bien → `replaceAssigned` y `offline = false`; si falla con `isNetworkError` → `loadAssigned()` y `offline = true`.
  - `deliver(orderId)`: `enqueueDeliver` y luego `refresh()` (un único camino con o sin red).
  - Cada conflicto de `FlushReport` se muestra con `Alert.alert` (título + dirección + razón); `unauthorized` muestra el aviso de sesión vencida.
  - `usePolling(refresh, 30_000)` y pull-to-refresh.
  - "Salir": `clearAssigned()` y luego `logout()` (sin diálogo de confirmación: ver "Decisiones registradas").
- [ ] **Step 4: Diseño y UX de la pantalla** (criterios de calidad de UI):
  - `ScreenHeader` con título y acción "Salir"; `OfflineBanner` visible cuando `offline`.
  - Una `Card` por orden con entrada escalonada (`index`): nombre del cliente en `text.heading`; dirección en `text.title` como elemento tocable que abre la navegación (`Linking.openURL("geo:0,0?q=" + encodeURIComponent(dirección))`) y teléfono tocable que llama (`tel:`); ambos con el mínimo de 48 dp y con `try/catch` que muestra un aviso si el teléfono no puede abrirlos (sin `canOpenURL`, que en Android 11+ exige declarar `<queries>`).
  - `StatusPill` con `out_for_delivery`; si hay comando en cola, `pending_sync` en vez del botón de entrega, más un texto "guardada, se enviará al volver la red" (distinto de una entrega ya registrada).
  - Acción primaria `Button` "Marcar entregado" a todo el ancho, abajo en la tarjeta.
  - Estados: **cargando** (`BrandMark` pequeño sin animar y texto) en la primera carga sin caché; **vacío** con `EmptyState` (mascota animada, voz de marca ligera, p. ej. "Nada por entregar. Ni un pecado pendiente."); **error de red** con el banner y la caché; **error del servidor** con mensaje claro y reintento; `RefreshControl` con `colors={[colors.red]}`.
  - Los textos nuevos pasan por `packages/i18n` (en ambos idiomas, con la voz de marca solo en vacío/éxito).
- [ ] **Step 5: Primera revisión visual en dispositivo** (aquí se ve por primera vez el kit integrado): despachar el workflow, instalar el APK y revisar los criterios 1–9 de "Criterios de calidad de UI" sobre esta pantalla; anotar los ajustes de tokens/componentes para aplicarlos en esta misma tarea antes de seguir.
- [ ] **Step 6: Verificar**
  Run: `pnpm --filter mobile run typecheck && pnpm --filter mobile run test && pnpm --filter @workspace/i18n exec vitest run`
  Expected: PASS (incluye `design-rules.test.ts`: la pantalla no usa colores ni fuentes literales).
- [ ] **Step 7: Stage y commit sugerido**
  `git add apps/mobile/src packages/i18n`
  Sugerido: `git commit -m "Agrega cache SQLite y cola de entregas offline con el nuevo diseno a la pantalla de delivery"`

---

### Task 12: Evidencia de entrega — servidor (dominio, esquema, R2 y endpoints)

**Files:**
- Modify: `packages/db/src/schema/orders.ts` (columnas nullable: `delivery_evidence_key text`, `delivery_evidence_captured_at timestamptz`, `delivery_evidence_lat double precision`, `delivery_evidence_lng double precision`), `packages/db/src/schema/settings.ts` (`delivery_evidence_required boolean not null default false`)
- Modify: `packages/domain/src/orders/entities.ts` (campos opcionales y nulables en `Order`: `deliveryEvidenceKey?`, `deliveryEvidenceCapturedAt?`, `deliveryEvidenceLat?`, `deliveryEvidenceLng?` — opcionales para no tocar todos los literales de `Order`; el repositorio los entrega vía el spread de la fila), `ports.ts` (`recordDeliveryEvidence` en `OrderRepository` + puerto `DeliveryEvidenceStorage`), `use-cases.ts` (+ tests)
- Modify: `packages/domain/src/settings/entities.ts` (`AppSettings.deliveryEvidenceRequired: boolean`), `packages/db/src/repositories/settings-repository.ts` (+ su test), `packages/db/src/repositories/order-repository.ts` (+ su test)
- Create: `apps/web/src/infra/r2-delivery-evidence-storage.ts` (+ test), `apps/web/src/lib/delivery-evidence-key.ts` (+ test)
- Create: `apps/web/src/app/api/mobile/orders/[id]/evidence/upload-url/route.ts`, `.../evidence/route.ts` (+ tests)
- Modify: `apps/web/src/app/api/mobile/orders/assigned/route.ts` (la respuesta agrega `deliveryEvidenceRequired` leído de `DrizzleSettingsRepository`)
- Modify: `apps/web/package.json` (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`), `CLAUDE.md` (Run & Operate: variables R2)

**Interfaces:**
- Produces:
  ```ts
  // dominio
  export interface DeliveryEvidence { key: string; capturedAt: Date; lat: number; lng: number }
  OrderRepository.recordDeliveryEvidence(orderId: string, evidence: DeliveryEvidence): Promise<void>;
  recordDeliveryEvidence(deps: { orders: OrderRepository }, orderId: string, actingUserId: string, evidence: DeliveryEvidence): Promise<void>;
  // rechaza: orden inexistente; actingUserId ≠ assignedDeliveryUserId; estado distinto de out_for_delivery/delivered;
  //          lat fuera de [-90, 90]; lng fuera de [-180, 180]; key vacía
  export interface DeliveryEvidenceStorage { createUploadUrl(key: string, contentType: "image/jpeg"): Promise<string> }
  // apps/web/src/lib/delivery-evidence-key.ts
  export function buildEvidenceKey(prefix: string, orderId: string, uniqueId: string): string; // `${prefix}${orderId}/${uniqueId}.jpg`
  export function isEvidenceKeyForOrder(key: string, prefix: string, orderId: string): boolean;
  // apps/web/src/infra/r2-delivery-evidence-storage.ts
  export class EvidenceStorageNotConfiguredError extends Error {}
  export class R2DeliveryEvidenceStorage implements DeliveryEvidenceStorage {} // valida las variables al usarse (no al importar), URL prefirmada PUT de 5 min
  ```
  Endpoints (rol `delivery`; 403 otro rol; 503 `{ error: "Delivery evidence storage is not configured yet." }` si faltan variables R2):
  - `POST .../evidence/upload-url` body `{ contentType: "image/jpeg" }` → `200 { uploadUrl, key }` | `409` si la orden no es del usuario o no está en estado válido.
  - `POST .../evidence` body `{ key, capturedAt (ISO), lat, lng }` → `200 { ok: true }` | `400` | `409` (incluye `key` que no pertenece a esa orden).
  - Variables de entorno (servidor, no `NEXT_PUBLIC_*`): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_DELIVERY_EVIDENCE_PREFIX` (default `delivery-evidence/`; permite pasar a otro bucket o carpeta sin tocar código).

- [ ] **Step 1 (owner, manual): proveer las credenciales de R2** (token de API con acceso a ese bucket) en `apps/web/.env.local` y en las variables de runtime del servicio en EasyPanel. El bucket debe ser **privado**. Sin ellas, los endpoints responden 503 y todo lo demás sigue funcionando.
- [ ] **Step 2: Tests de dominio** (`recordDeliveryEvidence`): registra con usuario asignado en `out_for_delivery` y en `delivered`; rechaza usuario no asignado, estado `ready_for_pickup`, `lat` 91, `lng` -181, `key` vacía, orden inexistente. Extender `makeFakeOrderRepo` y todo implementador de `OrderRepository` con el método nuevo.
- [ ] **Step 3: Tests de `delivery-evidence-key`**: `buildEvidenceKey("delivery-evidence/", "o1", "u1") === "delivery-evidence/o1/u1.jpg"`; `isEvidenceKeyForOrder` es `true` para esa clave con `"o1"` y `false` con `"o2"` o con un prefijo distinto.
- [ ] **Step 4: Tests del adaptador y de los endpoints**: sin variables R2 el adaptador lanza `EvidenceStorageNotConfiguredError` y el endpoint responde 503; con `requireMobileAuth` mockeado devolviendo rol `despachador` ambos endpoints responden 403; `POST .../evidence` con una `key` de otra orden responde 409.
- [ ] **Step 5: Correr y ver fallar**
  Run: `pnpm --filter @workspace/domain exec vitest run src/orders && pnpm --filter @workspace/web exec vitest run src/lib src/infra src/app/api/mobile/orders`
  Expected: FAIL.
- [ ] **Step 6: Implementar** todo lo listado. `recordDeliveryEvidence` en Drizzle hace un `update` de las cuatro columnas. En el adaptador R2: endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, región `"auto"`; dejar en un comentario la política de retención (7 días por defecto, ampliable a 30, pendiente de confirmación legal; la regla de ciclo de vida del bucket es una tarea de infraestructura aparte).
- [ ] **Step 7: Aplicar el esquema a la base compartida** — pedir OK al owner (dev=prod) y correr `pnpm --filter @workspace/db run push`. Las columnas son nullable y el booleano tiene default: aditivo.
- [ ] **Step 8: Verificar**
  Run: `pnpm run typecheck && pnpm run test`
  Expected: PASS (los tests de `packages/db` golpean la base real: limpiar lo que creen).
- [ ] **Step 9: Stage y commit sugerido**
  `git add packages apps/web pnpm-lock.yaml CLAUDE.md`
  Sugerido: `git commit -m "Agrega el registro de evidencia de entrega con subida a R2 mediante URL prefirmada"`

---

### Task 13: Evidencia de entrega — app (foto + GPS)

**Files:**
- Modify: `apps/mobile/package.json` (`pnpm --filter mobile exec expo install expo-image-picker expo-location`)
- Create: `apps/mobile/src/evidence/evidence-upload.ts`, `evidence-upload.test.ts`, `capture-evidence.ts`
- Modify: `apps/mobile/src/screens/DeliveryQueueScreen.tsx`, `apps/mobile/src/offline/assigned-cache.ts` (si hace falta el campo), `packages/i18n` (claves `staffApp`: botón de agregar foto, subiendo, evidencia enviada, fallo de subida, permiso de cámara denegado, permiso de ubicación denegado)

**Interfaces:**
- Consumes: endpoints de Task 12; `strings`; `apiFetch`.
- Produces:
  ```ts
  // evidence-upload.ts (puro, con dependencias inyectadas)
  export type EvidenceStage = "upload-url" | "upload" | "record";
  export type EvidenceResult = { ok: true } | { ok: false; stage: EvidenceStage };
  export function runEvidenceUpload(
    deps: {
      requestUploadUrl(orderId: string): Promise<{ uploadUrl: string; key: string }>;
      putFile(uploadUrl: string, fileUri: string): Promise<void>;
      recordEvidence(orderId: string, evidence: { key: string; capturedAt: string; lat: number; lng: number }): Promise<void>;
    },
    input: { orderId: string; fileUri: string; capturedAt: string; lat: number; lng: number },
  ): Promise<EvidenceResult>;
  // capture-evidence.ts (dispositivo; sin test unitario)
  export type CaptureResult =
    | { ok: true; fileUri: string; capturedAt: string; lat: number; lng: number }
    | { ok: false; reason: "camera-denied" | "location-denied" | "cancelled" | "location-unavailable" };
  export function captureEvidence(): Promise<CaptureResult>; // pide permisos recién al invocarse (nunca al abrir la app)
  ```

- [ ] **Step 1: Tests de `runEvidenceUpload`** (dependencias falsas): camino feliz llama a las tres en orden y devuelve `{ ok: true }`; si `requestUploadUrl` rechaza → `{ ok: false, stage: "upload-url" }` y no se llama a las demás; si `putFile` rechaza → `stage: "upload"` y no se llama a `recordEvidence`; si `recordEvidence` rechaza → `stage: "record"`.
- [ ] **Step 2: Correr y ver fallar**
  Run: `pnpm --filter mobile run test`
  Expected: FAIL.
- [ ] **Step 3: Implementar `runEvidenceUpload`**, `captureEvidence` (`expo-image-picker` con `launchCameraAsync({ quality: 0.6 })` y `expo-location` con `getCurrentPositionAsync`, ambos pidiendo permiso en el momento) y el cableado de red de `deps` (`apiFetch` para los dos endpoints; PUT directo a la URL prefirmada con `Content-Type: image/jpeg`).
- [ ] **Step 4: Integrar en `DeliveryQueueScreen` con el kit de diseño**: encima de "Marcar entregado", un `Button variant="secondary"` "Agregar foto de evidencia" **opcional** (con `loading` mientras captura y sube); `StatusPill status="evidence_sent"` cuando existe `deliveryEvidenceKey` o tras subir con éxito. Cualquier fallo (permiso, sin red, endpoint) muestra un `Alert` con texto i18n neutro y claro y **no** bloquea "Marcar entregado"; si el permiso de cámara o de ubicación está denegado, el aviso ofrece "Abrir ajustes" (`Linking.openSettings()`). Los permisos se piden en el momento de tocar el botón, con una línea previa que explica para qué se usan. Leer `deliveryEvidenceRequired` de la respuesta de `assigned` y dejar en `deliver()` el punto de extensión inactivo:
  ```ts
  if (evidenceRequired && !order.deliveryEvidenceKey) {
    // PUNTO DE EXTENSIÓN: cuando se active la evidencia obligatoria, bloquear aquí (hoy no se bloquea).
  }
  ```
- [ ] **Step 5: Verificar**
  Run: `pnpm --filter mobile run test && pnpm --filter mobile run typecheck && pnpm --filter @workspace/i18n exec vitest run`
  Expected: PASS. La captura real (cámara/GPS) se comprueba en dispositivo en Task 15.
- [ ] **Step 6: Stage y commit sugerido**
  `git add apps/mobile packages/i18n pnpm-lock.yaml`
  Sugerido: `git commit -m "Agrega captura de foto y GPS como evidencia opcional de entrega en la app"`

---

### Task 14: Despachador e inicio de sesión con el sistema de diseño; despachador sin crash sin red

**Files:**
- Modify: `apps/mobile/src/screens/DespachadorQueueScreen.tsx`, `apps/mobile/src/screens/LoginScreen.tsx` (reconstrucción con el kit)
- Modify: `packages/i18n` (claves `staffApp` nuevas: login, aviso al fallar una acción sin red, estado vacío del despachador; reutilizar `dispatch.queueEmpty`, `dispatch.markInPrepButton`, `dispatch.markReadyButton`, `dispatch.assignDeliveryLabel`, `dispatch.assignDeliveryButton` y `dispatch.assignDeliveryPlaceholder` que ya existen)

**Interfaces:**
- Consumes: `isNetworkError`, `usePolling`, `strings`; kit y tokens de la Task 9.

- [ ] **Step 1: Comportamiento del despachador** — `loadQueue` y `loadDeliveryStaff` capturan errores: con `isNetworkError` ponen `offline = true` (y `false` al recibir respuesta); `advance` y `assign` ante error de red muestran `Alert.alert` con los textos i18n nuevos y no recargan la cola. Reemplazar el `useEffect` inicial por `usePolling(…, 30_000)`. Los comandos del despachador **no** se encolan.
- [ ] **Step 2: Diseño del despachador** — `ScreenHeader` y `OfflineBanner`; una `Card` por orden con entrada escalonada: nombre, `StatusPill` (`received`, `in_prep`, `ready_for_pickup`) y la acción primaria del estado (`Button` a todo el ancho: "Iniciar preparación" / "Marcar lista para retiro"). En `ready_for_pickup`, la asignación de repartidor como lista de chips/filas tocables de ≥ 48 dp (no una columna de botones sueltos) y un estado explícito "no hay repartidores activos". Estados: cargando, vacío (`EmptyState` con voz de marca ligera), error de red, error del servidor con reintento. Todo con tokens y textos de `packages/i18n`.
- [ ] **Step 3: Inicio de sesión** — `BrandMark variant="videologo"` (≈ 160 dp) que se reproduce un ciclo (≈ 8 s) y pasa a la imagen estática (`playOnceMs`); título en `text.title`; campos con etiqueta visible encima, alto 52 dp, radio `inner`, borde `semantic.border` y foco en Sin Red; `KeyboardAvoidingView` y desplazamiento para que el teclado no tape el botón; correo con `keyboardType="email-address"` y `autoComplete="email"`; PIN numérico (`inputMode="numeric"`, `secureTextEntry`, `maxLength` 6); enviar con la tecla del teclado; `Button` primario con `loading`; error en línea con `accessibilityRole="alert"` y texto neutro (usa la clave de error ya existente, ahora en i18n); el correo se conserva si el login falla.
- [ ] **Step 4: Verificar**
  Run: `pnpm --filter mobile run typecheck && pnpm --filter mobile run test && pnpm --filter @workspace/i18n exec vitest run`
  Expected: PASS (incluye `design-rules.test.ts` sobre las tres pantallas). El comportamiento sin red y la revisión visual se comprueban en dispositivo (Task 15).
- [ ] **Step 5: Stage y commit sugerido**
  `git add apps/mobile/src packages/i18n`
  Sugerido: `git commit -m "Reconstruye el despachador y el inicio de sesion con el sistema de diseno y evita el crash sin red"`

---

### Task 15: Verificación en dispositivo y documentación

**Files:**
- Modify: `handoff.md` (5 secciones; agregar a "Intentos fallidos", no borrar; registrar retención de evidencia y las decisiones de arriba), `CLAUDE.md` (Where things live / Run & Operate: build de la APK por GitHub Actions y sus secretos, modo offline del delivery, evidencia de entrega, flag `deliveryEvidenceRequired`; quitar de Architecture decisions la nota de `notifyNewOrderInQueue` sin caller y de Gotchas la costura de `/admin/orders`, ya resueltas en Tasks 3–4)

- [ ] **Step 1: Despachar el workflow con el código final**, bajar la APK del artefacto e instalarla en un teléfono Android real.
- [ ] **Step 2: Checklist en dispositivo** (el push ya se validó en Task 8):
  1. Login con PIN como despachador y como delivery.
  2. Despachador: avanzar una orden y asignar delivery.
  3. Delivery en modo avión: la lista sigue visible desde la caché con el banner; marcar entregada → "pendiente de sincronizar".
  4. Desactivar modo avión: en ≤ 30 s la orden pasa a `delivered` en la base (consulta directa), sin duplicados.
  5. Despachador en modo avión: abrir/recargar no cierra la app y se ve el banner; avanzar una orden muestra el aviso.
  6. Evidencia con red: tomar foto → "evidencia enviada"; el objeto existe en R2 bajo `<prefijo>/<orderId>/`, la fila de la orden tiene clave, fecha y coordenadas.
  7. Evidencia sin red o con permiso denegado: aviso claro y "Entregar" sigue funcionando.
  8. Cambiar el idioma del teléfono entre español e inglés y reabrir la app: los textos cambian.
- [ ] **Step 3: Revisión de calidad visual y de usabilidad en el teléfono** (los criterios 1–9 de "Criterios de calidad de UI", sobre inicio de sesión, delivery y despachador):
  1. **Identidad:** el ícono en el lanzador (normal y redondo; temático si el teléfono es Android 13+), el splash, el ícono de la notificación en la barra (silueta con el rojo de marca, no un cuadrado gris) y el nombre "Sweet Sin Staff".
  2. **Tipografía:** Fraunces, DM Sans y DM Mono se ven (no las del sistema) y la app abre sin red con ellas.
  3. **Escala de fuente** (Ajustes → Pantalla → Tamaño de fuente) al 100 %, 130 % y 200 %: nada se corta ni se solapa y los botones siguen alcanzables.
  4. **Reducir movimiento** (Ajustes → Accesibilidad → Quitar animaciones): sin entradas animadas y los GIF reemplazados por la mascota estática.
  5. **Accessibility Scanner de Google** (aplicación gratuita) sobre cada pantalla: sin avisos de tamaño de área tocable ni de contraste.
  6. **Pleno sol:** brillo máximo en exteriores; el texto y los estados se leen.
  7. **Una mano:** las acciones primarias se alcanzan con el pulgar sin cambiar de agarre.
  8. **Capturas de cada estado** (`adb exec-out screencap -p > estado.png`: en línea, sin conexión, pendiente de sincronizar, vacío, error, evidencia enviada) contrastadas con los criterios; opcionalmente, una revisión con las skills de diseño disponibles (`impeccable` o `ui-ux-pro-max`) sobre esas capturas y el código de `src/ui/`.
  9. **Fluidez:** desplazamiento sin saltos con 20 órdenes de prueba; los GIF no deben notarse en la fluidez ni en el calor del teléfono.
  Los ajustes que salgan de esta revisión se corrigen en `theme/` o `ui/` (una sola vez, para todas las pantallas), no pantalla por pantalla.
- [ ] **Step 4: Limpiar los datos de prueba** (órdenes, filas de push, objetos de evidencia) de la base y del bucket.
- [ ] **Step 5: Actualizar `handoff.md` y `CLAUDE.md`** (incluye: el design system mobile —`docs/design/mobile-design-system.md`, tokens y kit— y su independencia del de la web, el script de íconos y la fuente de la mascota, y la pregunta pendiente sobre el build de desarrollo).
- [ ] **Step 6: Stage y commit sugerido**
  `git add handoff.md CLAUDE.md apps/mobile`
  Sugerido: `git commit -m "Documenta la APK de staff, su sistema de diseno, el modo offline y la evidencia de entrega"`

---

## Self-review

- **Cobertura del spec y de los 8 cambios pedidos:** (1) confirmación del cliente → "Decisiones registradas", sin cambios de esquema; (2) evidencia → Tasks 12–13, con flag en `settings`, punto de extensión inactivo y retención documentada; (3) reclamos → "Fuera de alcance"; (4) push adelantado → Task 8, justo después del build; (5) `updateOrderStatusAction` → Task 4, con test que hoy falla; (6) i18n → Task 5 y Global Constraints; (7) `notifyNewOrderInQueue` → Task 3 (más la corrección de que ninguna ruta movía la orden a `received`); (8) sin guard de logout → "Decisiones registradas" y Task 11 sin diálogo.
- **Diseño UI/UX (enmienda II del spec):** identidad e íconos → Task 6; tokens, tipografía, kit, marca animada y movimiento → Task 9; pantallas con estados completos y acciones nativas → Tasks 11, 13 y 14; criterios de calidad verificados en dispositivo → Task 15. Lo enforzable por test está en la Task 9 (coherencia entre el documento del design system mobile y los tokens, contraste, sin colores/fuentes literales en `screens/`) y en la Task 6 (los íconos monocromos son siluetas, no cuadrados llenos).
- **Hallazgos nuevos respecto del pedido:** no hay cliente R2 en el repo (se resuelve con URL prefirmada y credenciales de servidor); `confirmOrderPayment` nunca llevaba la orden a `received`; marcar `paid` desde el admin se salteaba stock, cola y push. Los tres están en "Decisiones que necesitan tu confirmación".
- **Consistencia de tipos:** `DeliverCommand`, `CommandStore`, `SendResult`, `FlushReport`, `AssignedOrder`, `DeliveryEvidence`, `EvidenceResult` y `strings` se definen una vez y se usan con los mismos nombres en tareas posteriores. `createStaffNotifications` (Task 3) se reusa en Task 4.
- **Proporción:** tareas con firmas y tests nombrados; solo `flushQueue`, `makeDeliverSender` y la tabla de transiciones llevan reglas explícitas porque las firmas no las determinan.
