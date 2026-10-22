# APK Android — Fundación, diseño UI/UX, delivery offline, evidencia, mapas y seguimiento (Plan 1 de 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar `apps/mobile` compilable como APK firmada en GitHub Actions (más un build de desarrollo permanente), sin HMAC, con un design system propio de las apps móviles APK (íconos, splash, tokens, tipografía, componentes, estados de red y accesibilidad), con un delivery que sigue operando durante cortes de red cortos, que puede adjuntar foto + GPS como evidencia de entrega, que ve su ruta y ETA con tráfico, y con un despachador que ve la flota en un mapa. Sin push remoto por ahora.

**Architecture:** El servidor es la autoridad: el teléfono nunca decide estado. El delivery guarda una caché de solo lectura de sus órdenes asignadas y una cola local de comandos "entregada" (TypeScript puro con almacenamiento inyectado; `expo-sqlite` solo implementa la interfaz). La evidencia se sube **directo a R2 con una URL prefirmada que genera el servidor**, así la APK (pública) nunca contiene credenciales de R2.

**Tech Stack:** Expo SDK 57 / React Native 0.86.3, `expo-sqlite`, `expo-image-picker`, `expo-location`, `expo-localization`, `expo-image` (GIF animados), `expo-font` + `@expo-google-fonts/atkinson-hyperlegible`, `expo-dev-client`, `expo-task-manager`, un módulo de mapas (`react-native-maps` o `expo-maps`: verificar en los docs de Expo SDK 57), Google Routes API, `expo-splash-screen`, `Animated` de React Native (sin librerías de animación nuevas), `sharp` (script de íconos), Vitest, GitHub Actions (`expo prebuild` + Gradle + `apksigner`), Next.js route handlers, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (R2), `packages/domain`, `packages/i18n`.

**Spec:** `docs/superpowers/specs/2026-10-20-apk-multirol-design.md` (incluye las enmiendas del 2026-10-20: decisiones nuevas de este plan y "diseño UI/UX y sistema de diseño en mobile"). Design systems: el de la web ya existe y **no se toca**; el de las apps móviles se funda en la Task 9 (`docs/design/mobile-design-system.md`).

**Planes siguientes:** **Plan 2** — rol admin en la APK (login email+contraseña+biométrico, Route Handlers admin, pantallas de Órdenes con histórico de entregas y visualización de la evidencia, Paradas y stock, Eventos y calendario), índice en `orders.assigned_delivery_user_id` y guard de middleware de `/dispatch` y `/delivery`. **Plan 3** — ver "Fuera de alcance".

## Mapa de numeración y orden de ejecución

El prompt de decisiones del owner usa una numeración anterior del plan. Equivalencias:

| En el prompt del owner | En este plan |
|---|---|
| "Task 1" + fix de `updateOrderStatusAction` | Task 4 (completa) |
| "Task 5" (`makeDeliverSender`, cola offline) | Task 10 (completa); su arreglo de 408/429 es la Task 15 |
| Tarea de evidencia "entre la 6 y la 7" | Tasks 12 y 13 |
| `notifyNewOrderInQueue` | Task 3 (completa) |
| "Task 8" (dispositivo real) | Task 20 (la antigua Task 8, push, queda descartada) |
| Build de desarrollo permanente (D5) | Task 16 (nueva) |
| Mapas, ETA y tracking (sección 7) | Tasks 17, 18 y 19 (nuevas) |

**Estado al retomar:** completas y aprobadas las Tasks 1 a 7, 10 y el código de la 12; la 9a es un borrador que se reescribe (ver Task 9). Quedan por hacer 9b, 11, 13, 14 y 15 a 20; la 12 se cierra con su paso 7.

**Orden de ejecución recomendado:**
1. Cierre de la Task 12 (el agente aplica el esquema y corre las pruebas de base de datos; el owner pone las credenciales de R2).
2. Task 15 (arreglos de revisión) y Task 16 (build de desarrollo): la 16 va antes de las pantallas porque sirve para iterar la UI.
3. Task 9 (reescribir el documento con el de justificación del owner, luego el kit), 11, 13, 14.
4. Tasks 18 (seguimiento) → 17 (ruta y ETA) → 19 (mapa de flota).
5. Task 20 (verificación en teléfono real y documentación), y la revisión final de toda la rama.

## Quién ejecuta qué (regla fija para todo el plan)

**El agente ejecuta sin pedir permiso:** escribir y modificar código; escribir el YAML de los workflows de GitHub Actions (sin despacharlos); aplicar migraciones de esquema con `pnpm --filter @workspace/db run push`; correr tests, typecheck y builds locales; generar scripts (incluido el de commits); cualquier tarea que corra dentro del repo o de la máquina local sin tocar credenciales externas.

**El agente se detiene y pide al owner (nunca lo intenta ni lo simula):**
- `git commit` y `git push` reales (regla fija de `CLAUDE.md`; los commits los hace el owner con `.superpowers/sdd/2026-10-20-apk-fundacion-delivery-offline/commit-por-tarea.sh` o a mano);
- generar el keystore de release y cargar secretos en GitHub;
- declarar o modificar variables de entorno en EasyPanel;
- declarar las variables de R2 (y otras credenciales) en `.env.local`;
- cualquier acción dentro de la configuración de un servicio externo (GitHub, EasyPanel, Google Cloud);
- instalar o probar la APK en un teléfono físico.

Cuando una tarea quede bloqueada por una acción del owner, el agente lo dice explícitamente y sigue con las tareas independientes en vez de detener todo el plan.

## Alcance actual: solo la APK de delivery

Decisión del owner (2026-10-21): por ahora el desarrollo se enfoca **solo en la experiencia del delivery**. Se mantiene una única app (`apps/mobile`, con inicio de sesión por rol) y **no** se crean APK separadas todavía.

| Tarea | Alcance actual |
|---|---|
| 9b Design system | **Dentro**, completo (arquitectura atómica y tres temas; solo el tema `outdoor` se usa) |
| 11 Delivery offline | **Dentro** |
| 13 Evidencia en la app | **Dentro** |
| 14 Login y despachador | **Solo el login** (lo usa el delivery). La pantalla del despachador **se difiere**: queda como está, en la lista de excepciones del test de reglas de diseño |
| 17 Ruta y ETA | **Dentro** (lado delivery) |
| 18 Turno y ubicación | **Solo el lado delivery**: dominio de registro y fin de turno, `PUT` y `DELETE /api/mobile/location`, turno y seguimiento en la app. **Se difieren** `listSince`, `listFleetPositions` y `GET /api/mobile/fleet` (son del despachador) |
| 19 Mapa de flota | **Diferida** (despachador) |
| 20 Verificación | Solo los flujos del delivery; los puntos del despachador (2 y 5) se omiten |
| Plan 2 (admin) | Fuera de alcance por ahora |

Los temas `indoor` (despachador y admin) y `brand` (clientes) quedan **definidos y testeados** en el design system, pero no se construye ninguna pantalla para ellos.

## Decisiones consolidadas (rondas de revisión con el owner)

| Decisión | Resolución | Dónde entra |
|---|---|---|
| D1 Push remoto | **Opción C: no usar push remoto por ahora.** Sin Firebase/FCM, sin `google-services.json`, sin cuenta de Expo. El código de `registerPushToken` y `ExpoNotificationAdapter` queda inerte, sin tocar. Si se reconsidera, sería FCM directo con `firebase-admin` en un plan aparte | Task 8 descartada |
| D2 y D3 Design system e ícono | Se resuelven con el documento `mobile-design-system-justificacion.md` del owner (ya está en `docs/design/mobile-design-system-justificacion.md`) | Task 9 |
| D4 Marcar `paid` desde el admin | Mantener lo implementado (descuenta stock, mueve a `received`, notifica) | Task 4 (completa) |
| D5 Build de desarrollo | **Pieza permanente** del proyecto (no desechable) | Task 16 |
| D6 Arreglos menores | Sí: 408/429 → reintento y limpieza garantizada del flag de evidencia en los tests | Task 15 |
| D7 Selector de repartidor en el admin | Mantener el error actual; no habilitar selector libre y no "corregirlo" por error en una tarea futura | Sin cambios |
| D8 Esquema de evidencia | El agente aplica el `push` y verifica con las pruebas de base de datos **antes** de usar las columnas | Task 12, paso 7 |
| Mapas, ETA y seguimiento en vivo | Entran al Plan 1 como herramienta interna de staff; el cliente no ve nada de esto (Plan 3) | Tasks 17, 18 y 19 |

## Preguntas abiertas y conflictos detectados (necesitan respuesta del owner)

Las detecté al incorporar el prompt; ninguna estaba resuelta por él.

