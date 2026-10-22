# Design system mobile — Sweet Sin Staff (APK Android)

> **Fuente única de verdad del diseño de `apps/mobile`.** Código: `apps/mobile/src/theme/` (tokens) y `apps/mobile/src/ui/` (kit).
> Es un sistema **independiente** del de la web: los valores de partida (paleta, tipografías, radios, voz) se copiaron **una sola vez** desde `attached_assets/sweetsin-design-system_1786231311347.html`; desde ahora evoluciona por su cuenta, sin importar nada de la web ni verificar paridad con ella.
> Estado: **borrador para revisión del owner / diseñador** (Task 9, Step 0). El kit no se implementa hasta su aprobación.

Contexto de uso: herramienta de trabajo para despachador (trailer), delivery (calle) y, en el Plan 2, admin. Al aire libre y a pleno sol, a una mano. Solo tema claro, solo vertical. Todos los textos visibles salen de `packages/i18n` (`staffApp.*`); este documento solo da ideas de texto, no el copy final.

---

## 1. Principios

| # | Principio | Cómo se verifica |
|---|-----------|------------------|
| 1 | **Legibilidad y contraste primero.** Tema claro (Cream de fondo, Navy de texto), sin modo oscuro, AA: 4,5:1 texto normal, 3:1 texto grande (≥ 18 sp negrita) y componentes. Nada de texto pequeño sobre relleno Sin Red ni rojo de texto sobre claro (se usa `redDark`). | `contrast.test.ts` recorre `textPairs` (sección 3); `app.json` mantiene `userInterfaceStyle: "light"`. |
| 2 | **Zona del pulgar y una mano.** Acción primaria de la tarjeta a todo el ancho, abajo, 52 dp; todo tocable ≥ 48×48 dp con separación ≥ 8 dp. Navegación inferior de 4 destinos solo para admin (Plan 2). | Revisión visual (Task 11/15) con el inspector de layout; los componentes fijan `minHeight` desde `touch`. |
| 3 | **El estado nunca solo con color**: texto + glifo + color. | `StatusPill` exige `label` y siempre renderiza glifo (sección 5); revisión con filtro de escala de grises. |
| 4 | **La red es ciudadana de primera**: banner "sin conexión" persistente, marca "pendiente de sincronizar" por tarjeta, confirmación distinta registrado/encolado, errores accionables. | Prueba manual en modo avión (Task 15): banner visible, tarjeta con `pending_sync`, mensaje distinto al reconectar. |
| 5 | **Acciones nativas donde ahorran pasos**: dirección → `geo:`, teléfono → `tel:`. | Tocar dirección/teléfono en la tarjeta de delivery abre Maps / el marcador. |
| 6 | **Movimiento con propósito** (escalonado 60 ms, `easeOut`, presión, banner deslizante) con `Animated`, sin dependencias nuevas; respeta "reducir movimiento"; nada en bucle en pantallas de trabajo. | Activar "Quitar animaciones" en Android: sin entradas ni GIF animados; revisión de que las listas de trabajo no usan `BrandMark` animado. |
| 7 | **Voz de marca solo donde no estorba**: ligera en vacíos y éxitos; neutra y sin humor en errores y acciones críticas. | Revisión de las claves `staffApp.*` contra la sección 7. |
| 8 | **Escala tipográfica respetada**: nada se corta al 130 % ni al 200 %. | Prueba con tamaño de fuente del sistema al 130 % y 200 %; los componentes usan `minHeight` (nunca `height` fija) y no limitan `numberOfLines` en etiquetas de acción. |
| 9 | **Solo vertical, áreas seguras, teclado que no tapa el login.** | `orientation: "portrait"` en `app.json`; `SafeAreaView` en cada pantalla; login con `KeyboardAvoidingView` probado con el teclado numérico abierto. |

---

## 2. Tokens

Tres capas: **base** (valores crudos) → **semánticos** (propósito) → **de componente** (uso por estado). Las pantallas solo usan semánticos y el kit; los literales `#RRGGBB`/`rgb(` y `fontFamily:` en `src/screens/**` están prohibidos (`design-rules.test.ts`).

### 2.1 Base

#### Colores

Esta tabla es la que lee `tokens.test.ts` (coherencia documento ↔ `colors`). **Es la única tabla del documento con filas de dos columnas `nombre | #RRGGBB`.**

