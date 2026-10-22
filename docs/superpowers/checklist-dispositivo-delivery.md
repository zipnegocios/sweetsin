# Checklist en dispositivo: APK de delivery

Verificación manual en un teléfono Android real (Task 20, Steps 2 y 3). Solo flujos del delivery: el despachador, el mapa de flota, el admin y el push quedan fuera (diferidos o descartados).

## Antes de empezar

- [ ] Los workflows `build-apk.yml` (release) y `build-dev-apk.yml` (desarrollo) terminaron en verde con el código final, y bajaste los dos APK de los artefactos (`sweetsin-staff-<n>` y `sweetsin-staff-dev-<n>`).
- [ ] Están cargados los secretos de GitHub (`ANDROID_KEYSTORE_*`, `ANDROID_KEY_*`, `GOOGLE_MAPS_ANDROID_API_KEY`) y, en el servidor, `R2_*`, `GOOGLE_ROUTES_API_KEY` y `MOBILE_JWT_SECRET`.
- [ ] Hay un usuario `delivery` con PIN de 6 dígitos y al menos 3 órdenes pagadas (`paid`) asignadas a él, con dirección real. Una de ellas servirá para la prueba de evidencia y otra para la de modo avión.
- [ ] Tienes acceso de lectura a la base (órdenes y `delivery_locations`) y al bucket `sweet-delivery` de R2 para comprobar resultados.
- [ ] Instalaste el APK de **release** en el teléfono. Para los puntos marcados "(desarrollo)" usa además el de desarrollo.

## 1. Inicio de sesión

- [ ] **PIN correcto.** Abre la app, ingresa email y PIN del delivery. Esperado: entra a la lista de órdenes asignadas.
- [ ] **PIN incorrecto.** Ingresa un PIN equivocado. Esperado: mensaje de error claro, sin cerrarse la app; tras varios intentos fallidos aparece el bloqueo temporal.
- [ ] **Sin red al iniciar sesión.** En modo avión intenta entrar. Esperado: aviso "No connection" / "Sin conexión", sin cuelgue.
- [ ] **Cerrar sesión.** Usa "cerrar sesión". Esperado: vuelve al login y al volver a abrir no hay datos de clientes visibles sin iniciar sesión.

## 2. Lista y modo offline

- [ ] **Lista asignada.** Con red, la lista muestra solo las órdenes asignadas a este delivery. Esperado: tarjetas con estado, dirección y total; la más antigua queda seleccionada por defecto.
- [ ] **Selección.** Toca otra tarjeta. Esperado: se marca con borde y el texto "Seleccionada"; la barra inferior actúa sobre ella.
- [ ] **Caché sin red.** Activa modo avión y cierra y reabre la app (sesión ya iniciada). Esperado: la lista sigue visible desde la caché y se muestra el banner de sin conexión; la app no se cierra.
- [ ] **Entrega sin red.** En modo avión toca "Marcar entregada" en una orden. Esperado: la tarjeta pasa a "pendiente de sincronizar" con **ícono + texto** (no solo el borde dorado), con la nota de que se enviará al volver la red.
- [ ] **Doble toque.** Toca dos veces seguidas "Marcar entregada". Esperado: un solo comando en cola, sin duplicados.
- [ ] **Sincronización.** Desactiva el modo avión. Esperado: en 30 s o menos la orden desaparece de la cola pendiente y en la base queda `fulfillment_status = delivered`, una sola vez (revisa que no haya registros duplicados ni otro cambio de estado).
- [ ] **Cierre con comando pendiente.** En modo avión marca una entrega, mata la app desde recientes, reábrela y recién entonces vuelve la red. Esperado: el comando sobrevive al cierre y se envía.
- [ ] **Sesión expirada.** Con una entrega pendiente, deja vencer la sesión (o invalida el token). Esperado: aviso "Your session has expired..."; tras volver a iniciar sesión la entrega pendiente se sincroniza.
- [ ] **Conflicto.** Marca como entregada desde el admin web una orden y luego intenta marcarla desde la app. Esperado: mensaje de "Delivery not registered" / equivalente en español, sin romper la lista.

## 3. Evidencia de entrega (foto + GPS)

