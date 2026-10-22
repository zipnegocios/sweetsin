# Diseño: evolución de `apps/mobile` a APK multi-rol (Android-only)

## Context

`apps/mobile` hoy son ~329 líneas (3 pantallas, cliente HTTP, PIN login) y solo cubre despachador y delivery, corriendo bajo Expo Go. Tras la evaluación crítica se decidió:

- **Se descarta Expo Go** (no soporta push remoto desde SDK 53 ni módulos nativos propios) y **se descarta iOS/IPA** (la distribución fuera de la App Store caduca o exige registrar cada teléfono).
- **Alcance:** una sola APK Android con 3 roles: despachador, delivery y **administrador** (nuevo, con la misma funcionalidad del panel web adaptada a usabilidad móvil).
- **Fuera de este plan:** módulo TV (menú + cola del trailer, se planifica después) y pedidos presenciales en el trailer (el admin solo ve pedidos online por ahora).

## Objetivos

1. APK firmada, compilada con `expo prebuild` + Gradle en **GitHub Actions propio**, que corre tests antes de publicar. Se instala por enlace (APK sin cifrar, ver decisión de seguridad).
2. Rol **admin** en la APK con: Órdenes, Paradas y stock, Eventos y calendario (no Staff en v1).
3. Rol **delivery** tolerante a cortes de red cortos (minutos): ve sus órdenes asignadas sin conexión y puede marcar entregada en cola.
4. Despachador y admin trabajan **solo en línea**, con aviso visible de "sin conexión".
5. Push real probado en un build real (deuda abierta de Fase 7).

## No-objetivos

- iOS/IPA, Expo Go, WebView/PWA embebida, módulo TV, pedidos presenciales, gestión de staff en la APK, sincronización bidireccional de tablas (PowerSync/ElectricSQL), WebSockets/SSE.

## Anti-objetivos (propuestos, a corregir)

- Una tarea del admin que requiere **más toques en la APK que en la web**.
- Un delivery que **pierde o duplica una entrega** por un corte de red.
- Una orden en estado imposible por escribir desde el teléfono sin pasar por las reglas de `packages/domain`.
- La APK que **solo funciona si alguien recuerda renovar** algo (sin caducidades como las de iOS).

## Decisiones tomadas por el usuario

- Login admin: **email + contraseña + biométrico** (huella) para reabrir.
- Build y entrega: **GitHub Actions propio** (repo público `zipnegocios/sweetsin`; hoy no existe `.github/`).
- **Quitar la firma HMAC del login** (`EXPO_PUBLIC_APP_SECRET`, `verifyAppSignature`, `crypto-js`): la clave viaja dentro de cualquier APK y es extraíble; la seguridad real es credenciales + bloqueo por intentos + JWT corto + `is_active`. Consecuencia: la APK no lleva secretos y no hace falta cifrarla.
- Un solo comercio: sin multi-tenant. Si hay más sucursales, el login pide elegir sucursal.
- Offline solo para **delivery**; fundamento: es el único que puede entrar a zonas sin datos. Cobertura de Adelaide metropolitana en general buena; zonas grises conocidas en Adelaide Hills/Mt Barker (programa PIR SA, Black Spots). No hay dato público fino por suburbio.

## Decisiones propias (marcadas como mías, corregibles)

