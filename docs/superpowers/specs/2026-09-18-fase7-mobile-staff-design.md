# Fase 7 — Apps de despachador/delivery (Expo) + gestión de staff

**Fecha:** 2026-09-18
**Estado:** Aprobado para pasar a plan de implementación

## Contexto y objetivo

Hasta Fase 6, el ciclo de vida de una orden (`payment_status`, `fulfillment_status`) se gestiona
únicamente desde `/admin/orders` en `apps/web`. La Fase 7 agrega dos superficies nuevas para el
staff operativo (roles `despachador` y `delivery`, ya definidos en el enum `user_role`):

- **`apps/mobile`** (Expo): app nativa para trabajar desde el celular durante el turno.
- **`/dispatch` y `/delivery`** (nuevas secciones web en `apps/web`): mismo flujo, accesible desde
  navegador, con su propio login.

Ambas superficies son adaptadores de entrada distintos sobre el mismo núcleo hexagonal
(`packages/domain`) — no se duplica lógica de negocio, solo el transporte (REST+JWT vs
Server Actions+cookie de sesión).

## Alcance funcional

- **Despachador:** ve la cola de órdenes `payment_status=paid` + `fulfillment_status` en
  `received`/`in_prep`, las mueve a `in_prep` → `ready_for_pickup`, y asigna qué `delivery`
  se hace cargo de cada una.
- **Delivery:** ve las órdenes que tiene asignadas en `out_for_delivery`, las marca `delivered`.
- **Notificaciones push** (Expo) cuando entra una orden nueva a la cola o se le asigna una entrega
  a un delivery.
- **Gestión de staff:** un admin crea/edita despachadores y deliveries, y genera/resetea su PIN,
  desde `/admin/staff`.

Fuera de alcance (explícitamente diferido): Play Integrity/DeviceCheck reales, tests automatizados
de `apps/mobile`, courier/Uber Direct (ya fuera de alcance del proyecto entero).

## Arquitectura

Un solo backend: `apps/web` expone Route Handlers REST bajo `app/api/mobile/**` para el cliente
Expo, y Server Actions nuevas para `/dispatch`/`/delivery` — ambos adaptadores llaman a los mismos
casos de uso de `packages/domain`. Se descarta un backend HTTP separado: contradice la decisión
congelada de Fase 1 de eliminar `apps/api`/Express y suma un deploy sin necesidad real.

## 1. Dominio (`packages/domain`)

Casos de uso nuevos, TypeScript puro, sin dependencias de framework/DB:

- `authenticateStaffByPin(email, pin)` — verifica `pinHash` (bcrypt/argon2); rechaza si
  `isActive=false`, si el rol no es `despachador`/`delivery`, o si hay lockout activo
  (`pinLockedUntil > now()`). Incrementa `failedPinAttempts` en cada intento fallido y aplica
  lockout tras N intentos; resetea el contador en login exitoso.
- `assignDeliveryToOrder(orderId, deliveryUserId)` — solo válido si
  `fulfillmentStatus === "ready_for_pickup"`; setea `assignedDeliveryUserId` y pasa la orden a
  `out_for_delivery`.
- `markOrderInPrep(orderId, actingUserId)`, `markOrderReady(orderId, actingUserId)`,
  `markOrderDelivered(orderId, actingUserId)` — transiciones de `fulfillment_status` con guard de
  rol/ownership en el propio caso de uso (no solo en la UI):
  - Solo `despachador` mueve `received → in_prep → ready_for_pickup`.
  - Solo el `delivery` asignado (`assignedDeliveryUserId === actingUserId`) mueve
    `out_for_delivery → delivered`.

## 2. Base de datos (`packages/db`)

Cambios de schema (Drizzle):