1. **Q1 — RESUELTA (2026-10-21).** El documento de justificación ya está en `docs/design/mobile-design-system-justificacion.md`. El borrador `docs/design/mobile-design-system.md` (paleta de marca) se reescribe para coincidir con él (Task 9a), recalculando el contraste con la paleta nueva.
2. **Q2 — RESUELTA.** El documento de justificación mantiene el ícono sobre fondo Navy y dice que **no hay que rehacer el activo**: se mantienen los íconos de la Task 6 (fondo `#0F1B3D`, a pocas unidades de Tinta `#14233A`). `generate-brand-assets.mjs` permite alinearlo a Tinta cambiando una constante si el owner lo pide. El acento rojo de la notificación (`#E63946`) no se usa mientras el push siga descartado.
3. **Q3 — Valor por defecto (confirmar o nombrar otra).** El documento pide una tipografía display "curva, un poco traviesa" solo para el wordmark del login, sin nombrarla. Por defecto: **Fraunces Black Italic** (la tipografía display de la marca web, `@expo-google-fonts/fraunces`), únicamente en el wordmark y nunca en texto operativo.
4. **Q4 — RESUELTA.** Bucket **`sweet-delivery`**, cuenta `b798b0b01ea8805faa0bb16b07e6c4f4`, endpoint S3 `https://b798b0b01ea8805faa0bb16b07e6c4f4.r2.cloudflarestorage.com`. Quedan solo `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` (las declara el owner en `.env.local` y EasyPanel). **CORS no hace falta:** las subidas las hace una app nativa (no un navegador) y el admin leerá las fotos con URL prefirmada.
5. **Q5 — Se resuelve en el camino** (decisión del owner), antes de la Task 17: proyecto de Google Cloud, facturación y las dos claves (SDK de mapas de Android restringida por paquete y SHA-1; Routes API solo servidor).
6. **Q6 — Lo define el equipo legal; no limita la etapa de desarrollo** (decisión del owner). El diseño mitigante de la Task 18 se mantiene (turno propio, consentimiento, aviso persistente, sin historial).
7. **Q7 — "Turno".** No existe hoy ese concepto. Se agrega un botón "Iniciar turno / Terminar turno" en la pantalla de delivery que enciende y apaga el seguimiento. Confirmar.
8. **Q8 — Nombre de columna.** El prompt sugiere `deliveryEvidenceUrl`; se mantiene `deliveryEvidenceKey` (guarda la clave del objeto, no una URL, porque el bucket es privado y la foto muestra el domicilio).
9. **Q9 — `registerPushToken` inerte.** Al iniciar sesión sigue pidiendo el permiso de notificaciones y falla en silencio sin credenciales. Se deja sin tocar, como se pidió; si molesta, es un guard de una línea.
10. **Q10 — `expo-dev-client` en el build de release.** Sumar la dependencia no debería meter el lanzador de desarrollo en el APK de release, pero se verifica: la Task 16 agrega una comprobación en el workflow de release que falla si aparece.
11. **Q11 — RESUELTA (OK del owner).** El ETA del despachador se muestra en el mapa de flota, al tocar un repartidor.

## Global Constraints