- **Autoridad en el servidor.** El teléfono nunca decide estado. Offline = (a) caché de solo lectura de las órdenes asignadas (incluye dirección y teléfono del cliente), (b) cola local de comandos pendientes que se reenvían a `/api/mobile/**` al volver la red. El servidor valida con los mismos casos de uso de `packages/domain`.
- **Almacenamiento local:** `expo-sqlite`; sesión en `expo-secure-store` (ya existe). Los datos del cliente en la caché se borran al cerrar sesión y se limitan a las órdenes activas asignadas.
- **Idempotencia obligatoria.** Hoy `markOrderDelivered` (`packages/domain/src/orders/use-cases.ts:137`) falla con "Cannot mark delivered from status: delivered" si el comando se repite (respuesta perdida + reintento). Hay que hacer el reintento idempotente (devolver éxito si ya está `delivered` por el mismo usuario) y mostrar el conflicto real (p. ej. orden reasignada o cancelada) cuando el servidor rechace un comando de la cola.
- **API admin móvil:** `requireMobileAuth` (`apps/web/src/app/api/mobile/_lib/require-mobile-auth.ts`) hoy solo acepta `despachador|delivery` y `signMobileJwt` tiene el rol tipado igual. Se extiende al rol `admin` con login por email+contraseña (reusar `authenticateUser` del dominio), sin duplicar reglas. Los Route Handlers admin delegan en los mismos casos de uso/repositorios que las Server Actions `admin-orders.ts`, `admin-trailer-stops.ts`, `admin-event-bookings.ts`, `admin-calendar.ts` (las Server Actions no se pueden invocar desde la APK, hay que exponer Route Handlers delgados).
- **Gotcha heredado a resolver:** `updateOrderStatusAction` escribe cualquier `fulfillmentStatus` sin guardas. El endpoint admin móvil NO debe copiar eso: debe usar las transiciones de `packages/domain` (o se corrige la acción web a la vez).
- **Push:** `expo-notifications` en development build firmado (no Expo Go). Probar `notifyDeliveryAssigned` de punta a punta. Conectar `notifyNewOrderInQueue` (hoy sin caller) desde `confirmOrderPayment` es candidato natural, a decidir en el plan.
- **i18n:** la APK hoy tiene textos en español hardcodeados y no usa `packages/i18n`. A decidir en el plan si se reutilizan los diccionarios (patrón previsto en `CLAUDE.md` para mobile).
- **Realtime:** polling con refresco al volver al primer plano; sin WebSockets.
- **Archivos de config que faltan:** `app.json` sin `android.package`; no existe `eas.json` (no se usa EAS, así que no hace falta). Agregar `android.package`, firma de release (keystore en secretos del repo) y script `typecheck` en `apps/mobile/package.json` (hoy fuera del gate).

## Piezas del plan (orden sugerido)

1. Cimientos de build: `android.package`, `expo-dev-client`, `expo prebuild`, keystore de release como secreto, workflow `workflow_dispatch` (typecheck + tests → build Gradle → publicar APK en artefacto/Release), inspección del APK (`aapt2`: applicationId, versionCode, permisos). Primer APK instalado en un teléfono real y prueba de push.
2. Quitar HMAC (cliente y servidor + tests + variables de entorno + docs en `CLAUDE.md`).
3. Capa de datos: cliente API con manejo de red (detección con `fetch`, no `navigator.onLine`), SQLite, cola de comandos, idempotencia en el dominio (TDD).
4. Delivery offline: caché de asignadas + cola de "entregada" + estados de UI (pendiente de sincronizar, conflicto).
5. Rol admin: login email+contraseña + biométrico, API admin móvil, pantallas de Órdenes → Paradas y stock → Eventos y calendario.
6. Pulido y cierre: aviso "sin conexión" para despachador/admin, índice en `orders.assigned_delivery_user_id`, guard de middleware de `/dispatch` y `/delivery`, `handoff.md`.

## Verificación

- `pnpm run typecheck` y `pnpm run test` (incluido nuevo `typecheck` de `apps/mobile`).
- Tests de dominio para la idempotencia de `markOrderDelivered` y para las transiciones que use el admin.
- El workflow produce una APK cuyo `aapt2` dump muestra el `applicationId` y permisos esperados.
- Prueba manual en teléfono Android real: login de los 3 roles; delivery en modo avión → marcar entregada → reconectar → orden `delivered` en servidor sin duplicados; push de asignación recibido; biométrico del admin.
- Las pruebas contra Postgres real usan la base compartida dev=prod: crear y borrar datos de prueba con prefijo identificable.

## Reglas de proceso del proyecto (de `CLAUDE.md`)

- No ejecuto `git commit` ni creo branches; solo `git add` y sugiero el comando de commit en español, una línea, sin firmas.
- Reutilizar antes de crear; razonamiento en español con la estructura de 4 pasos; actualizar `handoff.md` al cerrar.

## Pendiente de confirmar contigo

- ¿Los anti-objetivos propuestos son los correctos?
- ¿i18n en la APK ahora o después?
- ¿Se conecta `notifyNewOrderInQueue` dentro de este plan?

## Enmienda 2026-10-20 (posterior a la aprobación)

Decisiones nuevas que reemplazan o amplían lo anterior. El plan que las implementa es `docs/superpowers/plans/2026-10-20-apk-fundacion-delivery-offline.md`.