| nombre | valor |
|--------|-------|
| red | #E63946 |
| redDark | #B82B36 |
| redLight | #FF5C6A |
| navy | #0F1B3D |
| navyMid | #1A2F5F |
| navyLight | #253D78 |
| gold | #C9943A |
| goldLight | #F5D06B |
| cream | #F7F3EE |
| creamDark | #EDE7DC |
| vanilla | #FDFAF7 |
| abyss | #080D1A |
| success | #2F7D5B |

Origen: los 12 primeros vienen de la marca (Sin Red, Midnight Navy, Arequipe Gold, Cream, Vanilla, Abyss). `success` es propio del sistema mobile (la marca no tiene verde y "entregado / sincronizado" necesita un estado positivo). `redLight`, `navyMid` y `abyss` quedan disponibles pero **sin uso en tema claro** (no hay pares de texto aprobados para ellos).

#### Espacio (dp)

| token | xs | sm | md | lg | xl | xxl |
|-------|----|----|----|----|----|-----|
| valor | 4 | 8 | 12 | 16 | 24 | 32 |

Margen lateral de pantalla: `lg` (16). Separación entre tarjetas: `md` (12). Padding interno de tarjeta: `lg` (16). Separación mínima entre tocables: `sm` (8).

#### Radios (dp)

| token | valor | uso |
|-------|-------|-----|
| pill | 100 | botones, píldoras de estado |
| card | 20 | tarjetas |
| inner | 14 | bloques dentro de una tarjeta (dirección, totales), campos de texto |
| small | 8 | elementos menores (indicadores, chips de conteo) |

#### Tamaños tocables (dp)

| token | valor |
|-------|-------|
| touch.min | 48 (alto y ancho mínimo de todo lo tocable, `hitSlop` incluido) |
| touch.primaryButton | 52 (alto mínimo del botón primario) |

#### Tipografía

Incluidas en la APK con `expo-font` + `@expo-google-fonts/*` (la app abre sin red). Pesos a empaquetar (8 archivos, ni uno más):

| clave `fonts` | familia y peso | nombre esperado en el paquete (verificar en 9b) |
|---------------|----------------|-------------------------------------------------|
| display | Fraunces 700 | `Fraunces_700Bold` |
| displayBlack | Fraunces 900 | `Fraunces_900Black` |
| displayItalic | Fraunces 300 italic | `Fraunces_300Light_Italic` |
| body | DM Sans 400 | `DMSans_400Regular` |
| bodyMedium | DM Sans 500 | `DMSans_500Medium` |
| bodyBold | DM Sans 700 | `DMSans_700Bold` |
| mono | DM Mono 400 | `DMMono_400Regular` |
| monoMedium | DM Mono 500 | `DMMono_500Medium` |

Escala `text` (sp; escala con la fuente del sistema, `allowFontScaling` activo):

| clave `text` | fuente | tamaño | lineHeight | extra | uso |
|--------------|--------|--------|------------|-------|-----|
| brand | displayBlack | 32 | 36 | — | marca "Sweet Sin Staff" en el login (único uso) |
| title | display | 24 | 30 | — | título de pantalla |
| heading | display | 18 | 24 | — | título de tarjeta (cliente / nº de orden) |
| body | body | 16 | 24 | — | texto corriente, dirección |
| bodyStrong | bodyMedium | 16 | 24 | — | datos clave (hora, total, teléfono) |
| label | monoMedium | 11 | 16 | mayúsculas, `letterSpacing` 2.2 (0,2 em) | píldoras, eyebrows |
| button | bodyBold | 18 | 24 | — | etiquetas de botón |
| quiet | displayItalic | 16 | 24 | — | mensaje de `EmptyState` (su título usa la misma fuente a 20/26) |

`letterSpacing` en React Native es absoluto en puntos: 11 × 0,2 = 2,2. `mono` (DM Mono 400) queda para números tabulares (nº de orden, horas) si hace falta.

#### Movimiento

| token | valor |
|-------|-------|
| STAGGER_MS | 60 (retardo por índice en la entrada de tarjetas) |
| ENTER_MS | 400 (duración de entradas: tarjetas y banner) |
| PRESS_MS | 100 al presionar / 150 al soltar (valor propio, ver sección 9) |
| easeOut | `Easing.out(Easing.cubic)` de React Native |
| tope de escalonado | índice 8 (a partir de ahí no se suma retardo: máx. 480 ms) |

### 2.2 Semánticos

