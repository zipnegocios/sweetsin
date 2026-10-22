# Decisiones y acciones pendientes — Plan 1 de la APK (actualizado 2026-10-21, tras tus respuestas)

Las decisiones D1 a D8 y las preguntas Q1, Q2, Q4, Q5, Q6 y Q11 están **resueltas** y ya se reflejan en el plan (`docs/superpowers/plans/2026-10-20-apk-fundacion-delivery-offline.md`) y en la enmienda III del spec.

## A. Todavía necesitan respuesta

Tras reconciliar el documento de diseño (Task 9a) quedan estas decisiones. Puedes responder "todo aprobado con tus propuestas" o indicar solo las que cambias. Detalle y cifras en la sección 9 de `docs/design/mobile-design-system.md`.

| # | Decisión | Mi propuesta |
|---|---|---|
| **Q-A** | Relleno del botón primario: tu paleta ya no tiene rojo de marca. Dorado no sirve como fondo con etiqueta vainilla (3,00:1) | **Navy con etiqueta vainilla** (14,74:1). Alternativa: botón dorado con etiqueta navy (4,91:1), pero gasta el único acento en cada pantalla |
| **C1** | El verde `#2F7D5B` sobre Concha da **4,36:1** (no llega a 4,5): tu documento citaba 4,52 con los fondos viejos. Sobre Vainilla da 4,66 y pasa | Mantener tu verde y **prohibir texto verde sobre Concha** (solo sobre Vainilla). Alternativa: `#2C7755` (4,73 sobre Concha y 5,06 sobre Vainilla) |
| **C2** | El borde dorado de "pendiente de sincronizar" da 3,00:1 sobre Vainilla (pasa por 0,0003) y 2,81 sobre Concha (falla) | Mantenerlo como refuerzo y usarlo solo dentro de una tarjeta Vainilla (nunca como único portador) |
| **Q3** | Tipografía display del wordmark del login | **Fraunces Black Italic**, solo en el wordmark |
| **Q-F** | Tu lista de glifos no tiene uno para "en camino" | Conservar **→** y sumarlo a la QA en dispositivos |
| **Q-D** | Ícono con fondo `#0F1B3D` frente a Tinta `#14233A` (pocas unidades RGB) | Mantener el activo actual, como decidiste |
| **Q-G / Q-H** | Borde, tono de presionado (derivados de navy) y ubicación de `text.quiet` y `text.brand` | Aprobar tal como están en el documento |
| **Q-E** | Pedir al diseñador una mascota en SVG o PNG ≥ 1024 px y un PNG estático del logo completo con transparencia | No bloquea |
| **Q7** | El "turno" no existe hoy: botón "Iniciar / Terminar turno" en la pantalla de delivery | Sí |
| **Q8** | Se mantiene `deliveryEvidenceKey` y no `Url` | Mantener |
| **Q9** | `registerPushToken` inerte sigue pidiendo el permiso de notificaciones al iniciar sesión | Sin tocar |

## B. Resueltas en esta ronda

| # | Resolución |
|---|---|
| Q1 | Documento de justificación guardado en `docs/design/mobile-design-system-justificacion.md` |
| Q2 | Se mantienen los íconos de la Task 6: el documento dice que no hay que rehacer el activo (fondo `#0F1B3D`, a pocas unidades de Tinta `#14233A`) |
| Q4 | Bucket **`sweet-delivery`**, cuenta `b798b0b01ea8805faa0bb16b07e6c4f4`. **No hace falta CORS**: las subidas las hace una app nativa y el admin leerá las fotos con URL prefirmada |
| Q5 | Se resuelve en el camino, antes de la Task 17 |
| Q6 | Lo define el equipo legal; no limita el desarrollo |
| Q11 | ETA del despachador en el mapa de flota |

## C. Acciones manuales tuyas

| # | Acción |
|---|---|
| M1 | Ejecutar `bash .superpowers/sdd/2026-10-20-apk-fundacion-delivery-offline/commit-por-tarea.sh` (11 commits, uno por tarea). El plan, el spec, el documento de justificación y este documento quedan fuera de ese script: se commitean aparte |
| M2 | Generar el keystore y cargar en GitHub los secretos `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. `keytool` está en `C:\Program Files\Java\jre-1.8\bin\` |
| M3 | Push de los commits a `main` y despachar los workflows |
| M4 | **Solo las dos claves de R2:** `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` en `apps/web/.env.local` y en EasyPanel, junto con `R2_ACCOUNT_ID=b798b0b01ea8805faa0bb16b07e6c4f4` y `R2_BUCKET=sweet-delivery`. **El secreto que pegaste en el chat llegó enmascarado y no lo escribí en ningún archivo.** Recomendación: crea un token de R2 limitado al bucket `sweet-delivery` con solo lectura y escritura de objetos; el que mostraste cubre "todos los buckets" y permite crear y borrar buckets |
| M5 | Borrar `EXPO_PUBLIC_APP_SECRET` de `apps/web/.env.local` y de EasyPanel |
| M6 | Antes de la Task 17: proyecto de Google Cloud con facturación; clave de Routes API (`GOOGLE_ROUTES_API_KEY` en `.env.local` y EasyPanel) y clave de Maps SDK for Android (secreto de GitHub `GOOGLE_MAPS_ANDROID_API_KEY`) |
| M7 | Un teléfono Android real con permiso para instalar APK |

## D. Estado de las 20 tareas

| Tarea | Estado |
|---|---|
| 1, 2, 3, 4, 5, 6, 10 | Completas y aprobadas |
| 7 | Completa y aprobada; nunca se ejecutó en GitHub |
| 8 | **Descartada** (D1 = C) |
| 12 | **Completa**: esquema aplicado a la base compartida y 9/9 pruebas de base de datos verdes; faltan solo tus claves de R2 (M4) para usarla de verdad |
| 9a | **Reescrita** con el documento de justificación; falta tu revisión (sección A) |
| 15 | Lista para ejecutar |
| 16 | Lista para ejecutar |
| 9b | Depende de la 9a |
| 11, 13, 14 | Dependen de la 9b |
| 17, 18, 19 | Pendientes (17 depende de M6) |
| 20 | Pendiente |

## E. Orden de ejecución

1. Task 15 y Task 16 (no dependen de nada tuyo).
2. Task 9a → 9b → 11 → 13 → 14.
3. Tasks 18 → 17 → 19, luego la 20 y la revisión final de toda la rama.