- **i18n y `notifyNewOrderInQueue` entran al Plan 1** (antes quedaban fuera). Todo string nuevo de `apps/mobile` sale de `packages/i18n`; `confirmOrderPayment` mueve la orden a `received` y notifica a los despachadores.
- **Cambios de estado del panel admin pasan por el dominio.** Se corrige `updateOrderStatusAction` (gotcha de `/admin/orders`); marcar `paid` desde el admin corre `confirmOrderPayment`.
- **Evidencia de entrega opcional (foto + GPS) en R2**, por URL prefirmada generada en el servidor; flag `deliveryEvidenceRequired` en `settings` (inactivo). Retención 7 días (ampliable a 30), pendiente de confirmación legal.
- **Push se valida justo después del primer build.**
- **Sin guard adicional en logout/cola:** cada delivery usa su propio dispositivo.
- **Fuera de alcance, Plan 3:** confirmación del cliente, disputas/reclamos, estado `disputed` y vista de la evidencia para el cliente.
- **Plan 2** (admin en la APK) incluye ver la evidencia en el histórico de entregas.

## Enmienda 2026-10-20 (II): diseño UI/UX y sistema de diseño en mobile

La APK es una herramienta de trabajo (despachador en el trailer, delivery en la calle, admin) con la identidad de Sweet Sin. **Decisión del owner: hay dos design systems independientes.** El de la web ya existe y **no se toca** (`attached_assets/sweetsin-design-system_1786231311347.html` y `apps/web/src/app/globals.css`). El **design system de las apps móviles APK** se funda en el Plan 1: su documento es `docs/design/mobile-design-system.md` (fuente de verdad de diseño) y su código vive en `apps/mobile/src/theme/` y `apps/mobile/src/ui/`. Parte de la marca (paleta, tipografías, radios y voz, copiados una sola vez desde el sistema web como punto de partida) y desde entonces **evoluciona por su cuenta**: la app no importa nada de la web ni se verifica paridad con ella. Se diseña para una experiencia de app (gestos, zona del pulgar, estados de red, uso a una mano y a pleno sol), no se copia la web.

### Hechos del repositorio (verificados)

- Los íconos actuales de `apps/mobile/assets/` (`icon.png`, `android-icon-*.png`, `splash-icon.png`, `favicon.png`) son **los de la plantilla de Expo** (chevron azul): hay que reemplazarlos.
- Marca disponible: mascota diablito rojo (`attached_assets/favicon.png` 187×172; `apps/web/public/devil-icon.png` 373×343, misma mascota y es la fuente de mayor resolución del isotipo plano), logo completo plano (`apps/web/public/logo-flat.png` 1080×1080, fondo blanco), logo 3D (`attached_assets/logo-3d_…png` 2048×2048, estilo "peluche", distinto de la marca plana) y **dos animaciones GIF con transparencia y bucle infinito**: `apps/web/public/videologo.gif` (320×320, 226 cuadros, 8 s) e `apps/web/public/isotipo.gif` (200×180, 54 cuadros, 2,5 s, mascota guiñando).
- Identidad de partida (copiada una sola vez del sistema web, sin vínculo posterior): Sin Red `#E63946` (dark `#B82B36`, light `#FF5C6A`), Midnight Navy `#0F1B3D` (mid `#1A2F5F`, light `#253D78`), Arequipe Gold `#C9943A` (light `#F5D06B`), Cream `#F7F3EE` (dark `#EDE7DC`), Vanilla `#FDFAF7`, Abyss `#080D1A`. Tipografías: Fraunces (display/títulos), DM Sans (cuerpo), DM Mono (etiquetas, mayúsculas, +0.2em). Radios: botones y chips 100 px (píldora), tarjetas 20 px, bloques internos 14 px.

### Principios de la experiencia mobile (decisiones)