- [ ] **Flujo feliz.** En una orden, toca "Agregar foto de evidencia", acepta cámara y ubicación y toma la foto. Esperado: aparece "Foto enviada" / "evidencia enviada".
- [ ] **Registro en la base.** Esperado: la orden tiene `delivery_evidence_key`, `delivery_evidence_captured_at`, `delivery_evidence_lat` y `delivery_evidence_lng` con valores coherentes (coordenadas cerca del lugar donde estás).
- [ ] **El objeto existe en R2.** Esperado: en el bucket `sweet-delivery`, bajo el prefijo configurado (por defecto `delivery-evidence/`), existe un objeto con esa clave.
- [ ] **El objeto no está vacío.** Esperado: tamaño **mayor a 0 bytes** y la imagen se abre (descárgala con una URL prefirmada o desde el panel de Cloudflare). Si está vacío, anótalo como bloqueante: hay que cambiar la subida a `expo-file-system` con PUT binario.
- [ ] **Sin permiso de cámara.** Niega el permiso de cámara. Esperado: aviso claro; "Marcar entregada" sigue funcionando.
- [ ] **Sin permiso de ubicación.** Niega la ubicación al pedir la foto. Esperado: aviso claro; "Marcar entregada" sigue funcionando.
- [ ] **Falla la subida.** Corta la red justo al enviar la foto. Esperado: aviso de que no se pudo enviar y que aún se puede entregar; la app no se cuelga más de unos segundos.
- [ ] **Flag `deliveryEvidenceRequired`.** Con el flag en `false` (estado actual) la entrega no exige foto. Si pruebas con `true`, la app lo respeta (vuelve el flag a `false` al terminar).

## 4. Ruta y ETA

- [ ] **Ver ruta.** En la orden seleccionada toca "Ver ruta" y acepta el permiso de ubicación en primer plano. Esperado: aparece el mapa con la polilínea desde tu posición hasta el destino y el ETA con distancia.
- [ ] **Permiso solo al usarla.** Esperado: la app no pidió ubicación al abrir ni al seleccionar la orden, solo al tocar "Ver ruta" (o al agregar foto o iniciar turno).
- [ ] **Permiso negado.** Niega el permiso de ubicación y toca "Ver ruta". Esperado: aviso de ubicación apagada, y la entrega sigue disponible.
- [ ] **Ruta no disponible.** Quita la clave de Routes en el servidor o corta la red y toca "Ver ruta". Esperado: "The route is not available right now..." sin cerrar la app.
- [ ] **Mapa visible en release y en desarrollo.** El mapa carga tiles en ambos APK. Si sale en blanco, revisa que la clave de Maps SDK for Android esté restringida al package y SHA-1 de **cada** build (`au.com.sweetsin.staff` y `au.com.sweetsin.staff.dev`).
- [ ] **Costo.** Después de unas pruebas revisa en Google Cloud (Routes API y Maps SDK) que el consumo corresponda a lo hecho y que la alerta de presupuesto esté activa.

## 5. Turno y seguimiento de ubicación

- [ ] **Consentimiento.** Toca "Iniciar turno". Esperado: aparece el texto de consentimiento; si no aceptas, el turno no inicia.
- [ ] **Permisos.** Acepta y concede ubicación en primer plano y luego en segundo plano ("todo el tiempo"). Esperado: el turno queda "On shift" / "En turno" y hay una notificación persistente "Sweet Sin shift on".
- [ ] **Posición en el servidor.** Esperado: en la tabla `delivery_locations` hay una fila con tu usuario y coordenadas recientes; se actualiza al caminar o conducir unos cientos de metros.
- [ ] **Segundo plano.** Bloquea la pantalla o cambia a otra app durante 10 minutos moviéndote. Esperado: la fila sigue actualizándose.
- [ ] **Cierre por el sistema.** Mata la app desde recientes con el turno activo. Esperado: el seguimiento continúa (o, si el fabricante lo corta, anótalo: marca y modelo) y al reabrir la app el turno sigue activo.
- [ ] **Degradación al negar segundo plano.** Inicia un turno nuevo y en el permiso de segundo plano elige solo "mientras se usa la app". Esperado: aviso "Background location is off..." y el seguimiento funciona solo con la app abierta; la app no se cierra.
- [ ] **Permiso de ubicación negado.** Niega todo permiso de ubicación. Esperado: "Location access is off, so the shift did not start..." y no queda ninguna fila.
- [ ] **Terminar turno.** Toca "Terminar turno". Esperado: la notificación desaparece y la fila de `delivery_locations` se borra.
- [ ] **Cerrar sesión con turno activo.** Inicia turno y cierra sesión. Esperado: el seguimiento se detiene y la fila se borra (si queda una fila por red mala, debe vencer por antigüedad; anota si ocurre).
- [ ] **Batería y datos.** Un turno de 1 hora con la pantalla apagada. Esperado: consumo de batería y datos razonables (anota el porcentaje y los MB; referencia para ajustar el umbral de envío).

