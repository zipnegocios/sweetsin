# Detalle del pedido, mapa profesional y contacto (llamar + WhatsApp) en la app del delivery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el repartidor vea qué lleva el pedido (productos, montos, canal y pago, notas), contacte al cliente por llamada o WhatsApp, y vea dentro de la app un mapa de ruta con ETA, distancia y tráfico.

**Architecture:** `GET /api/mobile/orders/assigned` entrega el detalle junto con las órdenes asignadas (así funciona offline desde la caché SQLite, sin endpoint nuevo). Las notas de entrega son una columna nueva de `orders` que llena el checkout web. El normalizador de teléfono es lógica pura de la app. El mapa reutiliza `RouteMap` (react-native-maps + Google) y se enriquece con tráfico por tramo desde Google Routes; la navegación giro a giro se delega a Google Maps.

**Tech Stack:** Expo SDK 57 / RN 0.86 (`apps/mobile`), Next 15 (`apps/web`), Drizzle/Postgres (`packages/db`, base compartida dev=prod), `packages/domain`, `packages/i18n`, Vitest.

**Spec:** plan aprobado `C:\Users\zipne\.claude\plans\convenimos-entonces-que-vamos-mutable-firefly.md`; base: `docs/superpowers/specs/2026-10-20-apk-multirol-design.md` y `docs/design/mobile-design-system.md`.

## Global Constraints

- Solo delivery; el despachador no cambia. Solo Android, sin módulos nativos nuevos (no hay que recompilar el build de desarrollo).
- Las pantallas importan UI solo de `design-system/index.ts`; sin colores, `fontFamily` ni primitivas de `react-native` (`View`, `Text`, `Button`, ...) en `src/screens/` (lo vigila `design-rules.test.ts`). Falta un componente → molécula nueva con tokens (en los TRES temas) y export desde el índice.
- Textos solo vía `packages/i18n` (`staffApp` y las claves del checkout web), ES y EN con las mismas claves; sin placeholders `{x}`; voseo rioplatense en ES de `staffApp`.
- `/assigned` sigue sin `customerEmail`, `stripePaymentIntentId` ni IDs internos de Stripe; los campos nuevos son opcionales en la app para que cachés viejas sigan leyéndose.
- WhatsApp: se abre con `Linking.openURL("https://wa.me/<dígitos>")` dentro del helper `open()` existente (sin `canOpenURL`, sin `<queries>`). Número AU por defecto; si el cliente escribió `+` o `00` + código de país se respeta; si no se reconoce, solo se ofrece Llamar.
- La ubicación del teléfono no se pide al abrir la pantalla (regla R24); "Ver ruta" sigue siendo quien pide el permiso. Costo de Google acotado por la caché de servidor de 60 s.
- Esquema de DB: columna nullable; el push a la base compartida lo aplica el agente; los tests de DB usan datos con prefijo identificable y los limpian.
- Mensajes de commit en español, una línea, sin firmas. El harness bloquea `git commit`: cada tarea queda con `git add` y se registra su árbol (`git write-tree`).

## Review Focus

1. Un número raro (texto, muy corto, `+` sin dígitos) no rompe nada: sin botón de WhatsApp y Llamar sigue funcionando.
2. Caché vieja sin los campos nuevos: la tarjeta se ve sin detalle, sin error.
3. Notas de entrega vacías o solo espacios: no se muestra el bloque; notas largas se truncan a 500 en el servidor.
4. Una orden sin dirección (retiro) no intenta calcular ruta ni muestra mapa.
5. Sin red: el detalle sigue visible desde la caché; el mapa muestra el último cálculo o el texto "ruta no disponible", nunca se cuelga.
6. Un fallo de Google Routes o intervalos de tráfico ausentes: se dibuja una sola línea, sin romper el mapa.

---

### Task 1: Normalizador de teléfono y enlace de WhatsApp

**Files:**
- Create: `apps/mobile/src/contact/whatsapp.ts`
- Test: `apps/mobile/src/contact/whatsapp.test.ts`