1. **Legibilidad y contraste primero.** Tema claro (Cream de fondo, Navy de texto; se mantiene `userInterfaceStyle: "light"`: se usa a pleno sol). Sin modo oscuro en esta etapa. Contraste mínimo WCAG AA: 4,5:1 para texto normal y 3:1 para texto grande (≥ 18 sp en negrita) y componentes. Cálculo propio: Sin Red `#E63946` sobre blanco ≈ 4,0:1, por lo que **el texto pequeño no va sobre relleno Sin Red ni en rojo sobre Cream**: el relleno de botón primario es Sin Red con etiqueta ≥ 18 sp en negrita, y el rojo de texto/enlaces sobre fondo claro usa Sin Red Dark (≈ 6:1).
2. **Zona del pulgar y uso a una mano.** Acción primaria de cada tarjeta a todo el ancho, abajo, de 52 dp de alto; cualquier elemento tocable ≥ 48×48 dp con separación ≥ 8 dp. Navegación inferior de 4 destinos solo para el admin (Plan 2), siguiendo el sistema de diseño (sticky, aparece al subir y se oculta al bajar).
3. **El estado nunca se comunica solo con color**: cada estado lleva texto y ícono (píldora de estado en DM Mono mayúsculas + glifo).
4. **Estados de red como ciudadanos de primera**: banner persistente "sin conexión" (Gold con texto Navy, `accessibilityLiveRegion="polite"`), marca "pendiente de sincronizar" por tarjeta, confirmación distinta según se haya registrado o solo encolado, errores accionables (qué pasó y qué hacer).
5. **Acciones nativas donde ahorran pasos**: en delivery, tocar la dirección abre la navegación del teléfono (`geo:`) y tocar el teléfono llama (`tel:`).
6. **Movimiento con propósito, heredado del sistema** (entrada de tarjetas con escalonado de 0,06 s y `easeOut`, retroalimentación de presión, banner que entra deslizando) usando la API `Animated` de React Native (sin dependencias nuevas). Se respeta "reducir movimiento" del sistema (`AccessibilityInfo`): sin animaciones de entrada y los GIF se reemplazan por la imagen estática. Nada se anima en bucle en pantallas de trabajo.
7. **Voz de marca solo donde no estorba**: sensual y ligera en estados vacíos y de éxito ("Forgive yourself" implícito); neutra, clara y sin humor en errores y en acciones críticas.
8. **Escala tipográfica respetada**: el texto escala con la configuración del sistema; ningún botón ni tarjeta se corta al 130 % ni al 200 %.
9. **Una sola orientación (vertical)**, áreas seguras respetadas, teclado que no tapa los campos del login.

### Identidad en la app

- **Ícono**: la mascota sobre fondo Midnight Navy (decisión: el diablito rojo resalta sobre Navy; se valida con una vista previa de máscara circular y cuadrada y se puede cambiar a Cream). Se usa `devil-icon.png` (373 px) como fuente del primer plano adaptativo: alcanza porque la zona visible del ícono adaptativo ocupa ≈ 288 px del lienzo de 432 px; **no** se usa `favicon.png` (187 px) porque quedaría pixelado. Para el ícono de 1024 px y la ficha del instalador conviene un SVG o PNG de mayor resolución de la mascota plana: pedírselo al diseñador; mientras tanto se escala el de 373 px.
- **Ícono monocromo** (íconos temáticos de Android 13+) y **ícono de notificación** (siluetas blancas sobre transparente, derivadas del canal alfa de la mascota; Android pinta de gris un ícono de notificación que no sea monocromo) con color de acento Sin Red.
- **Splash**: mascota estática centrada sobre Navy (Android 12+ solo admite imagen estática en el splash del sistema).
- **Animaciones de marca dentro de la app** (con `expo-image`, que reproduce GIF animados en Android): `videologo.gif` una vez en la pantalla de inicio de sesión y `isotipo.gif` como mascota de carga y de estados vacíos. Ambas con respaldo estático si "reducir movimiento" está activo o si la carga falla. Los GIF se copian a `apps/mobile/assets/brand/` (copia deliberada: la app no depende de la carpeta pública de la web).
- **Nombre visible**: "Sweet Sin Staff".

### Tokens y componentes

- Tokens en `apps/mobile/src/theme/` (TypeScript) en **tres capas** (base, semánticos y de componente), especificados en `docs/design/mobile-design-system.md`. Tests propios del design system mobile: **coherencia documento ↔ código** (la tabla de colores del documento coincide con `colors`) y **contraste** de los pares de colores permitidos. Tokens semánticos añadidos (decisión propia a validar con el diseñador): éxito `#2F7D5B`, advertencia = Gold, peligro = Sin Red Dark, información = Navy Light.
- Tipografías incluidas en la APK (no se descargan: la app debe abrir sin red) con `expo-font` y los paquetes `@expo-google-fonts/{fraunces,dm-sans,dm-mono}`; el splash se mantiene hasta que las fuentes cargan.
- Kit mínimo de componentes presentacionales, especificados en el documento (variantes, estados, medidas, contraste y accesibilidad) e implementados en `apps/mobile/src/ui/`: `Button`, `Card`, `StatusPill`, `ScreenHeader`, `EmptyState`, `BrandMark`, `OfflineBanner`. Las pantallas se construyen solo con estos y con los tokens.
- **Plan 2 (admin)** aplica el mismo kit: navegación inferior de 4 destinos, listas con filtros como chips desplazables con anclaje, detalle con acción primaria abajo, y el calendario adaptado a móvil.