(Tabla de cuatro columnas a propósito: no la lee el test de coherencia de colores.)

| token | → base | valor | regla de uso |
|-------|--------|-------|--------------|
| background | cream | #F7F3EE | fondo de toda pantalla |
| surface | vanilla | #FDFAF7 | tarjetas |
| textPrimary | navy | #0F1B3D | todo texto por defecto |
| textMuted | — (literal propio) | #5A6378 | texto secundario (hora relativa, notas). Navy ≈ 68 % sobre Cream. 5,45:1 en cream, 5,79:1 en vanilla, 4,89:1 en creamDark |
| border | creamDark | #EDE7DC | **decorativo** (borde de tarjeta, divisores). No sirve como límite esencial de un control (1,18:1) |
| actionFill | red | #E63946 | relleno del botón primario. Solo con etiqueta ≥ 18 sp negrita |
| actionLabel | vanilla | #FDFAF7 | texto sobre `actionFill`, `danger`, `info`, `success` y navy |
| link | redDark | #B82B36 | texto tocable sobre claro (botón ghost, `tel:` / `geo:`) |
| info | navyLight | #253D78 | estado informativo (`received`) |
| success | success | #2F7D5B | entregado, sincronizado, evidencia enviada |
| warning | gold | #C9943A | **solo relleno o borde, nunca texto** (2,44:1 sobre cream). Sin conexión, en preparación |
| danger | redDark | #B82B36 | errores, cancelado, acciones destructivas (texto o relleno) |

### 2.3 De componente

| componente | estado | fondo | texto / glifo | borde |
|------------|--------|-------|---------------|-------|
| Button primary | normal | actionFill | actionLabel | — |
| | presionado | danger (redDark) | actionLabel | — |
| | deshabilitado | creamDark | textMuted | — |
| | cargando | actionFill | indicador + etiqueta actionLabel | — |
| Button secondary | normal | transparente | textPrimary | 2 dp textPrimary |
| | presionado | creamDark | textPrimary | 2 dp textPrimary |
| | deshabilitado | transparente | textMuted | 2 dp textMuted |
| | cargando | transparente | indicador + etiqueta textPrimary | 2 dp textPrimary |
| Button ghost | normal | transparente | link | — |
| | presionado | creamDark | link | — |
| | deshabilitado | transparente | textMuted | — |
| | cargando | transparente | indicador + etiqueta link | — |
| Card | normal | surface | textPrimary / textMuted | 1 dp border |
| ScreenHeader | — | background | título textPrimary; acción = Button ghost | 1 dp border inferior |
| EmptyState | — | background | título textPrimary / mensaje textMuted | — |
| OfflineBanner | visible | warning | textPrimary | — |
| StatusPill | por estado | ver sección 5 | ver sección 5 | ver sección 5 |
| BrandMark | — | transparente | — | — |

Estado de error: ningún componente del kit tiene variante "error" propia. Un error se muestra en la pantalla como texto `body` en `danger` (5,53:1 sobre cream) junto a la acción que lo resuelve (p. ej. un `Button secondary` "Reintentar"), con `accessibilityLiveRegion="assertive"`.

---

## 3. Contraste (WCAG 2.x, calculado)

Cálculo: luminancia relativa WCAG 2.x (por canal sRGB `c ≤ 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4`; `L = 0.2126 R + 0.7152 G + 0.0722 B`; ratio `(L1+0.05)/(L2+0.05)` con L1 la mayor), ejecutado con un script Node local y redondeado a 2 decimales. Umbral: normal ≥ 4,5; grande (≥ 18 sp negrita) ≥ 3.

### Pares permitidos (forman `textPairs`)