**Interfaces:**
- Produces: `toWhatsAppNumber(raw: string): string | null` (dígitos en formato internacional sin `+`) y `whatsappUrl(raw: string): string | null` (`https://wa.me/<dígitos>`).
- Reglas exactas: quitar espacios, guiones, puntos y paréntesis; `+<cc>…` → dígitos tal cual (6 a 15 dígitos); `00<cc>…` → igual sin el `00`; `04` + 8 dígitos (móvil AU) → `614` + 8 dígitos; fijo AU `0[2378]` + 8 dígitos → `61` + los 9 dígitos sin el 0; `61` + 9 dígitos → se respeta; cualquier otro caso (vacío, letras, menos de 6 o más de 15 dígitos, `0` + longitud inesperada) → `null`.

- [ ] **Step 1: Tests** (`whatsapp.test.ts`): `"0412 345 678"` → `"61412345678"`; `"0412345678"` igual; `"+61 412 345 678"` → `"61412345678"`; `"+44 7700 900123"` → `"447700900123"`; `"0044 7700 900123"` → `"447700900123"`; `"(08) 8123 4567"` → `"61881234567"`; `"61412345678"` se respeta; `""`, `"abc"`, `"123"`, `"+"`, `"0412"` → `null`; `whatsappUrl("0412 345 678")` → `"https://wa.me/61412345678"` y `whatsappUrl("x")` → `null`.
- [ ] **Step 2:** `pnpm --filter mobile run test` → FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar en TypeScript puro (sin imports de react-native).
- [ ] **Step 4:** PASS + `pnpm --filter mobile run typecheck`.
- [ ] **Step 5:** `git add apps/mobile/src/contact` y commit: `Agrega el normalizador de telefono y el enlace de WhatsApp para el delivery`.

---

### Task 2: Notas de entrega (DB, dominio y checkout web)

**Files:**
- Modify: `packages/db/src/schema/orders.ts` (columna `delivery_notes text`, nullable), `packages/db/src/repositories/order-repository.ts` (mapeo en ambos sentidos), `packages/domain/src/orders/{entities,ports,use-cases}.ts`, `apps/web/src/app/actions/checkout.ts`, `apps/web/src/components/cart/checkout-modal.tsx`, `packages/i18n/src/{types.ts,dictionaries/en.ts,dictionaries/es.ts}` (claves del checkout web), tests correspondientes.

**Interfaces:**
- Produces: `Order.deliveryNotes?: string | null`; `CreateOrderInput.deliveryNotes: string | null`; la Server Action de checkout acepta `deliveryNotes?: string` (`z.string().trim().max(500)`, vacío → `null`) y solo lo envía en entrega a domicilio.

- [ ] **Step 1: Tests**: dominio (`createOrder` conserva `deliveryNotes`, `null` cuando no viene), repositorio de DB contra la base real (crear una orden con notas, leerla y borrarla; datos con prefijo identificable), acción de checkout (notas recortadas, vacías → `null`, más de 500 → error de validación).
- [ ] **Step 2:** correr los tests → FAIL.
- [ ] **Step 3:** Implementar; en el modal agregar un `textarea` opcional "Notas de entrega" solo para `self_delivery` y una pista junto al teléfono: incluir el código de país si el número no es de Australia (comprobar que el campo de teléfono conserva el `+`). Textos ES/EN en `packages/i18n`.
- [ ] **Step 4:** Aplicar el esquema: `pnpm --filter @workspace/db run push` (columna nullable; revisar que el diff solo agrega `delivery_notes`; sin `--force`). Correr los tests de DB, `pnpm run typecheck` y la paridad de i18n → PASS.
- [ ] **Step 5:** `git add` de lo tocado y commit: `Agrega las notas de entrega al pedido y al checkout web`.

---

### Task 3: El servidor y la caché entregan el detalle del pedido

**Files:**
- Modify: `apps/web/src/app/api/mobile/orders/assigned/route.ts` (+ su test), `apps/mobile/src/offline/assigned-cache.ts`, `apps/mobile/src/offline/parse-assigned-rows.ts` (+ tests)