- Solo Android/APK. Fuera de alcance: Expo Go, iOS/IPA, WebView/PWA embebida, módulo TV, pedidos presenciales, pantallas de staff, sincronización bidireccional de tablas (PowerSync/ElectricSQL), WebSockets/SSE.
- "El teléfono nunca decide estado": toda transición la valida el servidor con casos de uso de `packages/domain`.
- Offline solo para **delivery**; despachador (y admin, Plan 2) trabajan solo en línea con aviso visible de "sin conexión".
- Detección de red: por fallo de `fetch`, nunca `navigator.onLine`.
- "Tiempo real" = polling (30 s) + refresco al volver a primer plano. El push remoto está **descartado por ahora** (D1 = C): sin Firebase, sin `google-services.json`, sin cuenta de Expo.
- Almacenamiento local: `expo-sqlite`; sesión en `expo-secure-store` (ya existe).
- Build: GitHub Actions propio con `expo prebuild` + Gradle. No EAS Build.
- La APK no contiene secretos ni credenciales de R2 ni de la Routes API; toda credencial vive en el servidor. La única clave que viaja en la APK es la del SDK de mapas de Android, que es **pública y restringida** por paquete y huella SHA-1 (no es un secreto).
- **i18n:** todo string **nuevo** en `apps/mobile` sale de `packages/i18n` (namespace nuevo `staffApp`, reutilizando claves de `dispatch`/`common` que ya existan), incluidas las pantallas de evidencia, mapas, ETA y seguimiento. Las pantallas que se reconstruyen con el kit de diseño (inicio de sesión, delivery, despachador) se traducen enteras.
- **UI/UX:** el design system mobile (`docs/design/mobile-design-system.md`, que se reconcilia con `mobile-design-system-justificacion.md` del owner) es independiente del de la web; toda pantalla se construye solo con el design system `apps/mobile/src/design-system/` (las pantallas solo usan `useTheme()` y sus componentes); sin colores ni fuentes literales en `screens/` (lo comprueba un test, Task 9). Tema claro único; vertical; paleta de 6 colores base y una sola tipografía operativa (Atkinson Hyperlegible); acciones primarias en el tercio inferior y de 56 dp como mínimo; ver "Criterios de calidad de UI".
- Antes de escribir código en `apps/mobile`: leer `apps/mobile/AGENTS.md` (docs de Expo v57: https://docs.expo.dev/versions/v57.0.0/).
- Reglas de `CLAUDE.md`: Claude nunca ejecuta `git commit` ni `git push` (solo `git add` y sugerir el comando); commits en español, una línea, sin firmas; trabajar en `main`; reutilizar antes de crear; razonar en español con la estructura de 4 pasos.
- Base de datos compartida dev=prod: los tests que escriban datos limpian lo que crean (prefijo identificable); un `push` de esquema requiere OK del owner.
- **Google Maps Platform:** dos claves distintas. `GOOGLE_ROUTES_API_KEY` (solo servidor, Routes API, nunca la de la web) y `GOOGLE_MAPS_ANDROID_API_KEY` (clave pública del SDK de mapas, restringida por paquete y SHA-1 de release y de debug; entra como secreto de GitHub y se inyecta en el prebuild). Cada cálculo de ruta con tráfico es una llamada paga: la caché del servidor es obligatoria.
- **Ubicación del personal:** solo durante un turno que el propio delivery inicia, con consentimiento previo, notificación persistente, **sin historial** (solo la última posición) y borrado al terminar el turno o cerrar sesión; pendiente de confirmación legal (pregunta Q6). Nada de esto se expone al cliente en este plan.
- **Quién ejecuta qué:** ver la sección dedicada (el agente aplica los `push` de esquema; el owner hace commits, push, secretos y credenciales).

## Decisiones registradas (para que no queden como pendientes abiertos)

- **Sin guard adicional en logout ni en la cola de comandos:** cada delivery tiene su propio dispositivo de trabajo, así que sesión y cola local siempre corresponden al mismo usuario. Logout borra la caché de órdenes (datos de clientes) pero **no** la cola de comandos (solo guarda `orderId`).
- **Confirmación del cliente ("sí, lo recibí")**: `fulfillmentStatus` sigue siendo un único campo y `delivered` solo lo dispara el delivery (`markOrderDelivered`). No se agrega ningún campo ni lógica para la confirmación del cliente; el modelo de este plan no la bloquea (la evidencia cuelga de `orderId`; no se toca el enum de estados).
- **Retención de evidencia:** 7 días por defecto, ampliable a 30, **pendiente de confirmación del equipo legal**. No se implementa borrado automático aquí; la regla de ciclo de vida del bucket R2 queda como tarea de infraestructura separada. Se documenta en `handoff.md` y en un comentario del adaptador R2.

## Fuera de alcance (Plan 3 futuro, posterior al Plan 2)

Flujo de disputas del cliente: "producto no recibido", tipificaciones de reclamo, vista de la foto de evidencia en el panel del cliente y estado `disputed` en la orden. No se crea ningún endpoint, tabla ni pantalla para esto en el Plan 1. La foto solo la ve el propio delivery (indicador "evidencia enviada") y, en el Plan 2, el admin.

La vista del **cliente** viendo al repartidor moverse en su panel queda para el Plan 3: el dato (última posición, Task 18) ya queda guardado de forma que conectarlo sea agregar un consumidor, no rediseñar el almacenamiento.

## Review Focus

1. Reintento de "entregada" tras respuesta perdida → éxito idempotente; reintento de otro usuario sobre `delivered` → rechazado (Task 1).
2. Pasar de `pending` a `delivered` desde el panel admin → rechazado como lo rechazaría el dominio; marcar `paid` dos veces (reintento del webhook o doble clic) → una sola notificación y un solo descuento de stock (Tasks 3–4).
3. Corte de red a mitad del vaciado de la cola → los restantes quedan en orden, sin duplicar ni perder; token vencido → quedan en cola (Task 10).
4. Evidencia: clave de otra orden o de una orden no asignada → rechazada; fallo de la subida → "Entregar" sigue funcionando (Tasks 12–13).
5. Login con body que no es JSON → 400, no 500 (Task 2).
6. Un 408 o 429 transitorio nunca descarta un comando "entregada" de la cola; un test que activa `deliveryEvidenceRequired` nunca deja el flag en `true` en la base real (Task 15).

## Criterios de calidad de UI (aplican a las Tasks 6, 9, 11, 13, 14, 17, 18 y 19; se verifican en la Task 20)

Derivan del spec (enmienda II). Una pantalla no está terminada si incumple alguno:

1. **Contraste AA:** 4,5:1 texto normal y 3:1 texto grande (≥ 18 sp en negrita) y componentes. Texto pequeño nunca sobre relleno Sin Red ni en rojo sobre Cream (usar Sin Red Dark). El test de contraste (Task 9) recorre los pares permitidos.
2. **Tocables ≥ 48×48 dp**, separación ≥ 8 dp; **acciones primarias en el tercio inferior de la pantalla y de 56 dp de alto como mínimo** (marcar entregada, agregar evidencia).
3. **Escala de fuente 130 % y 200 %** sin cortes ni solapes.
4. **El estado se dice con texto + glifo + color**, nunca solo color.
5. **Estados completos en cada pantalla:** cargando, vacío, error, sin conexión, pendiente de sincronizar, éxito.
6. **Reducir movimiento** del sistema: sin animaciones de entrada y GIF reemplazados por la imagen estática.
7. **Sin animación en bucle en pantallas de trabajo**; los GIF solo en inicio de sesión, carga y estados vacíos.
8. **Voz de marca** ligera solo en estados vacíos y de éxito; errores y acciones críticas, neutros y claros.
9. **Tipografías incluidas en la APK** (la app abre sin red); el splash espera a que carguen.
10. **El borde dorado de "pendiente de sincronizar" nunca es el único portador** de esa información: siempre ícono + texto.
11. **Glifos de estado en Unicode** (sin `@expo/vector-icons`), comprobados en más de un fabricante de Android.
12. **Mapas y ETA:** nunca bloquean una acción de trabajo; sin red, sin permiso o con error del servicio, la pantalla funciona sin ellos y lo dice con un mensaje discreto.

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
| `apps/mobile/src/design-system/{tokens,themes,atoms,molecules,organisms,templates}/*` | design system atómico con temas `outdoor`, `indoor` y `brand` (capas: tokens → temas → átomos → moléculas → organismos → plantillas); solo `outdoor` tiene consumidores |
| `apps/mobile/src/hooks/use-polling.ts`, `screens/*` | comportamiento y pantallas |
| `.github/workflows/build-apk.yml` | build, firma, inspección y publicación |
| `.github/workflows/build-dev-apk.yml`, `apps/mobile/app.config.ts` | build de desarrollo permanente (`expo-dev-client`, variante `.dev`) |
| `packages/domain/src/routing/*`, `apps/web/src/infra/{google,caching}-route*.ts`, `apps/web/src/app/api/mobile/orders/[id]/route/**` | ruta y ETA con tráfico (Routes API, caché) |
| `packages/domain/src/delivery-tracking/*`, `packages/db/src/schema/delivery-locations.ts`, `apps/web/src/app/api/mobile/{location,fleet}/**` | turno y última ubicación del delivery, mapa de flota |
| `apps/mobile/src/{maps,tracking}/*`, `src/screens/FleetMapScreen.tsx` | mapas, ETA, seguimiento y mapa de flota en la app |

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

### Task 8: ~~Push de punta a punta en un teléfono real~~ — DESCARTADA POR AHORA (D1 = C)

No se ejecuta. Se mantiene el número para que las demás tareas conserven su numeración.

- No se crea proyecto de Firebase, no se pide `google-services.json`, no se sube ninguna clave FCM y no se usa cuenta de Expo.
- `registerPushToken` (`apps/mobile/src/navigation/index.tsx`) y `ExpoNotificationAdapter` (`packages/notifications`) quedan **inertes y sin tocar**: sin token registrado, el servidor solo anota `blocked` en `push_logs`.
- `notifyNewOrderInQueue` y `notifyDeliveryAssigned` siguen conectados en el dominio (Task 3 y la Fase 7); no hay nada que desmontar.
- La verificación de push **ya no está** en el checklist de dispositivo (Task 20): está descartada, no pendiente.
- Si se reconsidera, sería la opción B del documento de decisiones (FCM directo con `firebase-admin`, sin el servicio de Expo como intermediario), en un plan aparte.

---

### Task 9: Design system de las apps móviles (documento, arquitectura atómica con temas, kit, marca y movimiento)

**Estado:** la **9a** (documento `docs/design/mobile-design-system.md` reconciliado con `mobile-design-system-justificacion.md`) está completa. Esta es la **9b**: implementar el design system en código. Los ajustes visuales posteriores (colores, tamaños, espacios) deben costar poco: **un cambio en un token o en un tema, nunca en una pantalla**.

**Principio rector (owner):** el design system es Diseño Atómico sobre tokens por capas, para que cualquier APK futura lo reutilice eligiendo un tema:
- **`outdoor`** (exteriores: delivery a pleno sol): es el que se usa ahora.
- **`indoor`** (interiores: despachador y admin): misma familia de color, densidad más relajada.
- **`brand`** (la marca para clientes): paleta y tipografía de la marca.
`indoor` y `brand` se definen y se testean, pero **no tienen consumidores** (no se construyen pantallas para ellos). La fuente de verdad del diseño del tema `outdoor` es el documento de justificación; los valores de los otros dos están en la nueva sección "Temas" del documento (se escribe en esta tarea).

**Reglas del owner que se cumplen en código (de la ronda de decisiones):** paleta base de 6 colores (navy `#14233A`, cream `#F6EFE1`, vanilla `#FBF7EC`, gold `#B8872B`, success `#2F7D5B`, alert `#A6351F`); una sola tipografía operativa, Atkinson Hyperlegible (regular y bold; paquete `@expo-google-fonts/atkinson-hyperlegible`, verificar los nombres exportados); acciones primarias de **56 dp** como mínimo en el tema `outdoor`; el borde dorado de "pendiente de sincronizar" nunca es el único portador (siempre glifo + texto); glifos de estado en Unicode, sin `@expo/vector-icons`; el dorado es el único acento de marca.

**Capas** (todo bajo `apps/mobile/src/design-system/`; la dependencia solo va hacia abajo):

| Capa | Carpeta | Contenido | Puede importar |
|---|---|---|---|
| 1. Tokens primitivos | `tokens/` | `palette`, `space`, `radius`, escala de tamaños y alturas de línea, duraciones de movimiento, medidas táctiles: valores sin significado | nada |
| 2. Temas (semánticos) | `themes/` | tipo `Theme` y los temas `outdoor`, `indoor`, `brand`: colores semánticos, tipografía, densidad táctil y movimiento | `tokens/` |
| 3. Tokens de componente | `themes/components.ts` | `buildComponentTokens(theme)`: qué token usa cada componente en cada estado | `tokens/`, `themes/` |
| Átomos | `atoms/` | `Text`, `Glyph`, `Touchable`, `Surface`, `Spacer` | capas 1-3, React, react-native |
| Moléculas | `molecules/` | `Button`, `StatusPill`, `Card`, `Banner`, `BrandMark` | átomos |
| Organismos | `organisms/` | `ScreenHeader`, `EmptyState`, `OfflineBanner` | átomos y moléculas |
| Plantillas | `templates/` | `ScreenLayout`: área segura, cabecera, banner, contenido desplazable y **barra de acción inferior en la zona del pulgar** | todo lo anterior |
| API pública | `index.ts` | `ThemeProvider`, `useTheme`, `useReduceMotion`, los componentes y los temas | — |

**Reglas de arquitectura:**
- Ningún componente ni pantalla lee `palette` ni usa colores o fuentes literales: todo sale de `useTheme()` (tokens semánticos y de componente).
- Los componentes son presentacionales: reciben los textos por props (nada de `packages/i18n`, de la API, del almacenamiento ni de `src/screens` dentro de `design-system/`). Así la carpeta se puede extraer a un paquete compartido más adelante con un `git mv`.
- Las pantallas importan solo de `design-system/index.ts`.
- El tema `brand` declara las familias de fuente de la marca (Fraunces para display y DM Sans para el cuerpo) **sin empaquetarlas**: la APK que lo use debe cargarlas. La APK de delivery no las incluye.

**Files:**
- Create: `apps/mobile/src/design-system/tokens/{palette,space,radius,type,motion,touch}.ts` (+ `tokens.test.ts`)
- Create: `apps/mobile/src/design-system/themes/{theme,components,outdoor,indoor,brand,index}.ts` (+ `themes.test.ts`, `contrast.ts`, `contrast.test.ts`)
- Create: `apps/mobile/src/design-system/{ThemeProvider.tsx,use-theme.ts,use-reduce-motion.ts,index.ts}`
- Create: `apps/mobile/src/design-system/atoms/*.tsx`, `molecules/*.tsx`, `organisms/*.tsx`, `templates/ScreenLayout.tsx`
- Create: `apps/mobile/src/design-system/architecture.test.ts`, `apps/mobile/src/design-rules.test.ts`
- Modify: `apps/mobile/App.tsx` (carga de Atkinson Hyperlegible, `expo-splash-screen` retenido hasta que carguen o fallen, `ThemeProvider theme={outdoor}`), `apps/mobile/package.json` (`pnpm --filter mobile exec expo install expo-font expo-image` y `@expo-google-fonts/atkinson-hyperlegible`)
- Modify: `docs/design/mobile-design-system.md` (nuevas secciones "Arquitectura atómica" y "Temas": qué cambia entre `outdoor`, `indoor` y `brand`; la paleta del tema `brand` se escribe en una tabla con otro formato que `| nombre | #RRGGBB |`, para que el test de coherencia siga leyendo solo la tabla base de 6 filas)
- Modify: `packages/i18n` solo si un componente necesita una clave propia (los textos viajan por props; lo normal es que no)

**Interfaces:**
- `Theme` (en `themes/theme.ts`): `{ name: "outdoor" | "indoor" | "brand"; colors: <claves semánticas de la sección 2.2 del documento>; textPairs: { fg: string; bg: string; size: "normal" | "large"; use: string }[]; touch: { min: number; primary: number }; type: Record<<variantes de texto del documento>, TextSpec>; motion: { staggerMs: number; enterMs: number; pressMs: number; bannerMs: number }; components: ComponentTokens }`. Los tres temas cumplen **el mismo tipo**.
- `ThemeProvider({ theme: Theme; children })`, `useTheme(): Theme`, `useReduceMotion(): boolean` (`AccessibilityInfo.isReduceMotionEnabled()` y suscripción a `reduceMotionChanged`), `contrastRatio(foreground: string, background: string): number` (WCAG 2.x sobre `#RRGGBB`).
- Componentes, con las firmas y especificaciones de la sección 4 del documento: `Button({ label: string; onPress: () => void; variant?: "primary" | "secondary" | "ghost"; loading?: boolean; disabled?: boolean; accessibilityHint?: string })`, `Card({ index?: number; children })`, `StatusPill({ status: "received" | "in_prep" | "ready_for_pickup" | "out_for_delivery" | "delivered" | "cancelled" | "pending_sync" | "evidence_sent"; label: string })`, `ScreenHeader({ title: string; actionLabel?: string; onAction?: () => void })`, `EmptyState({ title: string; message: string })`, `BrandMark({ variant: "isotipo" | "videologo"; size: number; animated?: boolean; playOnceMs?: number })` (GIF con `expo-image`; imagen estática si `animated` es falso, si `useReduceMotion()` o si la carga falla; pasa a la estática tras `playOnceMs`), `OfflineBanner({ visible: boolean; message: string })`, y la plantilla `ScreenLayout({ header?: ReactNode; banner?: ReactNode; bottomBar?: ReactNode; children })`.

- [ ] **Step 1: Escribir las secciones nuevas del documento** ("Arquitectura atómica" y "Temas") y definir los valores de `indoor` y `brand` (colores semánticos que cumplan el contraste de cada tema, tamaños táctiles y de texto, densidad). Reglas de contraste del tema `brand`: relleno rojo solo con etiqueta grande y en negrita, nunca texto rojo pequeño sobre claro (los números se calculan, no se asumen).
- [ ] **Step 2: Tests primero (TDD):**
  - `tokens.test.ts`: la tabla `| nombre | #RRGGBB |` de `docs/design/mobile-design-system.md` (exactamente 6 filas) coincide con `palette` (mismos nombres y valores, sin distinguir mayúsculas).
  - `contrast.test.ts`: `contrastRatio("#000000", "#FFFFFF")` ≈ 21; **para cada tema**, cada par de `textPairs` cumple su umbral (≥ 4,5 normal, ≥ 3 grande); y en `outdoor` los pares prohibidos del documento (success sobre cream, gold como texto, etc.) quedan por debajo de su umbral (la prohibición queda evidenciada).
  - `themes.test.ts`: los tres temas tienen exactamente las mismas claves (paridad estructural); `outdoor.touch.primary >= 56`; ningún tema tiene `touch.min < 48`; `outdoor` y `indoor` usan la misma paleta base.
  - `architecture.test.ts` (lee los archivos y comprueba los `import`): (1) la dirección de dependencias de la tabla de capas (p. ej. `atoms/` no importa de `molecules/`, `organisms/` ni `templates/`; `tokens/` no importa de nada del design system); (2) nada dentro de `design-system/` importa de fuera de esa carpeta salvo React, react-native y paquetes de Expo; (3) ningún archivo de `atoms/`, `molecules/`, `organisms/` ni `templates/` contiene colores literales (`#RRGGBB`, `rgb(`) ni `fontFamily:` con un nombre de fuente literal.
  - `src/design-rules.test.ts`: las pantallas de `src/screens/` no contienen colores ni `fontFamily:` literales y solo importan UI desde `design-system`. **Lista de excepciones explícita** (heredadas): `LoginScreen.tsx` (hasta la Task 14) y `DespachadorQueueScreen.tsx` (diferida por el alcance actual). `DeliveryQueueScreen.tsx` entra a la regla desde la Task 11.
- [ ] **Step 3: Correr y ver fallar**
  Run: `pnpm --filter mobile run test`
  Expected: FAIL (módulos inexistentes).
- [ ] **Step 4: Implementar** tokens, temas, utilidades, átomos, moléculas, organismos, plantilla y `App.tsx` (leer antes en los docs de Expo SDK 57 las APIs de `expo-image`, `expo-font` y `expo-splash-screen`; el splash no debe quedar colgado si la carga de fuentes falla).
- [ ] **Step 5: Verificar**
  Run: `pnpm --filter mobile run test && pnpm --filter mobile run typecheck && pnpm --filter mobile exec expo export --platform android`
  Expected: PASS y el bundle incluye tipografías y GIF. La revisión visual en teléfono ocurre con la primera pantalla real (Task 11) y en la Task 20.
- [ ] **Step 6: Stage y commit sugerido**
  `git add apps/mobile docs/design/mobile-design-system.md pnpm-lock.yaml`
  Sugerido (lo ejecuta el owner): `git commit -m "Implementa el design system mobile con arquitectura atomica, tres temas y kit de componentes"`

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

`expo-sqlite` no corre en Node: estas piezas no tienen test unitario (la lógica que importa está en Task 10); se verifican con typecheck y en dispositivo (Task 20).

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
  - Una `Card` por orden con entrada escalonada (`index`): nombre del cliente en `text.heading`; dirección en `text.title` como elemento tocable que abre la navegación (`Linking.openURL("https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(dirección))`) y teléfono tocable que llama (`tel:`); ambos con el mínimo de 48 dp y con `try/catch` que muestra un aviso si el teléfono no puede abrirlos (sin `canOpenURL`, que en Android 11+ exige declarar `<queries>`).
  - `StatusPill` con `out_for_delivery`; si hay comando en cola, `pending_sync` en vez del botón de entrega, más un texto "guardada, se enviará al volver la red" (distinto de una entrega ya registrada).
  - Acción primaria `Button` "Marcar entregado" en la **barra inferior fija** (`ScreenLayout` con `scroll={false}` y `bottomBar`; zona del pulgar, 56 dp), según el documento de justificación. Actúa sobre la **orden seleccionada**: por defecto la más antigua; tocar otra tarjeta la selecciona y se marca con borde y el texto "Seleccionada" (no solo con color). La lista es una `FlatList` con pull-to-refresh.
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

- [ ] **Step 1 (owner, manual): proveer las credenciales de R2** del bucket **ya existente** (reusado, no uno nuevo; bucket `sweet-delivery`, cuenta `b798b0b01ea8805faa0bb16b07e6c4f4`; el agente puede documentar `R2_ACCOUNT_ID` y `R2_BUCKET` en `CLAUDE.md`, pero las claves las declara el owner) en `apps/web/.env.local` y en las variables de runtime del servicio en EasyPanel. El bucket debe ser **privado**. Sin ellas, los endpoints responden 503 y todo lo demás sigue funcionando. El agente no declara estas variables.
- [ ] **Step 2: Tests de dominio** (`recordDeliveryEvidence`): registra con usuario asignado en `out_for_delivery` y en `delivered`; rechaza usuario no asignado, estado `ready_for_pickup`, `lat` 91, `lng` -181, `key` vacía, orden inexistente. Extender `makeFakeOrderRepo` y todo implementador de `OrderRepository` con el método nuevo.
- [ ] **Step 3: Tests de `delivery-evidence-key`**: `buildEvidenceKey("delivery-evidence/", "o1", "u1") === "delivery-evidence/o1/u1.jpg"`; `isEvidenceKeyForOrder` es `true` para esa clave con `"o1"` y `false` con `"o2"` o con un prefijo distinto.
- [ ] **Step 4: Tests del adaptador y de los endpoints**: sin variables R2 el adaptador lanza `EvidenceStorageNotConfiguredError` y el endpoint responde 503; con `requireMobileAuth` mockeado devolviendo rol `despachador` ambos endpoints responden 403; `POST .../evidence` con una `key` de otra orden responde 409.
- [ ] **Step 5: Correr y ver fallar**
  Run: `pnpm --filter @workspace/domain exec vitest run src/orders && pnpm --filter @workspace/web exec vitest run src/lib src/infra src/app/api/mobile/orders`
  Expected: FAIL.
- [ ] **Step 6: Implementar** todo lo listado. `recordDeliveryEvidence` en Drizzle hace un `update` de las cuatro columnas. En el adaptador R2: endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, región `"auto"`; dejar en un comentario la política de retención (7 días por defecto, ampliable a 30, pendiente de confirmación legal; la regla de ciclo de vida del bucket es una tarea de infraestructura aparte).
- [ ] **Step 7: Aplicar el esquema a la base compartida (lo hace el agente, sin pedir permiso)** — `pnpm --filter @workspace/db run push`. Las columnas son nullable y el booleano tiene valor por defecto: aditivo, nunca `--force`. **Orden estricto:** el esquema se aplica y se comprueba **antes** de usar las columnas en cualquier código que se ejecute contra la base (es la misma base dev=prod). Verificación inmediata: `pnpm --filter @workspace/db exec vitest run src/repositories/order-repository.test.ts src/repositories/settings-repository.test.ts` debe pasar. No desplegar el código de esta tarea antes de este paso.
- [ ] **Step 8: Verificar**
  Run: `pnpm run typecheck && pnpm run test`
  Expected: PASS (los tests de `packages/db` golpean la base real: limpiar lo que creen).
- [ ] **Step 9: Stage y commit sugerido**
  `git add packages apps/web pnpm-lock.yaml CLAUDE.md`
  Sugerido: `git commit -m "Agrega el registro de evidencia de entrega con subida a R2 mediante URL prefirmada"`

---

### Task 13: Evidencia de entrega — app (foto + GPS)

> **Actualización de la ronda de decisiones:** el botón "Agregar foto de evidencia" es **opcional y no bloqueante**; es una acción primaria, así que va en el tercio inferior y mide al menos 56 dp. Los permisos de cámara y ubicación se piden solo al usar la función, no al abrir la app. La foto la ve solo el delivery que la tomó y el admin (histórico de entregas, Plan 2), nunca el cliente. Textos por `packages/i18n`. El `PUT` a la URL prefirmada **debe enviar la cabecera `Content-Type: image/jpeg`** (la URL la firma, Task 12). Retención documentada en `handoff.md`: 7 días por defecto, ampliable a 30, pendiente de confirmación legal.

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
  Expected: PASS. La captura real (cámara/GPS) se comprueba en dispositivo en Task 20.
- [ ] **Step 6: Stage y commit sugerido**
  `git add apps/mobile packages/i18n pnpm-lock.yaml`
  Sugerido: `git commit -m "Agrega captura de foto y GPS como evidencia opcional de entrega en la app"`

---

### Task 14: Despachador e inicio de sesión con el sistema de diseño; despachador sin crash sin red

> **Alcance actual (solo delivery):** se reconstruye **solo el inicio de sesión** (lo usa el delivery). La pantalla del despachador queda como está y sigue en la lista de excepciones del test de reglas de diseño; se retoma cuando el alcance incluya al despachador.

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
  Expected: PASS (incluye `design-rules.test.ts` sobre las tres pantallas). El comportamiento sin red y la revisión visual se comprueban en dispositivo (Task 20).
- [ ] **Step 5: Stage y commit sugerido**
  `git add apps/mobile/src packages/i18n`
  Sugerido: `git commit -m "Reconstruye el despachador y el inicio de sesion con el sistema de diseno y evita el crash sin red"`

---

### Task 15: Arreglos pendientes de revisión (D6): 408/429 y limpieza del flag de evidencia

Corrige dos hallazgos menores de las Tasks 10 y 12 que se decidió arreglar antes del merge. No reabre esas tareas más allá de estos dos puntos.

**Files:**
- Modify: `apps/mobile/src/offline/deliver-sender.ts`, `deliver-sender.test.ts`
- Modify: `packages/db/src/repositories/settings-repository.test.ts` (y cualquier otro test que active `deliveryEvidenceRequired`)

**Interfaces:**
- Consumes: `makeDeliverSender` y `SendResult` (Task 10). Reglas nuevas: **408 y 429 → `{ kind: "retry" }`** (fallos transitorios del servidor: nunca deben borrar el comando "entregada" de la cola). El resto de las reglas no cambia (2xx → ok; 401 → unauthorized; ≥ 500 → retry; otro estado → conflict).

- [ ] **Step 1: Tests primero (TDD)** en `deliver-sender.test.ts`: 408 → `retry` y 429 → `retry` (RED: hoy dan `conflict`). Además un test que fije que 400, 403, 404 y 409 siguen siendo `conflict`.
- [ ] **Step 2: Correr y ver fallar**
  Run: `pnpm --filter mobile run test`
  Expected: FAIL en los dos casos nuevos.
- [ ] **Step 3: Implementar** el cambio de clasificación en `makeDeliverSender`.
- [ ] **Step 4: Limpieza garantizada del flag.** En `settings-repository.test.ts`, el test que activa `deliveryEvidenceRequired: true` debe: leer y **guardar el valor original** (sin suponer `false`; el owner puede haberlo activado en la base real), cambiarlo dentro de un `try` y restaurar el original en `finally` (o `afterEach`), de modo que una aserción fallida a mitad de camino no deje el flag en `true` en la base compartida. Mismo patrón para cualquier test que toque ese flag.
- [ ] **Step 5: Verificar**
  Run: `pnpm --filter mobile run test && pnpm --filter mobile run typecheck && pnpm --filter @workspace/db exec vitest run src/repositories/settings-repository.test.ts`
  Expected: PASS. (El test de base de datos requiere que el esquema de la Task 12 ya esté aplicado; es la misma base compartida dev=prod: deja el flag exactamente como lo encontró.)
- [ ] **Step 6: Stage y commit sugerido**
  `git add apps/mobile/src/offline packages/db/src/repositories`
  Sugerido (lo ejecuta el owner): `git commit -m "Reintenta ante 408 y 429 en la cola de entregas y garantiza la limpieza del flag de evidencia en los tests"`

---

### Task 16: Build de desarrollo permanente (D5)

Pieza **permanente** del proyecto (no desechable): un APK aparte, con `expo-dev-client`, para iterar la UI con recarga en vivo. **No reabre la decisión de no usar `expo-dev-client` en el build de release**: el de desarrollo es una variante nueva y separada.

**Files:**
- Create: `apps/mobile/app.config.ts` (+ `app.config.test.ts`)
- Create: `.github/workflows/build-dev-apk.yml`
- Modify: `.github/workflows/build-apk.yml` (nueva comprobación de que el release no incluye el cliente de desarrollo)
- Modify: `apps/mobile/package.json` (`pnpm --filter mobile exec expo install expo-dev-client`)
- Modify: `CLAUDE.md` (Run & Operate)

**Interfaces:**
- Produces: `apps/mobile/app.config.ts` exporta una función `({ config }: ConfigContext) => ExpoConfig` que parte de `app.json` y, **solo si** `process.env.APP_VARIANT === "development"`, sobrescribe: `name` → `"Sweet Sin Staff (Dev)"`, `android.package` → `"au.com.sweetsin.staff.dev"` y el `backgroundColor` del ícono adaptativo a un color claramente distinto del de producción (el Dorado de la paleta), para que **nunca** se confunda con el de producción en el mismo teléfono. Sin la variable, devuelve `app.json` sin cambios (el build de release no se altera).
- Produces: workflow `build-dev-apk.yml` (`workflow_dispatch`, sin secretos): mismo gate que el release, `APP_VARIANT=development`, `expo prebuild --platform android --clean --no-install` y `./gradlew assembleDebug` (la clave de **debug** automática de Gradle firma el APK; no se usa el keystore de release), comprobación con `aapt2` de `package: name='au.com.sweetsin.staff.dev'` y `application-label='Sweet Sin Staff (Dev)'`, y artefacto `sweetsin-staff-dev-<run_number>`.

- [ ] **Step 1: Tests** (`app.config.test.ts`): sin `APP_VARIANT` → `android.package === "au.com.sweetsin.staff"` y `name === "Sweet Sin Staff"`; con `APP_VARIANT=development` → `android.package === "au.com.sweetsin.staff.dev"`, `name === "Sweet Sin Staff (Dev)"` y `backgroundColor` distinto del de producción; `app.json` no se modifica.
- [ ] **Step 2: Correr y ver fallar**
  Run: `pnpm --filter mobile run test`
  Expected: FAIL (el módulo no existe).
- [ ] **Step 3: Implementar** `app.config.ts`, instalar `expo-dev-client` con `expo install` y escribir `build-dev-apk.yml` siguiendo la estructura de `build-apk.yml` (mismas versiones de acciones; leer antes los docs de Expo SDK 57 sobre variantes de app y `expo-dev-client`).
- [ ] **Step 4: Comprobación en el workflow de release (pregunta Q10):** en `build-apk.yml`, tras construir, fallar si el manifiesto del APK de release contiene `expo.modules.devlauncher` o `expo.modules.devmenu` (`aapt2 dump xmltree --file AndroidManifest.xml <apk>`). Si apareciera en un release real, resolverlo según los docs de `expo-dev-client` (que el cliente quede solo en builds debug) y anotarlo en `handoff.md`.
- [ ] **Step 5: Documentar en `CLAUDE.md` (Run & Operate):** cómo se genera el build de desarrollo; cómo correr `APP_VARIANT=development npx expo start --dev-client` (y `--tunnel` si el teléfono no está en la misma red; `@expo/ngrok` ya es devDependency); la advertencia explícita de que **este build nunca debe llegar a un repartidor real** (si lo hace, la app queda rota porque intenta conectarse a un bundler que no existe); y la nota de mantenimiento: cada vez que se agregue un módulo nativo (cámara, GPS, SQLite, mapas, tareas en segundo plano) hay que **recompilar el build de desarrollo una vez** para que lo incluya.
- [ ] **Step 6: Verificar**
  Run: `pnpm --filter mobile run test && pnpm --filter mobile run typecheck && pnpm dlx @action-validator/cli .github/workflows/build-dev-apk.yml && pnpm dlx @action-validator/cli .github/workflows/build-apk.yml`
  Expected: PASS, validadores sin errores. El workflow nunca se ha ejecutado en GitHub: lo despacha el owner tras el push.
- [ ] **Step 7: Stage y commit sugerido**
  `git add apps/mobile .github/workflows CLAUDE.md pnpm-lock.yaml`
  Sugerido (lo ejecuta el owner): `git commit -m "Agrega el build de desarrollo permanente con expo-dev-client y su variante .dev"`

---

### Task 17: Ruta dibujada y ETA con tráfico para el delivery

Herramienta **interna de staff**: nada de esto se expone al cliente (Plan 3). Usa Google Maps Platform. La ruta es una referencia visual: no hay navegación giro a giro ni voz; para navegar de verdad queda el botón que abre la app nativa de Google Maps (Task 11).

**Files:**
- Create: `packages/domain/src/routing/{entities,ports,use-cases}.ts` (+ tests), export `"./routing"` en `packages/domain/package.json`
- Create: `apps/web/src/infra/google-routes-planner.ts` (+ test), `apps/web/src/infra/caching-route-planner.ts` (+ test)
- Create: `apps/web/src/app/api/mobile/orders/[id]/route/route.ts` (+ test)
- Create: `apps/mobile/src/maps/{decode-polyline,format-eta}.ts` (+ tests), `apps/mobile/src/maps/RouteMap.tsx`
- Modify: `apps/mobile/src/screens/DeliveryQueueScreen.tsx`, `apps/mobile/app.config.ts` (clave del SDK de mapas), `.github/workflows/build-apk.yml` y `build-dev-apk.yml` (pasan el secreto al prebuild), `packages/i18n` (claves `staffApp` de ruta y ETA), `CLAUDE.md` (variables)

**Interfaces:**
- Produces (dominio):
  ```ts
  export interface LatLng { lat: number; lng: number }
  export interface RouteInfo { etaSeconds: number; distanceMeters: number; encodedPolyline: string; origin: LatLng; destination: LatLng; computedAt: Date }
  export interface RoutePlanner { computeRoute(origin: LatLng, destinationAddress: string): Promise<RouteInfo> }
  getRouteForOrder(deps: { orders: OrderRepository; planner: RoutePlanner }, orderId: string, actor: { userId: string; role: "delivery" }, origin: LatLng): Promise<RouteInfo>
  // rechaza: orden inexistente; actor distinto del delivery asignado; estado distinto de out_for_delivery; deliveryAddress nula; lat/lng fuera de rango o NaN
  ```
- Produces (servidor): `GET /api/mobile/orders/[id]/route?lat=<n>&lng=<n>` (rol `delivery`; 403 otro rol; 400 coordenadas inválidas; 404 orden inexistente; 409 regla de dominio; 503 `{ "error": "Routes service is not configured yet." }` si falta `GOOGLE_ROUTES_API_KEY`) → `200 RouteInfo` (con `computedAt` en ISO). `GoogleRoutesPlanner` llama a **Routes API** (`POST https://routes.googleapis.com/directions/v2:computeRoutes`, `X-Goog-Api-Key`, `X-Goog-FieldMask` mínimo `routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.endLocation`, `travelMode: "DRIVE"`, `routingPreference: "TRAFFIC_AWARE"`, destino por `address`) con validación **perezosa** de la clave (nunca simula un éxito; nunca usa la clave de la web). `CachingRoutePlanner(inner: RoutePlanner, opts: { ttlMs: 60_000; now?: () => number })` memoriza por orden + origen redondeado a 3 decimales (~100 m) para acotar el costo. Se elige Routes API y no la Directions API heredada (decisión del plan; el costo del tráfico en vivo se documenta).
- Produces (app): `decodePolyline(encoded: string): LatLng[]`; `formatEta(etaSeconds: number, distanceMeters: number, locale: Locale): string` → `"12 min · 3.4 km"` (en) y `"12 min · 3,4 km"` (es); menos de 60 s → `"< 1 min"`; ≥ 3600 s → `"1 h 5 min"`; menos de 1000 m → `"850 m"`. `RouteMap({ route: RouteInfo; height: number })` dibuja la polilínea y los marcadores con la librería de mapas que los docs de Expo SDK 57 recomienden para Google Maps en Android (`react-native-maps` o `expo-maps`: **verificar y registrar la elección**). La clave del SDK de mapas es una clave **pública restringida** por paquete y huella SHA-1 (no es un secreto, pero va restringida) y se inyecta en `app.config.ts` desde la variable `GOOGLE_MAPS_ANDROID_API_KEY` durante el prebuild.
- Variables nuevas: `GOOGLE_ROUTES_API_KEY` (**servidor**, en `.env.local` y EasyPanel, declarada por el owner; distinta de la clave de la web) y el secreto de GitHub `GOOGLE_MAPS_ANDROID_API_KEY` (lo carga el owner; pregunta Q5).

- [ ] **Step 1: Tests primero:**
  - dominio: acepta al delivery asignado con la orden `out_for_delivery`; rechaza a otro delivery, otro estado, dirección nula, `lat` 91, `lng` -181 y `NaN`.
  - `decodePolyline`: con el ejemplo canónico de la documentación de Google (3 puntos: 38.5/-120.2, 40.7/-120.95, 43.252/-126.453) y con la cadena vacía (devuelve `[]`).
  - `formatEta`: los cuatro formatos y ambos idiomas.
  - `CachingRoutePlanner`: segunda llamada con el mismo origen redondeado no llama al planificador interno; origen a más de ~100 m o TTL vencido sí llama; el tiempo se inyecta.
  - `GoogleRoutesPlanner` con `fetch` simulado: envía las cabeceras y el cuerpo exactos del contrato y mapea la respuesta a `RouteInfo`; sin clave lanza `RoutesNotConfiguredError`.
  - endpoint: 403 para `despachador`, 400 por coordenadas inválidas, 503 sin clave, 200 con planificador simulado.
- [ ] **Step 2: Correr y ver fallar**
  Run: `pnpm --filter @workspace/domain exec vitest run src/routing && pnpm --filter @workspace/web exec vitest run src/infra src/app/api/mobile/orders && pnpm --filter mobile run test`
  Expected: FAIL.
- [ ] **Step 3: Implementar** dominio, planificador, caché, endpoint y utilidades puras (leer en los docs de Expo SDK 57 el módulo de mapas y su plugin; si el módulo elegido exige configuración de `app.config.ts`, hacerla aquí).
- [ ] **Step 4: Integrar en `DeliveryQueueScreen`** con el kit de diseño: en cada tarjeta, el ETA como texto corto (p. ej. "12 min · 3.4 km") y una sección "Ver ruta" que despliega `RouteMap`. El origen sale de `expo-location` en primer plano (permiso pedido al usar la función). Si no hay permiso, red o respuesta (503/409), la tarjeta se muestra sin ETA y con un mensaje discreto; **nunca bloquea "Marcar entregado"**. No recalcular más seguido que la caché del servidor (refrescar al abrir y por pull-to-refresh, no por temporizador). Textos nuevos por `packages/i18n`.
- [ ] **Step 5: Documentar** en `CLAUDE.md` las dos variables y en `handoff.md` el riesgo de costo: cada cálculo de ruta con tráfico es una llamada paga a Google Maps Platform; sin la caché el costo escala con las entregas diarias.
- [ ] **Step 6: Verificar**
  Run: `pnpm run typecheck && pnpm --filter @workspace/domain exec vitest run && pnpm --filter @workspace/web exec vitest run && pnpm --filter mobile run test && pnpm --filter mobile exec expo export --platform android`
  Expected: PASS y el bundle JS se genera. La prueba con mapas reales requiere las claves (owner) y el build de desarrollo (Task 16).
- [ ] **Step 7: Stage y commit sugerido**
  `git add packages apps .github CLAUDE.md pnpm-lock.yaml`
  Sugerido (lo ejecuta el owner): `git commit -m "Agrega la ruta dibujada y el ETA con trafico para el delivery mediante Google Routes"`

---

### Task 18: Turno del delivery y seguimiento de ubicación en vivo

> **Alcance actual (solo delivery):** se implementa el lado delivery (registro y fin de turno, `PUT` y `DELETE /api/mobile/location`, turno y seguimiento en la app). Se **difieren** a la Task 19 `listSince`, `listFleetPositions` y `GET /api/mobile/fleet` (los usa el despachador) y sus tests.

Guarda la **última ubicación conocida** de cada delivery en turno. Se diseña para que el Plan 3 (panel del cliente: "tu pedido está a 8 minutos") solo tenga que **agregar un consumidor** del mismo dato, sin rediseñar el almacenamiento; esa pantalla de cliente **no se construye** aquí.

**Files:**
- Create: `packages/domain/src/delivery-tracking/{entities,ports,use-cases}.ts` (+ tests), export `"./delivery-tracking"` en `packages/domain/package.json`
- Create: `packages/db/src/schema/delivery-locations.ts` (+ export), `packages/db/src/repositories/delivery-location-repository.ts` (+ test)
- Create: `apps/web/src/app/api/mobile/location/route.ts`, `apps/web/src/app/api/mobile/fleet/route.ts` (+ tests)
- Create: `apps/mobile/src/tracking/{haversine,send-policy,shift}.ts` (+ tests de las dos primeras), `ShiftToggle` y la pantalla de consentimiento en `apps/mobile/src/design-system` y `src/screens`
- Modify: `apps/mobile/app.config.ts` (plugin de `expo-location` con segundo plano y servicio en primer plano), `apps/mobile/src/screens/DeliveryQueueScreen.tsx`, `apps/mobile/index.ts` (definición de la tarea en segundo plano a nivel de módulo), `packages/i18n`, `handoff.md`

**Interfaces:**
- Produces (dominio):
  ```ts
  export interface DeliveryLocation { userId: string; lat: number; lng: number; accuracyMeters: number | null; recordedAt: Date }
  export interface DeliveryLocationRepository {
    upsert(location: DeliveryLocation): Promise<void>;
    findLatest(userId: string): Promise<DeliveryLocation | null>;
    listSince(since: Date): Promise<(DeliveryLocation & { userName: string })[]>;
    remove(userId: string): Promise<void>;
  }
  recordDeliveryLocation(deps: { locations: DeliveryLocationRepository; users: UserRepository }, input: { userId: string; lat: number; lng: number; accuracyMeters: number | null; recordedAt: Date }, now?: Date): Promise<void>
  // rechaza: usuario que no es un delivery activo; lat/lng fuera de rango o NaN; recordedAt más de 1 min en el futuro o de más de 10 min de antigüedad
  endDeliveryShift(deps: { locations: DeliveryLocationRepository }, userId: string): Promise<void>
  listFleetPositions(deps: { locations: DeliveryLocationRepository }, now: Date, opts?: { staleAfterMs?: number; dropAfterMs?: number }): Promise<{ userId: string; name: string; lat: number; lng: number; recordedAt: Date; stale: boolean }[]>
  // stale = más de 5 min (por defecto); se descartan las de más de 30 min
  ```
- Produces (servidor): tabla `delivery_locations` (`user_id` uuid clave primaria referenciando `users`, `lat` y `lng` doble precisión, `accuracy_m` real nulo, `recorded_at` timestamp con zona, no nulo: **solo la última posición, sin historial**). `PUT /api/mobile/location` (rol `delivery`; cuerpo `{ lat, lng, accuracyMeters?, recordedAt }` validado con zod; 403/400/200), `DELETE /api/mobile/location` (rol `delivery`: termina el turno y borra la posición) y `GET /api/mobile/fleet` (rol `despachador`) → `{ positions: [...] }`.
- Produces (app): `distanceMeters(a: LatLng, b: LatLng): number` (haversine); `shouldSendLocation(prev: { lat: number; lng: number; atMs: number } | null, next: { lat: number; lng: number; atMs: number }, opts: { minIntervalMs: 20_000; minDistanceMeters: 30 }): boolean`; `ShiftToggle` ("Iniciar turno" / "Terminar turno") con `StatusPill` "en turno". El estado de turno persiste en `expo-secure-store` para sobrevivir a un reinicio de la app.

- [ ] **Step 1: Tests primero:**
  - dominio con repositorio falso en memoria: registra para un delivery activo; rechaza customer/admin/despachador, delivery inactivo, coordenadas fuera de rango y `NaN`, fecha futura y fecha vieja; `endDeliveryShift` borra; `listFleetPositions` marca `stale` pasados 5 min y descarta pasados 30.
  - `distanceMeters`: mismo punto → 0; un grado de latitud ≈ 111 195 m (tolerancia ±200 m).
  - `shouldSendLocation`: sin previo → `true`; antes de 20 s y a menos de 30 m → `false`; pasados 20 s → `true`; a más de 30 m antes de 20 s → `true`.
  - endpoints: `PUT` y `DELETE` responden 403 a roles distintos de `delivery`; `GET /fleet` responde 403 a roles distintos de `despachador`; 400 por cuerpo inválido.
  - repositorio Drizzle (escrito; correr tras el `push`): `upsert` dos veces deja una sola fila; `remove` la borra; limpia lo que crea.
- [ ] **Step 2: Correr y ver fallar**
  Run: `pnpm --filter @workspace/domain exec vitest run src/delivery-tracking && pnpm --filter mobile run test && pnpm --filter @workspace/web exec vitest run src/app/api/mobile`
  Expected: FAIL.
- [ ] **Step 3: Implementar dominio, utilidades de la app y endpoints.**
- [ ] **Step 4: Aplicar el esquema (lo hace el agente, sin pedir permiso):** `pnpm --filter @workspace/db run push` (tabla nueva: aditivo) y luego `pnpm --filter @workspace/db exec vitest run src/repositories/delivery-location-repository.test.ts`. El esquema se aplica y verifica **antes** de ejecutar código que use la tabla contra la base compartida dev=prod.
- [ ] **Step 5: Seguimiento en la app.** Seguir los docs de Expo SDK 57 para `expo-location` y `expo-task-manager` (`startLocationUpdatesAsync` con servicio en primer plano y notificación persistente, textos por `packages/i18n`; plugin de `expo-location` con `isAndroidBackgroundLocationEnabled` e `isAndroidForegroundServiceEnabled`). Flujo:
  1. "Iniciar turno" muestra, la primera vez, una pantalla de **consentimiento** (qué se recoge, solo durante el turno, quién lo ve —el despachador—, sin historial, y que se borra al terminar).
  2. Se pide el permiso en primer plano y luego el de segundo plano (el diálogo nativo de Android, "Permitir todo el tiempo", aparece aunque la APK no se distribuya por Google Play). Si el de segundo plano se **niega**, el seguimiento **degrada** a primer plano (solo con la app abierta) con un aviso claro y **sin cerrarse**.
  3. Cada posición se filtra con `shouldSendLocation` (20 s / 30 m) y se envía con `PUT /api/mobile/location`; un fallo de red se **descarta** (no se encola: solo importa la última posición).
  4. "Terminar turno", cerrar sesión o un 401 detienen la tarea y llaman a `DELETE /api/mobile/location`.
  El permiso de ubicación nunca se pide al abrir la app, solo al iniciar el turno. Es un módulo nativo nuevo: **recompilar el build de desarrollo** (Task 16).
- [ ] **Step 6: Documentar en `handoff.md`** como riesgos conocidos: consumo continuo de batería y datos del teléfono del delivery durante todo el turno; algunos fabricantes de Android matan los servicios en segundo plano (mitigación manual: excluir la app de la optimización de batería); y la **pendiente confirmación legal** del seguimiento de ubicación del personal (pregunta Q6).
- [ ] **Step 7: Verificar**
  Run: `pnpm run typecheck && pnpm --filter @workspace/domain exec vitest run && pnpm --filter @workspace/web exec vitest run && pnpm --filter mobile run test && pnpm --filter mobile exec expo export --platform android`
  Expected: PASS. El seguimiento real se prueba en teléfono (Task 20).
- [ ] **Step 8: Stage y commit sugerido**
  `git add packages apps handoff.md pnpm-lock.yaml`
  Sugerido (lo ejecuta el owner): `git commit -m "Agrega el turno del delivery y el seguimiento de su ultima ubicacion en vivo"`

---

### Task 19: Mapa de flota y ETA para el despachador

> **DIFERIDA por el alcance actual (solo delivery).** Incluye, cuando se retome, `listSince`, `listFleetPositions` y `GET /api/mobile/fleet` que se difirieron de la Task 18.

El despachador ve dónde está cada repartidor en turno. **Adaptación a tener en cuenta (pregunta Q11):** la cola del despachador solo contiene órdenes `received`, `in_prep` y `ready_for_pickup`; las que ya van en camino (`out_for_delivery`) no están en esa cola, así que el ETA del despachador se muestra **en el mapa de flota**, al tocar un repartidor, y no en las tarjetas de la cola.

**Files:**
- Modify: `packages/domain/src/routing/use-cases.ts` (+ tests), `apps/web/src/app/api/mobile/orders/[id]/route/route.ts` (rama del despachador), `apps/web/src/app/api/mobile/fleet/route.ts` (agrega `assignedOrders`)
- Create: `apps/mobile/src/maps/format-age.ts` (+ test), `apps/mobile/src/screens/FleetMapScreen.tsx`
- Modify: `apps/mobile/src/navigation/index.tsx` (pantalla "Mapa" del despachador), `apps/mobile/src/screens/DespachadorQueueScreen.tsx` (botón "Ver mapa"), `packages/i18n`

**Interfaces:**
- Produces: `getRouteForOrder` acepta además `actor: { userId: string; role: "despachador" }`; en ese caso el origen **no** viene del cliente: es `findLatest(order.assignedDeliveryUserId)` (puerto `DeliveryLocationRepository` de la Task 18) y, si no hay posición o está desactualizada, el endpoint responde `409 { "error": "no_location" }`. `GET /api/mobile/fleet` agrega por repartidor `assignedOrders: { id: string; customerName: string; deliveryAddress: string | null }[]` (órdenes `out_for_delivery` asignadas). `formatAge(seconds: number, locale: Locale): string` → `"hace 2 min"` / `"2 min ago"`, `"ahora"` / `"just now"` si < 30 s.

- [ ] **Step 1: Tests primero:** dominio (despachador con repositorio de ubicaciones falso: usa la última posición del delivery asignado; sin posición → error `no_location`; con posición desactualizada → `no_location`; el rol `delivery` sigue usando el origen del cliente); `formatAge` (tres rangos y ambos idiomas); endpoint (`GET .../route` de despachador: 409 `no_location` y 200 con posición; `GET /fleet` incluye `assignedOrders`).
- [ ] **Step 2: Correr y ver fallar**
  Run: `pnpm --filter @workspace/domain exec vitest run src/routing && pnpm --filter @workspace/web exec vitest run src/app/api/mobile && pnpm --filter mobile run test`
  Expected: FAIL.
- [ ] **Step 3: Implementar** la rama del despachador, `assignedOrders` y `formatAge`.
- [ ] **Step 4: `FleetMapScreen` con el kit de diseño:** mapa con un marcador por repartidor (nombre y antigüedad con `formatAge`); los **desactualizados** (más de 5 min) en gris con el texto "sin señal reciente" (no solo color); al tocar un repartidor, panel inferior con sus órdenes asignadas y el ETA de cada una (llamada a `GET .../route`, cacheada 60 s por el servidor); actualización por **polling** cada 20 s (sin WebSockets, restricción global); estados vacío ("ningún repartidor en turno"), sin conexión (banner) y error. Textos por `packages/i18n`. Acceso por botón "Ver mapa" en la pantalla del despachador.
- [ ] **Step 5: Verificar**
  Run: `pnpm run typecheck && pnpm --filter @workspace/domain exec vitest run && pnpm --filter @workspace/web exec vitest run && pnpm --filter mobile run test`
  Expected: PASS (incluye `design-rules.test.ts` sobre la pantalla nueva).
- [ ] **Step 6: Stage y commit sugerido**
  `git add packages apps`
  Sugerido (lo ejecuta el owner): `git commit -m "Agrega el mapa de flota y el ETA por repartidor para el despachador"`

---

### Task 20: Verificación en dispositivo y documentación

> **Alcance actual (solo delivery):** en el checklist se omiten los puntos del despachador (2 y 5) y el mapa de flota.

**Files:**
- Modify: `handoff.md` (5 secciones; agregar a "Intentos fallidos", no borrar; registrar retención de evidencia, riesgos de seguimiento y costos de Google Maps Platform, y las decisiones de arriba), `CLAUDE.md` (Where things live / Run & Operate: build de la APK por GitHub Actions y sus secretos, build de desarrollo, modo offline del delivery, evidencia de entrega y su flag, mapas/ETA/seguimiento y sus variables; quitar de Architecture decisions la nota de `notifyNewOrderInQueue` sin caller y de Gotchas la costura de `/admin/orders`, ya resueltas en las Tasks 3 y 4; fusionar los dos paréntesis seguidos de la línea 65 que quedaron de la Task 2)

- [ ] **Step 1 (owner): despachar los workflows con el código final** (release y desarrollo), bajar las APK de los artefactos e instalarlas en un teléfono Android real.
- [ ] **Step 2 (owner o agente con el owner presente): checklist en dispositivo.** El push **no** está en la lista (descartado, D1):
  1. Login con PIN como despachador y como delivery.
  2. Despachador: avanzar una orden y asignar delivery.
  3. Delivery en modo avión: la lista asignada sigue visible desde la caché; marcar entregada → "pendiente de sincronizar" (con **ícono + texto**, no solo el borde dorado).
  4. Desactivar modo avión: en ≤ 30 s la orden pasa a `delivered` en la base, sin duplicados.
  5. Despachador en modo avión: no se cierra la app y se muestra el banner.
  6. Evidencia: tomar foto → "evidencia enviada" (el objeto existe en R2 bajo el prefijo configurado y la orden tiene clave, fecha y coordenadas); **negar el permiso de cámara o ubicación** muestra un aviso claro y "Marcar entregado" sigue funcionando.
  7. Los **glifos Unicode** de estado se ven igual en al menos dos fabricantes distintos de Android, si es posible.
  8. **Mapa con ruta y ETA** en la tarjeta de la orden del delivery.
  9. **Seguimiento en vivo:** "Iniciar turno" con consentimiento; el despachador ve la posición del delivery actualizarse; aceptar el permiso de ubicación en segundo plano y comprobar que **negarlo degrada con aviso, sin cerrarse**; "Terminar turno" borra la posición.
  10. El **build de desarrollo y el de producción conviven** instalados en el mismo teléfono sin pisarse (nombre e ícono distintos).
  11. Cambiar el idioma del teléfono entre español e inglés y reabrir la app: los textos cambian.
- [ ] **Step 3 (owner): revisión de calidad visual y de usabilidad** (los criterios de "Criterios de calidad de UI", sobre inicio de sesión, delivery, despachador, mapa de ruta y mapa de flota):
  1. **Identidad:** ícono en el lanzador (normal y redondo; temático en Android 13+), splash, nombre "Sweet Sin Staff".
  2. **Tipografía:** Atkinson Hyperlegible (y la del wordmark) se ven y la app abre sin red con ellas.
  3. **Escala de fuente** al 100 %, 130 % y 200 %: nada se corta ni se solapa.
  4. **Reducir movimiento:** sin entradas animadas y GIF reemplazados por la mascota estática.
  5. **Accessibility Scanner de Google** sobre cada pantalla: sin avisos de área tocable ni de contraste.
  6. **Pleno sol** y **una mano** (las acciones primarias, de 56 dp, se alcanzan con el pulgar).
  7. **Capturas de cada estado** (`adb exec-out screencap -p > estado.png`) contrastadas con los criterios.
  8. **Fluidez:** desplazamiento sin saltos con 20 órdenes de prueba; los GIF y los mapas no notan jank ni calor.
  Los ajustes se corrigen en `design-system/`, una sola vez para todas las pantallas.
- [ ] **Step 4: Limpiar los datos de prueba** (órdenes, posiciones de delivery, objetos de evidencia) de la base y del bucket.
- [ ] **Step 5: Actualizar `handoff.md` y `CLAUDE.md`.**
- [ ] **Step 6: Stage y commit sugerido**
  `git add handoff.md CLAUDE.md apps`
  Sugerido (lo ejecuta el owner): `git commit -m "Documenta la APK de staff, su sistema de diseno, el modo offline, la evidencia, los mapas y el seguimiento"`

---

## Self-review

- **Cobertura del prompt de decisiones del owner (secciones 1 a 14 y regla de quién ejecuta qué):**
  - Regla fija → sección "Quién ejecuta qué".
  - §1 diseño visual → Task 9 (actualización al inicio de la tarea), "Criterios de calidad de UI" y Task 20; ya sin bloqueo (Q1 resuelta).
  - §2 build de desarrollo permanente → Task 16.
  - §3 y §4 (408/429 y limpieza del flag) → Task 15.
  - §5 esquema de evidencia, agente aplica el `push` primero → Task 12, paso 7.
  - §6 evidencia → Tasks 12 y 13 (ya definidas; se añade confirmar el bucket de R2, pregunta Q4).
  - §7 mapas, ETA y tracking → Tasks 17, 18 y 19, con una adaptación en el despachador (Q11).
  - §8 `updateOrderStatusAction` → Task 4 (completa).
  - §9 i18n → Global Constraints y cada tarea nueva.
  - §10 `notifyNewOrderInQueue` → Task 3 (completa).
  - §11 push descartado → Task 8 marcada como descartada.
  - §12 a §14 sin cambios.
- **Conflictos detectados y no resueltos por el prompt:** Q1 a Q11 de "Preguntas abiertas"; los de mayor impacto son Q1 (falta el documento), Q2 (paleta nueva frente a íconos ya generados) y Q5/Q6 (Google Cloud y consentimiento de seguimiento).
- **Orden de dependencias:** el esquema se aplica antes de usar columnas o tablas (Tasks 12 y 18); la 16 (build de desarrollo) va antes de las pantallas; la 18 (ubicación) antes de la 19 (despachador usa la última ubicación); la 17 usa el origen del teléfono del delivery.
- **Consistencia de tipos:** `LatLng`, `RouteInfo`, `RoutePlanner` (Task 17) los usan la Task 19 y la app; `DeliveryLocationRepository` (Task 18) lo consume la Task 19; `DeliverCommand`, `SendResult` y `AssignedOrder` siguen definidos una sola vez (Tasks 10 y 11).
- **Proporción:** las tareas nuevas llevan firmas, contratos y tests nombrados; solo las reglas de clasificación, los umbrales de envío y la política de caché llevan valores explícitos porque las firmas no los determinan.