| texto | fondo | ratio | tamaño | veredicto | uso |
|-------|-------|-------|--------|-----------|-----|
| navy | cream | 15,28 | normal | pasa | texto general |
| navy | vanilla | 16,23 | normal | pasa | texto en tarjetas |
| navy | creamDark | 13,71 | normal | pasa | botones presionados |
| textMuted #5A6378 | cream | 5,45 | normal | pasa | texto secundario |
| textMuted #5A6378 | vanilla | 5,79 | normal | pasa | texto secundario en tarjeta |
| textMuted #5A6378 | creamDark | 4,89 | normal | pasa | botón deshabilitado |
| redDark | cream | 5,53 | normal | pasa | enlaces, ghost, errores |
| redDark | vanilla | 5,88 | normal | pasa | enlaces en tarjeta |
| redDark | creamDark | 4,97 | normal | pasa | ghost presionado, píldora cancelado |
| vanilla | red | 4,01 | **solo grande** | pasa 3:1 (no 4,5) | etiqueta del botón primario (18 sp bold) |
| vanilla | redDark | 5,88 | normal | pasa | primario presionado, relleno de peligro |
| navy | gold | 6,25 | normal | pasa | OfflineBanner, píldora en preparación |
| navy | goldLight | 11,34 | normal | pasa | píldora listo |
| vanilla | success | 4,80 | normal | pasa | píldora entregado |
| success | vanilla | 4,80 | normal | pasa | píldora evidencia enviada |
| success | cream | 4,52 | normal | pasa (justo) | evitar; preferir sobre vanilla |
| vanilla | navyLight | 10,01 | normal | pasa | píldora recibido |
| vanilla | navy | 16,23 | normal | pasa | píldora en camino |

### Pares prohibidos (evidencia)

| texto | fondo | ratio | por qué se prohíbe |
|-------|-------|-------|--------------------|
| red | cream | 3,77 | falla 4,5 → el rojo de texto sobre claro es siempre `redDark` |
| red | vanilla | 4,01 | falla 4,5 para texto pequeño |
| vanilla, texto < 18 sp bold | red | 4,01 | falla 4,5 → nada de texto pequeño sobre relleno rojo |
| navy | red | 4,05 | falla 4,5 → sobre rojo solo vanilla grande |
| gold | cream | 2,44 | falla incluso 3:1 → gold nunca es color de texto |
| gold | vanilla | 2,60 | ídem |
| creamDark (como borde) | vanilla | 1,18 | no vale como límite esencial de un control → controles con borde usan navy o textMuted |

No-texto: el borde gold de la píldora `pending_sync` (2,60 sobre vanilla) no llega a 3:1; se acepta porque **no es el único indicador** (texto + glifo).

---

## 4. Kit de componentes

Presentacionales (sin datos ni red), en `apps/mobile/src/ui/`, solo con tokens. Ningún alto es fijo: siempre `minHeight` (principio 8).

### Button
- **Props:** `{ label: string; onPress: () => void; variant?: "primary" | "secondary" | "ghost"; loading?: boolean; disabled?: boolean; accessibilityHint?: string }` (default `primary`).
- **Medidas:** primary `minHeight` 52, ancho completo del contenedor, radio `pill`, padding horizontal `xl`; secondary `minHeight` 48, ancho completo, radio `pill`, borde 2 dp; ghost `minHeight` 48, `minWidth` 48, padding horizontal `md`, ancho según contenido. Texto `text.button` en las tres variantes, centrado, puede envolver a varias líneas.
- **Estados:** colores en 2.3. Presionado: escala 0,98. Deshabilitado y cargando: no tocables. Cargando: `ActivityIndicator` (`small`) a la izquierda de la etiqueta, separación `sm`; la etiqueta se mantiene para que el ancho no salte.
- **Accesibilidad:** `accessibilityRole="button"`, `accessibilityLabel={label}`, `accessibilityHint`, `accessibilityState={{ disabled: disabled || loading, busy: loading }}`.
- **Movimiento:** escala 1 → 0,98 con `PRESS_MS`, `useNativeDriver`. Reducir movimiento: sin escala, solo color de presionado.
- **Regla:** una sola primaria por tarjeta y por pantalla; destructivas (cancelar, salir) nunca son `primary`.

### Card
- **Props:** `{ index?: number; children: ReactNode }`.
- **Medidas:** fondo `surface`, radio `card`, borde 1 dp `border`, padding `lg`, separación interna `md`. La acción primaria va como último hijo, a todo el ancho.
- **Estados:** solo normal. "Pendiente de sincronizar" lo expresa la pantalla con un `StatusPill pending_sync` dentro (la Card no conoce el dato).
- **Accesibilidad:** contenedor no tocable y no agrupado (`accessible` falso) para no romper el foco hacia los botones.
- **Movimiento:** con `index`: opacidad 0 → 1 y `translateY` 16 → 0, `ENTER_MS`, retardo `min(index, 8) × STAGGER_MS`, `easeOut`, solo en el primer montaje (un refresco de lista no vuelve a animar). Reducir movimiento: aparece directo.