**Interfaces:**
- Consumes: `Order.deliveryNotes` (Task 2); el repositorio de productos existente en `@workspace/db/repositories` (reutilizarlo para resolver nombres; no escribir otra consulta si ya hay una por ids).
- Produces: cada elemento de `orders` de `/assigned` suma `fulfillmentType`, `items: { name: string; quantity: number }[]`, `subtotalCents`, `discountCents`, `deliveryFeeCents`, `totalCents`, `channel`, `paymentStatus`, `deliveryNotes: string | null`. En la app, `AssignedOrder` suma esos campos como **opcionales**; un producto sin nombre resoluble se muestra con un texto neutro del lado del servidor (`"?"`), nunca rompe.

- [ ] **Step 1: Tests**: el endpoint responde la forma exacta con `toEqual` (sin `customerEmail` ni Stripe; `items` con nombres; notas `null` cuando no hay); `parse-assigned-rows` acepta filas viejas sin los campos y filas nuevas con ellos; descarta filas mal formadas como hoy.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar. **Step 4:** tests de `apps/web` `api/mobile`, de mobile y `pnpm run typecheck` → PASS.
- [ ] **Step 5:** `git add` y commit: `Entrega el detalle del pedido al delivery junto con las ordenes asignadas`.

---

### Task 4: Ruta con tráfico por tramo (servidor y contrato)

**Files:**
- Modify: `packages/domain/src/routing/*` (tipo de `RouteInfo` y puerto si hace falta), `apps/web/src/infra/google-routes-planner.ts` (o el archivo real del planificador; localizarlo con grep `GoogleRoutesPlanner`), su test, `apps/mobile/src/maps/{types.ts,parse-route-info.ts}` (+ tests)

**Interfaces:**
- Produces: `RouteInfo.trafficSegments?: { startIndex: number; endIndex: number; speed: "normal" | "slow" | "jam" }[]` (índices sobre los puntos de la polilínea decodificada; vienen de `routes.travelAdvisory.speedReadingIntervals` de Google Routes con `extraComputations: ["TRAFFIC_ON_POLYLINE"]` y `routes.travelAdvisory` añadido al field mask). Ausente o inválido → se omite (la app dibuja una línea).

- [ ] **Step 1: Tests**: el planificador mapea `SPEED_READING_INTERVALS` (`NORMAL`, `SLOW`, `TRAFFIC_JAM`) a `normal|slow|jam`; respuesta sin intervalos → sin `trafficSegments`; intervalos con índices fuera de rango se descartan; `parseRouteInfo` acepta el campo y lo ignora si es inválido; la caché de 60 s sigue funcionando.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar. **Step 4:** tests de infra/dominio/mobile y typecheck → PASS.
- [ ] **Step 5:** `git add` y commit: `Agrega el trafico por tramo a la ruta del delivery`.

---

### Task 5: Pantalla del delivery: detalle, contacto y mapa profesional

**Files:**
- Modify: `apps/mobile/src/screens/DeliveryQueueScreen.tsx`, `apps/mobile/src/maps/RouteMap.tsx`, `apps/mobile/src/design-system/molecules/*` + `index.ts` y `themes/components.ts` (si falta un componente; en los tres temas), `packages/i18n` (`staffApp.*` nuevas), `apps/mobile/src/design-rules.test.ts` no cambia.
- Create (si hace falta lógica pura nueva, p. ej. `maps/traffic-segments.ts` que agrupa la polilínea en tramos por color, o el cálculo de la hora de llegada): con tests en Node.