- `orders.assignedDeliveryUserId` — `uuid` nullable, FK a `users.id`, indexado (consulta "mis
  asignadas" del delivery).
- `users.failedPinAttempts` — `integer not null default 0`.
- `users.pinLockedUntil` — `timestamp` nullable.
- `push_tokens` — tabla nueva: `userId` (FK), `token`, `updatedAt`. Un token vigente por usuario
  (se sobreescribe en cada registro, no se acumulan históricos).
- `notification_logs` — generaliza el actual `email_logs` de Fase 6 agregando `channel: "email" |
  "push"`, para no duplicar tabla ni lógica de logging entre canales.

Repositorios: extender `OrderRepository` con `findQueueForDespachador()`,
`findAssignedToDelivery(userId)`, y los setters de transición/asignación. Extender
`UserRepository` con el lookup de staff por email y el update de PIN/lock/lockout.

Sin cambios en `seed.ts` — la creación de staff con PIN es responsabilidad exclusiva del panel
admin (Sección 7), no del seed.

## 3. API mobile (`apps/web/src/app/api/mobile/**`)

Route Handlers REST, runtime Node.js (no edge — dependen de `pg`/Drizzle):

- `POST /api/mobile/auth/login` — body `{ email, pin }` + header `X-App-Signature` (HMAC de
  build). Verifica la firma primero (401 inmediato si no matchea, sin tocar DB), luego llama a
  `authenticateStaffByPin`. Devuelve JWT corto (TTL ~12h) firmado con `MOBILE_JWT_SECRET` (secreto
  propio, distinto del de Auth.js) + `role`.
- `GET /api/mobile/auth/me` — valida el JWT actual y re-consulta `isActive` (mismo patrón de
  revocación que el callback `jwt` de Auth.js); usado al abrir la app para decidir si la sesión
  sigue viva.
- `requireMobileAuth(req)` — middleware compartido: valida JWT del header
  `Authorization: Bearer`, re-consulta `isActive`, adjunta `{ userId, role }`.
- `GET /api/mobile/orders/queue` — solo `despachador`.
- `PATCH /api/mobile/orders/:id/status` — solo `despachador`, body
  `{ status: "in_prep" | "ready_for_pickup" }`.
- `PATCH /api/mobile/orders/:id/assign` — solo `despachador`, body `{ deliveryUserId }`.
- `GET /api/mobile/orders/assigned` — solo `delivery`.
- `PATCH /api/mobile/orders/:id/deliver` — solo `delivery`, valida ownership.
- `POST /api/mobile/push-token` — registra/actualiza el Expo push token del usuario autenticado.

Todos los handlers son adaptadores delgados: validan con Zod, delegan al caso de uso de dominio,
mapean errores de dominio a status HTTP (403/404/409).

## 4. `apps/mobile` (Expo)

- Expo managed workflow (sin código nativo custom — `expo-notifications` cubre push).
- React Navigation para el flujo login → home por rol.
- `expo-secure-store` para el JWT (nunca `AsyncStorage` plano).
- HMAC de build: secreto embebido en build (`EXPO_PUBLIC_APP_SECRET`), firma
  `method+path+timestamp` por request con HMAC-SHA256. Es un filtro de tráfico no-oficial, no
  seguridad criptográfica fuerte — el rate limiting server-side (Sección 1/2) es la defensa real
  contra brute-force del PIN.
- Pantallas: `Login` (email + teclado numérico de PIN), `DespachadorQueue` (cola + transición de
  estado + asignar repartidor), `DeliveryQueue` (asignadas a mí + marcar entregado).
- Al abrir la app, si hay JWT guardado se valida contra `GET /api/mobile/auth/me`; si vuelve 401,
  redirige a `Login`.
- i18n: adaptador nativo simple sobre `packages/i18n` (hook `useT(locale)` leyendo los
  diccionarios planos), sin `next-intl`.

## 5. Notificaciones push (`packages/notifications`)

- `ExpoNotificationAdapter` implementa el mismo `NotificationPort` que ya usa SMTP — mismo
  contrato (`{ to, templateKey, data }`), transporte distinto (`expo-server-sdk` contra
  `exp.host`, usando el token de `push_tokens`).
- Disparo: los mismos casos de uso de dominio que cambian `fulfillment_status` llaman al puerto de
  notificación como side-effect — al entrar a `received` se notifica a los `despachador` activos
  con push token; al asignar delivery, se notifica a ese `delivery`. Igual que en Fase 6, un fallo
  de notificación nunca bloquea la persistencia de la orden, y queda registrado en
  `notification_logs` (`channel: "push"`).
- Sin credenciales de terceros nuevas — Expo Push no requiere API key para apps Expo estándar.

## 6. Testing

- `packages/domain` (Vitest, obligatorio): `authenticateStaffByPin` (PIN correcto/incorrecto,
  lockout, rechazo por `isActive`/rol), transiciones de estado por rol/ownership,
  `assignDeliveryToOrder` (rechaza si no está `ready_for_pickup`).
- `packages/db` (Vitest contra Postgres real): repositorios nuevos (`findQueueForDespachador`,
  `findAssignedToDelivery`, lock/unlock de PIN).
- API mobile: tests de integración de los Route Handlers (sin HMAC → 401, JWT vencido → 401, rol
  incorrecto → 403).
- `apps/mobile`: sin test runner nuevo (YAGNI) — verificación manual con Expo Go contra el backend
  de dev.

## 7. Gestión de staff (`/admin/staff`)

- Protegida con `requireAdmin()` (solo `role=admin`, sin acceso para despachador/delivery).
- CRUD: listar despachadores/deliveries, crear (nombre, email, rol, password para su login web),
  botón "generar PIN" (PIN de 6 dígitos aleatorio, se hashea, se muestra una sola vez en pantalla —
  nunca se re-muestra en texto plano después), botón "resetear PIN", toggle `isActive` (reusa el
  patrón de revocación existente).
- Reusa componentes de tabla/formulario ya existentes en `/admin` (Fase 4/5).

## 8. Credenciales web para staff (`/dispatch`, `/delivery`)

- Login propio con email+password (mismo Credentials provider de Auth.js que ya usa `/admin`,
  mismo `passwordHash`) — **no** el PIN, que queda exclusivo del cliente mobile.
- Vistas nuevas y separadas de `/admin/orders` (no se extiende esa sección con guards de rol):
  `/dispatch` para despachador, `/delivery` para delivery, cada una con su propia Server Action
  que llama a los mismos casos de uso de dominio de la Sección 1.

## Variables de entorno nuevas

- `MOBILE_JWT_SECRET` (`apps/web/.env.local`) — firma de JWT de sesión mobile.
- `EXPO_PUBLIC_APP_SECRET` (build de Expo) — HMAC de build.

## Fuera de alcance / diferido explícitamente

- Play Integrity / DeviceCheck reales (queda HMAC de build simple).
- Tests automatizados de `apps/mobile`.
- Courier/Uber Direct (ya descartado a nivel proyecto).