### StatusPill
- **Props:** `{ status: "received" | "in_prep" | "ready_for_pickup" | "out_for_delivery" | "delivered" | "cancelled" | "pending_sync" | "evidence_sent"; label: string }`.
- **Medidas:** radio `pill`, padding vertical `xs`, horizontal `md`, `minHeight` 24 (no es tocable), `alignSelf: "flex-start"`; glifo + `xs` + `label` en `text.label`. Colores y glifo por estado en la sección 5.
- **Accesibilidad:** `accessibilityRole="text"`, `accessibilityLabel={label}`; el glifo es decorativo (`importantForAccessibility="no"`).
- **Movimiento:** ninguno.

### ScreenHeader
- **Props:** `{ title: string; actionLabel?: string; onAction?: () => void }`.
- **Medidas:** dentro del área segura superior; `minHeight` 56, padding horizontal `lg`; fila: `mascot.png` estática 32 dp → `sm` → título `text.title` (flex 1, envuelve) → `Button ghost` si llegan `actionLabel` y `onAction`. Borde inferior 1 dp `border`. Reemplaza el header nativo del stack (`headerShown: false`).
- **Accesibilidad:** título `accessibilityRole="header"`; mascota decorativa (`accessible={false}`); la acción, la del Button.
- **Movimiento:** ninguno.

### EmptyState
- **Props:** `{ title: string; message: string }`.
- **Medidas:** centrado en el espacio libre, padding `xl`: `BrandMark variant="isotipo" size={96}` animado → `lg` → título `fonts.displayItalic` 20/26 `textPrimary` → `sm` → mensaje `text.quiet` `textMuted`. Ancho máximo del texto 320 dp, centrado.
- **Accesibilidad:** título y mensaje se leen en orden; contenedor con `accessibilityLiveRegion="polite"` (aparece tras una carga).
- **Movimiento:** el isotipo puede ir en bucle (estado vacío, no lista de trabajo). Reducir movimiento: imagen estática.

### BrandMark
- **Props:** `{ variant: "isotipo" | "videologo"; size: number; animated?: boolean; playOnceMs?: number }` (default `animated` verdadero).
- **Medidas:** `size × size`, `contentFit="contain"`, fondo transparente. Usos: login `videologo` 144; vacío y carga `isotipo` 96.
- **Comportamiento:** `expo-image` con el GIF de `assets/brand/`. Muestra `mascot.png` estática si `animated` es falso, si `useReduceMotion()` es verdadero o si la carga falla (`onError`). Con `playOnceMs`, pasado ese tiempo cambia a `mascot.png` (el timer se limpia al desmontar).
- **Accesibilidad:** `accessibilityRole="image"`, `accessibilityLabel` desde i18n (clave nueva, p. ej. `staffApp.brand.mascotLabel` = "Sweet Sin").
- **Regla:** nunca animado dentro de una lista de trabajo ni de una tarjeta.

### OfflineBanner
- **Props:** `{ visible: boolean; message: string }`.
- **Medidas:** ancho completo, inmediatamente debajo del `ScreenHeader` (empuja el contenido, no lo tapa), sin radio, `minHeight` 48, padding vertical `md`, horizontal `lg`; fondo `warning`; glifo `⊘` (U+2298) + `sm` + mensaje `text.bodyStrong` `textPrimary`. No se descarta a mano: se va cuando vuelve la red.
- **Accesibilidad:** `accessibilityLiveRegion="polite"`, `accessibilityLabel={message}`; glifo decorativo.
- **Movimiento:** entra con `translateY` −alto → 0 en `ENTER_MS` `easeOut`; sale 0 → −alto en 250 ms. Reducir movimiento: aparece/desaparece sin desplazamiento.

---

## 5. Estados de orden y de sincronización

Siempre texto + glifo + color. La clave es una idea de nombre; el copy final vive en `packages/i18n`.