**Interfaces:**
- Consumes: `toWhatsAppNumber`/`whatsappUrl` (Task 1); campos de detalle de `AssignedOrder` (Task 3); `RouteInfo.trafficSegments` (Task 4).
- Produces comportamiento:
  - Tarjeta seleccionada: sección plegable "Ver detalle del pedido" (productos `cantidad × nombre`, subtotal, descuento, envío, total, canal y estado de pago con texto, y notas de entrega destacadas si no están vacías). Sin campos (caché vieja) la sección no aparece.
  - Fila de contacto: "Llamar" (`tel:`) y "WhatsApp" (solo si `whatsappUrl` no es `null`), botones secundarios con tamaño táctil del tema; accesibles (`accessibilityLabel` con el nombre del cliente).
  - Mapa: visible por defecto para la orden seleccionada cuando ya hay ruta (permiso concedido); altura ~40 % del alto de pantalla; tarjeta superpuesta con ETA con tráfico, distancia y hora de llegada; `showsUserLocation` y `showsTraffic`; polilínea por tramos coloreados (tokens del tema: fluido/lento/detenido; el color no es el único portador: la tarjeta indica "con tráfico" en texto cuando hay tramos lentos o detenidos); refresco automático de la ruta cada 60 s mientras la orden está seleccionada y la app en primer plano; "Ver ruta" sigue siendo el modo de pedir el permiso la primera vez.
  - "Iniciar navegación": abre Google Maps en modo conducir hacia el destino (`https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=driving` con las coordenadas de la ruta; sin ellas, con la dirección como hoy) mediante `open()`.

- [ ] **Step 1: Tests** de la lógica pura nueva (agrupación por tramos con y sin `trafficSegments`, hora de llegada a partir de `etaSeconds` y de un `Date` inyectado, formato del enlace de navegación) y de paridad de i18n.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar; descubrir y anotar en el informe por qué hoy el mapa no se ve en el teléfono (condiciones: orden `out_for_delivery`, permiso, `GOOGLE_ROUTES_API_KEY` en servidor, clave de Maps en el build) sin cambiar esas condiciones de seguridad.
- [ ] **Step 4:** `pnpm --filter mobile run test && pnpm --filter mobile run typecheck && pnpm --filter mobile exec expo export --platform android` (salida a una carpeta temporal fuera del repo) y `pnpm run typecheck` → PASS (incluye `design-rules`, arquitectura y contraste).
- [ ] **Step 5:** `git add` y commit: `Agrega detalle del pedido, contacto por WhatsApp y mapa con trafico a la pantalla del delivery`.

---

### Task 6: Documentación y lista de verificación

**Files:**
- Modify: `CLAUDE.md` (payload de `/assigned`, `orders.delivery_notes`, tráfico por tramo, WhatsApp), `handoff.md` (agregar a las 5 secciones, sin borrar), `docs/superpowers/checklist-dispositivo-delivery.md` (casillas nuevas)

- [ ] **Step 1:** Actualizar los tres archivos con lo que ya hizo el código (verificar leyendo el código, no inventar).
- [ ] **Step 2:** Checklist con casillas `- [ ]` y resultado esperado: detalle con productos y notas; Llamar abre el marcador; WhatsApp abre el chat con un móvil AU (`04…`) y con un `+44…`; sin botón de WhatsApp con un número inválido; mapa visible para la orden seleccionada con permiso concedido; ETA, distancia y tráfico; "Iniciar navegación" abre Google Maps; sin red el detalle sigue visible; un pedido hecho en la web con notas llega a la app.
- [ ] **Step 3:** `git add CLAUDE.md handoff.md docs/superpowers/checklist-dispositivo-delivery.md` y commit: `Documenta el detalle del pedido, el contacto y el mapa del delivery`.

---

## Self-review

- **Cobertura:** detalle (Tasks 2, 3, 5), WhatsApp/llamar (1, 5), notas (2), mapa dentro de la app con ETA, distancia y tráfico (4, 5), navegación (5), docs (6).
- **Consistencia de tipos:** `deliveryNotes` nace en la Task 2 y lo consumen las Tasks 3 y 5; `RouteInfo.trafficSegments` nace en la Task 4 y lo consume la 5; `toWhatsAppNumber`/`whatsappUrl` nacen en la Task 1.
- **Fuera de alcance:** guía giro a giro dentro de la app (SDK de navegación), cambios en el despachador, edición de notas desde el panel admin.