## 6. Builds de desarrollo y de producción

- [ ] **Conviven.** Con ambos APK instalados: nombres distintos ("Sweet Sin Staff" y "Sweet Sin Staff (Dev)") e íconos distintos (el de desarrollo con fondo dorado). Esperado: ninguno pisa al otro.
- [ ] **Sesiones y datos separados.** Iniciar sesión en uno no inicia sesión en el otro y sus cachés no se mezclan.
- [ ] **(desarrollo)** El build de desarrollo abre el selector del bundler; con `APP_VARIANT=development npx expo start --dev-client` desde `apps/mobile` carga la app con recarga en vivo.
- [ ] **Release sin cliente de desarrollo.** El APK de release abre directo a la app, sin pantalla de dev launcher (el workflow ya falla si lo trae).

## 7. Idioma

- [ ] **Español.** Con el teléfono en español, abre la app. Esperado: todos los textos de login, lista, evidencia, ruta y turno en español.
- [ ] **Inglés.** Cambia el idioma del teléfono a inglés y reabre la app (cierra desde recientes). Esperado: los textos cambian a inglés.
- [ ] **Sin textos mezclados.** En ambos idiomas, ningún mensaje de error queda en el otro idioma (anota los que sí, por ejemplo el motivo de conflicto o los permisos nativos, que se sabe que están solo en inglés).

## 8. Revisión visual y de usabilidad (Step 3)

- [ ] **Identidad.** Ícono en el lanzador (normal y redondo; temático en Android 13+), splash y nombre "Sweet Sin Staff".
- [ ] **Tipografía.** Atkinson Hyperlegible (y la del wordmark del login) se ven correctas y la app abre sin red con ellas.
- [ ] **Escala de fuente** al 100 %, 130 % y 200 % (Ajustes, Pantalla): nada se corta ni se solapa en login ni en la lista.
- [ ] **Reducir movimiento** (Ajustes, Accesibilidad, quitar animaciones): sin entradas animadas y los GIF se reemplazan por la mascota estática.
- [ ] **Accessibility Scanner de Google** sobre login y lista: sin avisos de área tocable ni de contraste.
- [ ] **Pleno sol y una mano.** Las acciones primarias (56 dp, en la barra inferior) se leen al sol y se alcanzan con el pulgar.
- [ ] **Glifos Unicode de estado.** Revisa el glifo "→" ("en camino") y los demás glifos de estado en al menos dos fabricantes distintos de Android (por ejemplo Samsung y Xiaomi o Motorola). Esperado: se ven igual, sin cuadrado vacío (tofu) ni desalineados. Si alguno falla, cámbialo en `design-system/` una sola vez.
- [ ] **Capturas de cada estado** (`adb exec-out screencap -p > estado.png`): login, lista vacía, lista con órdenes, pendiente de sincronizar, evidencia enviada, ruta, turno. Contrástalas con los criterios de `docs/design/mobile-design-system.md`.
- [ ] **Fluidez.** Con 20 órdenes de prueba el desplazamiento no da saltos; los GIF y el mapa no producen jank notable ni calor.

## 9. Cierre

- [ ] **Limpiar los datos de prueba** (Task 20, Step 4): borrar las órdenes de prueba, las filas de `delivery_locations` y los objetos de evidencia del bucket `sweet-delivery` y de la base.
- [ ] **Registrar lo encontrado:** fallas, marcas y modelos probados, y consumo medido, en `handoff.md` (sección "Intentos fallidos" si algo falló).