| estado | clave (idea) | texto (idea ES / EN) | glifo | fondo | texto y glifo |
|--------|--------------|----------------------|-------|-------|---------------|
| received | `staffApp.status.received` | Recibido / Received | ○ (U+25CB) | info (navyLight) | actionLabel (vanilla) |
| in_prep | `staffApp.status.inPrep` | En preparación / In prep | ◐ (U+25D0) | warning (gold) | textPrimary (navy) |
| ready_for_pickup | `staffApp.status.readyForPickup` | Listo / Ready | ● (U+25CF) | goldLight | textPrimary (navy) |
| out_for_delivery | `staffApp.status.outForDelivery` | En camino / On the way | → (U+2192) | navy | actionLabel (vanilla) |
| delivered | `staffApp.status.delivered` | Entregado / Delivered | ✓ (U+2713) | success | actionLabel (vanilla) |
| cancelled | `staffApp.status.cancelled` | Cancelado / Cancelled | ✕ (U+2715) | creamDark | danger (redDark) |
| pending_sync | `staffApp.status.pendingSync` | Pendiente de sincronizar / Waiting to sync | ↻ (U+21BB) | surface + borde 1 dp warning | textPrimary (navy) |
| evidence_sent | `staffApp.status.evidenceSent` | Evidencia enviada / Proof sent | ↑ (U+2191) | surface + borde 1 dp success | success |

Los glifos son caracteres de texto, sin presentación emoji por defecto en Android, y toman el color del texto de la píldora; si DM Mono no los incluye, Android cae a su fuente de símbolos. Una tarjeta puede llevar dos píldoras (p. ej. `delivered` + `pending_sync`): primero el estado de la orden, después el de sincronización.

---

## 6. Movimiento

| qué | cómo | con "reducir movimiento" |
|-----|------|--------------------------|
| Entrada de tarjetas | opacidad + `translateY` 16 → 0, 400 ms, retardo `min(index, 8) × 60` ms, `easeOut`, solo primer montaje | sin animación |
| Presión de botón | escala 0,98, 100 ms al presionar / 150 ms al soltar, `easeOut` | solo color de presionado |
| Banner sin conexión | desliza desde arriba en 400 ms; sale en 250 ms | aparece/desaparece directo |
| GIF `videologo` (login) | un ciclo: `playOnceMs={8000}`, luego `mascot.png` | `mascot.png` desde el inicio |
| GIF `isotipo` (vacío y carga) | bucle permitido | `mascot.png` |
| Listas y tarjetas de trabajo | **ningún bucle, ningún GIF animado** | — |

Implementación: `Animated` de React Native con `useNativeDriver: true` (solo `opacity` y `transform`); `useReduceMotion()` lee `AccessibilityInfo.isReduceMotionEnabled()` y se suscribe a `reduceMotionChanged`. Sin dependencias nuevas de animación.

---

## 7. Voz de marca

Tono de partida: sensual, ligera, confiada, nunca burlona; el "Forgive yourself" va implícito. En una herramienta de trabajo la voz es un guiño, no un show.

| dónde | voz | ejemplos ES | ejemplos EN |
|-------|-----|-------------|-------------|
| Vacíos (cola sin órdenes, sin entregas asignadas) | **permitida**, ligera | "Nada que despachar. Descansar no es pecado." · "Sin entregas asignadas. Disfrutá la calma." · "La cola está vacía. Las tentaciones vuelven pronto." | "Nothing to dispatch. Resting is no sin." · "No deliveries yet. Enjoy the calm." · "The queue is empty. Temptation will be back soon." |
| Éxitos (entrega confirmada, todo sincronizado) | **permitida**, breve | "Entregado. Ese pecado ya tiene dueño." · "Todo sincronizado. Perdonate un café." | "Delivered. That sin found its owner." · "All synced. Forgive yourself a coffee." |
| Éxito encolado sin red | permitida, pero **lo claro primero** | "Guardado en el teléfono. Se envía cuando vuelva la señal." | "Saved on this phone. It'll send when you're back online." |
| Errores | **neutra, sin humor**: qué pasó + qué hacer | "No se pudo asignar el repartidor. Revisá la conexión y probá de nuevo." · "Email o PIN incorrecto." · "Demasiados intentos. Esperá unos minutos y volvé a intentar." | "Couldn't assign the driver. Check your connection and try again." · "Wrong email or PIN." · "Too many attempts. Wait a few minutes and try again." |
| Acciones críticas (marcar entregado, cancelar, salir) | **neutra**, verbo + objeto | "Marcar entregado" · "Cancelar orden" · "Salir" | "Mark as delivered" · "Cancel order" · "Log out" |

Reglas: nunca humor en errores, confirmaciones destructivas ni textos de accesibilidad; nunca culpar al usuario. El registro del español (voseo o tuteo) lo fija `packages/i18n`, no este documento.

---

## 8. Uso de la identidad

| activo | archivo | cuándo |
|--------|---------|--------|
| Mascota estática | `assets/brand/mascot.png` (373×343) | `ScreenHeader` (32 dp, decorativa); respaldo estático de todo `BrandMark` |
| Isotipo animado (guiño, 2,5 s, bucle) | `assets/brand/isotipo.gif` (200×180) | `EmptyState` y pantallas de carga (96 dp). Nunca en listas de trabajo |
| Logo animado (8 s, bucle) | `assets/brand/videologo.gif` (320×320) | Solo en el login, un ciclo (`playOnceMs` 8000), 144 dp |
| Ícono de la app | `assets/icon.png`, `android-icon-foreground.png`, `android-icon-monochrome.png` | Mascota sobre Midnight Navy `#0F1B3D` (fondo adaptativo de `app.json`); validar en máscara circular y cuadrada; Cream como alternativa |
| Splash | `assets/splash-icon.png` | Mascota estática centrada sobre Navy (Android 12+ no anima el splash); se retiene hasta que cargan las fuentes |
| Notificación | `assets/notification-icon.png` | Silueta blanca sobre transparente, acento Sin Red `#E63946` |

Los íconos se regeneran con `node scripts/generate-brand-assets.mjs` (desde `apps/mobile`).

**Limitación de la fuente:** la mascota de mayor resolución tiene 373 px. Alcanza para el primer plano adaptativo (zona visible ≈ 288 de 432 px) y para la mascota de 32 dp, pero el ícono de 1024 px y la ficha del instalador quedan escalados, y los GIF a 96/144 dp en pantallas xxhdpi (×3) se amplían ≈ 1,4×. **Pedido al diseñador:** la mascota plana en SVG (o PNG ≥ 1024 px) y, si es posible, el isotipo y el logo animados al doble de su tamaño actual.

---

## 9. Decisiones abiertas para el revisor

1. **Verde `success` #2F7D5B** — fuera de la paleta de marca; 4,80:1 con vanilla y apenas 4,52:1 sobre cream. Confirmar el tono o proponer otro que cumpla ≥ 4,5 con vanilla.
2. **`textMuted` #5A6378** — valor propio (navy ≈ 68 % sobre cream) que no está en la tabla base. ¿Se promueve a base (p. ej. `navyMuted`, lo que suma una fila y cambia `colors`) o queda como literal de la capa semántica?
3. **Glifos de estado** (○ ◐ ● → ✓ ✕ ↻ ↑ y ⊘ del banner) — caracteres Unicode para no sumar dependencias; dependen de la fuente de símbolos del sistema. Alternativa: `@expo/vector-icons` (no está instalado) con MaterialCommunityIcons `circle-outline`, `progress-clock`, `check-circle-outline`, `bike-fast`, `check`, `close`, `sync`, `upload`, `cloud-off-outline`.
4. **Tamaño de la etiqueta de píldora** — los 11 sp de DM Mono vienen de la marca, pero a pleno sol pueden quedar chicos; alternativa: 13 sp (`letterSpacing` 2,6).
5. **Colores por estado** (sección 5), en especial `in_prep` (gold) y `ready_for_pickup` (goldLight), que se distinguen sobre todo por texto y glifo.
6. **Borde gold de `pending_sync`** — no llega a 3:1 (2,60); se acepta como refuerzo, no como único indicador.
7. **Bordes de campos de texto del login** — `border` (creamDark) no alcanza 3:1, así que los campos usarían borde 1 dp `textMuted` (5,79:1 sobre vanilla). No hay `TextField` en el kit mínimo: ¿se agrega en 9b o queda en la pantalla con tokens?
8. **Respaldo estático del videologo** — hoy es `mascot.png`, porque no hay una versión estática del logo completo con transparencia (`logo-flat.png` tiene fondo blanco). ¿Se pide ese PNG?
9. **Fondo del ícono** — Navy (decisión vigente) o Cream, a validar con la vista previa de máscaras.
10. **Valores propios de movimiento** — `PRESS_MS` 100/150 ms, desplazamiento de entrada de 16 dp, tope del escalonado en el índice 8 y salida del banner en 250 ms no vienen de la marca.
11. **Tamaños de BrandMark** — login 144 dp y vacío 96 dp, ampliados ≈ 1,4× en xxhdpi hasta tener fuentes de mayor resolución.
12. **Tokens `text.brand` y `text.quiet`** — se suman a la escala del brief (title, heading, body, bodyStrong, label, button) para el wordmark del login y el texto de `EmptyState`.
