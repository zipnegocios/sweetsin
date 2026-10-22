# Design system mobile — Sweet Sin Staff (APK Android)

> **Fuente única de verdad del diseño de `apps/mobile`.** Código: `apps/mobile/src/theme/` (tokens) y `apps/mobile/src/ui/` (kit).
> **Versión reconciliada**, derivada de `docs/design/mobile-design-system-justificacion.md` (documento del owner: paleta de 6 colores, Atkinson Hyperlegible, las 12 decisiones aprobadas). Donde este documento y la justificación difieran, **gana la justificación**. Es **independiente** del design system de la web (que no se toca): no importa nada de ella ni verifica paridad.
> Estado: **para revisión del owner** (Task 9a, Step 0). El kit (Task 9b) no se implementa hasta su aprobación; las decisiones abiertas están en la sección 9.

Contexto de uso: herramienta de trabajo de campo para despachador (trailer), delivery (calle, a pleno sol, a una mano) y, en el Plan 2, admin. El **delivery es el caso más exigente**: el sistema se diseña para ese caso y los demás lo heredan. Solo tema claro, solo vertical. Todos los textos visibles salen de `packages/i18n` (`staffApp.*`); este documento solo da ideas de texto, no el copy final.

---

## 1. Principios

| # | Principio | Cómo se verifica |
|---|-----------|------------------|
| 1 | **Contraste de campo primero.** Todo elemento interactivo e indicador de estado supera 4,5:1 (texto normal) o 3:1 (texto grande ≥ 18 sp negrita) contra su fondo, y además va codificado por glifo + texto, nunca solo por color. Tema claro, sin modo oscuro. | `contrast.test.ts` recorre `textPairs` (sección 3); `app.json` mantiene `userInterfaceStyle: "light"`. |
| 2 | **La marca vive en los bordes.** Mascota animada, dorado y tipografía display aparecen solo en login y pantallas vacías/de éxito. En una tarea activa (cola, marcar entregado) la paleta se reduce a navy / cream / vanilla / estado. | Las pantallas de trabajo no usan `BrandMark` animado ni `text.brand`. |
| 3 | **Un acento, muchos estados.** El dorado es el **único** acento de marca. Los estados se diferencian por **glifo + texto**, no agregando colores. | La paleta base tiene 6 filas (sección 2.1); `StatusPill` exige `label` y glifo. |
| 4 | **Zona del pulgar y una mano.** Acciones primarias en el **tercio inferior** de la pantalla, **mínimo 56 dp** de alto, ancho completo; todo otro tocable ≥ 48×48 dp con separación ≥ 8 dp. | Los componentes fijan `minHeight` desde `touch`; revisión visual (Task 11/15) con el inspector de layout. |
| 5 | **La red es ciudadana de primera**: banner "sin conexión" persistente, marca "pendiente de sincronizar" por tarjeta, confirmación distinta registrado/encolado, errores accionables. | Prueba manual en modo avión (Task 15). |
| 6 | **Acciones nativas donde ahorran pasos**: dirección → `geo:`, teléfono → `tel:`. | Tocar dirección/teléfono en la tarjeta de delivery abre Maps / el marcador. |
| 7 | **Movimiento con propósito** (escalonado, `easeOut`, presión, banner deslizante) con `Animated`, sin dependencias nuevas; respeta "reducir movimiento"; nada en bucle en pantallas de trabajo. | "Quitar animaciones" en Android: sin entradas ni GIF animados. |
| 8 | **Voz de marca solo donde no estorba**: ligera en vacíos y éxitos; neutra y sin humor en errores y acciones críticas. | Revisión de las claves `staffApp.*` contra la sección 7. |
| 9 | **Escala tipográfica respetada**: nada se corta al 130 % ni al 200 %. | Prueba con fuente del sistema al 130 % y 200 %; `minHeight` (nunca `height` fija); sin `numberOfLines` en etiquetas de acción. |
| 10 | **Contenido operativo alineado a la izquierda** (ni centrado ni justificado): se escanea más rápido en movimiento. Excepción: `EmptyState` y botones. | Revisión visual. |
| 11 | **Solo vertical, áreas seguras, teclado que no tapa el login.** | `orientation: "portrait"`; `SafeAreaView` en cada pantalla; login con `KeyboardAvoidingView` probado con el teclado abierto. |

### Reglas del owner (obligatorias)

1. **El borde dorado de `pending_sync` nunca es el único portador** de esa información: siempre glifo `↻` + texto "Pendiente de sincronizar". El borde es refuerzo decorativo.
2. **Glifos de estado = caracteres Unicode** (`○ ◐ ● ✓ ✕ ↻ ↑ ⊘`, más `→`, ver Q-F). **Prohibido `@expo/vector-icons`** y cualquier librería de íconos. Deben **verificarse en más de un fabricante Android** (al menos Samsung y Xiaomi) en la QA de dispositivo real (Task 8), porque cada uno puede renderizar su fuente de símbolos distinto.
3. **Fondo del ícono de la app = Navy.** Ver sección 8 (diferencia `#0F1B3D` vs `#14233A`).
4. **El dorado es el único acento de marca.** Las diferencias entre estados las llevan glifo + texto, no colores nuevos.
5. Nada de negro puro ni blanco puro en ningún token.

---

## 2. Tokens

Tres capas: **base** (valores crudos) → **semánticos** (propósito) → **de componente** (uso por estado). Las pantallas solo usan semánticos y el kit; los literales de color (`#RRGGBB`, `rgb(`, `rgba(`) y `fontFamily:` en `src/screens/**` están prohibidos (`design-rules.test.ts`).

### 2.1 Base

#### Colores

Esta tabla es la que lee `tokens.test.ts` (coherencia documento ↔ `colors`). **Es la única tabla del documento con filas `nombre | #RRGGBB`**; debe tener exactamente 6 filas.

| nombre | valor |
|--------|-------|
| navy | #14233A |
| cream | #F6EFE1 |
| vanilla | #FBF7EC |
| gold | #B8872B |
| success | #2F7D5B |
| alert | #A6351F |

Nombres de la marca (solo documentación): navy = **Tinta** (texto principal, cabeceras, fondo del ícono), cream = **Concha** (fondo de pantalla, cálido, no blanco clínico), vanilla = **Vainilla** (tarjetas y superficies elevadas), gold = **Dorado** (único acento de marca), success = **Verde éxito** (fuera de la paleta de marca a propósito: "éxito" en verde se reconoce de un vistazo, en movimiento), alert = **Rojo alerta** (errores, conflictos, sesión vencida). No existe rojo de marca, `redDark`, `navyMid`/`navyLight`, `creamDark` ni `abyss`: los valores de la web no se heredan.

Los valores que no son colores planos (borde, tintes de presión/deshabilitado) se derivan de `navy` con opacidad en la capa semántica; no entran a esta tabla.

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
| inner | 14 | bloques dentro de una tarjeta, campos de texto del login |
| small | 8 | elementos menores (indicadores, chips de conteo) |

#### Tamaños tocables (dp)

| token | valor |
|-------|-------|
| touch.min | 48 (alto y ancho mínimo de todo lo tocable, `hitSlop` incluido) |
| touch.primaryButton | 56 (alto mínimo del botón primario) |

#### Tipografía

**Una sola familia para todo el texto operativo: Atkinson Hyperlegible**, elegida por legibilidad al sol y a distancia de brazo (distingue caracteres confundibles: clave en nº de orden y direcciones). **Dos pesos y nada más: regular y bold.** Se empaqueta en la APK con `expo-font` (la app abre sin red).

| clave `fonts` | familia y peso | paquete / identificador |
|---------------|----------------|-------------------------|
| body | Atkinson Hyperlegible 400 (regular) | `@expo-google-fonts/atkinson-hyperlegible`; verificar los nombres exportados al instalarlo (9b) |
| bodyBold | Atkinson Hyperlegible 700 (bold) | ídem |
| brand | **Fraunces Black Italic** (900 italic) | solo el wordmark del login; **default pendiente de confirmación del owner (Q3)**; paquete `@expo-google-fonts/fraunces`, verificar el nombre exportado |

La fuente display `brand` **solo** se usa en el wordmark "Sweet Sin" de la pantalla de login; nunca en texto operativo. Se retiran DM Sans, DM Mono y el estilo de etiqueta en mayúsculas mono. Si el owner elige otra cara en Q3, solo cambia la fila `brand`.

Escala `text` (sp; escala con la fuente del sistema, `allowFontScaling` activo):

| clave `text` | fuente | tamaño | lineHeight | uso |
|--------------|--------|--------|------------|-----|
| brand | brand | 32 | 36 | wordmark "Sweet Sin" en el login (único uso); color `textPrimary` |
| title | bodyBold | 24 | 30 | título de pantalla |
| heading | bodyBold | 18 | 24 | título de tarjeta (cliente / nº de orden) |
| body | body | 16 | 24 | texto corriente, dirección |
| bodyStrong | bodyBold | 16 | 24 | datos clave (hora, total, teléfono) |
| label | bodyBold | 13 | 18 | etiqueta de píldoras de estado (sin mayúsculas forzadas ni `letterSpacing`) |
| button | bodyBold | 18 | 24 | etiquetas de botón |
| quiet | body | 16 | 24 | texto secundario y mensaje de `EmptyState`; color `textQuiet` |

El título de `EmptyState` usa `heading` (18/24 bold) en `textPrimary`.

#### Movimiento

| token | valor |
|-------|-------|
| STAGGER_MS | 60 (retardo por índice en la entrada de tarjetas) |
| ENTER_MS | 400 (duración de entradas: tarjetas y banner) |
| PRESS_MS | 100 al presionar / 150 al soltar |
| EXIT_BANNER_MS | 250 |
| ENTER_OFFSET | 16 dp (`translateY` inicial de tarjetas) |
| easeOut | `Easing.out(Easing.cubic)` de React Native |
| tope de escalonado | índice 8 (máx. 480 ms de retardo) |

Valores de movimiento aprobados por el owner (decisión 10).

### 2.2 Semánticos

(Tabla de cuatro columnas con valores entre comillas invertidas a propósito: no la lee el test de coherencia de colores.)

| token | → base | valor | regla de uso |
|-------|--------|-------|--------------|
| background | cream | `#F6EFE1` | fondo de toda pantalla |
| surface | vanilla | `#FBF7EC` | tarjetas y superficies elevadas |
| textPrimary | navy | `#14233A` | todo texto por defecto |
| textQuiet | — (**semántico, no base**) | `#5A6378` | información secundaria (hora relativa, notas, mensaje de `EmptyState`). Es un *significado*, no "un gris": si cambia el fondo, el valor puede cambiar y el significado se conserva (decisión 2). Reemplaza al `textMuted` del borrador. Solo sobre cream o vanilla; **nunca sobre gold ni navy** |
| border | navy a 16 % de opacidad | `rgba(20,35,58,0.16)` | **decorativo** (borde de tarjeta, divisores). Nunca límite esencial de un control |
| actionFill | navy | `#14233A` | relleno del botón primario (ver Q-A en sección 9) |
| actionLabel | vanilla | `#FBF7EC` | texto sobre `actionFill`, `success`, `danger` y navy |
| link | navy | `#14233A` | texto tocable (botón ghost, `tel:` / `geo:`): **bold + subrayado** (sin rojo de marca, el subrayado es el diferenciador) |
| info | navy | `#14233A` | estado informativo (`received`, `out_for_delivery`) |
| success | success | `#2F7D5B` | entregado, evidencia enviada. Texto **solo sobre vanilla** (ver conflicto C1, sección 9); relleno con `actionLabel` |
| warning | gold | `#B8872B` | **relleno o borde, nunca texto** (ver sección 3). Sin conexión, en preparación, listo, pendiente de sincronizar |
| danger | alert | `#A6351F` | errores, conflictos, cancelado, sesión vencida, acciones destructivas (texto o relleno) |
| tintPressed | navy a 8 % | `rgba(20,35,58,0.08)` | fondo de botones secondary/ghost presionados y de botón deshabilitado |
| text.brand | — | `fonts.brand` 32/36, color `textPrimary` | estilo semántico del wordmark (decisión 12) |

### 2.3 De componente

| componente | estado | fondo | texto / glifo | borde |
|------------|--------|-------|---------------|-------|
| Button primary | normal | actionFill | actionLabel | — |
| | presionado | actionFill, opacidad 0,85 + escala 0,98 | actionLabel | — |
| | deshabilitado | tintPressed | textQuiet | — |
| | cargando | actionFill | indicador + etiqueta actionLabel | — |
| Button secondary | normal | transparente | textPrimary | 2 dp textPrimary |
| | presionado | tintPressed | textPrimary | 2 dp textPrimary |
| | deshabilitado | transparente | textQuiet | 2 dp textQuiet |
| | cargando | transparente | indicador + etiqueta textPrimary | 2 dp textPrimary |
| Button ghost | normal | transparente | link (bold, subrayado) | — |
| | presionado | tintPressed | link | — |
| | deshabilitado | transparente | textQuiet | — |
| | cargando | transparente | indicador + etiqueta link | — |
| Card | normal | surface | textPrimary / textQuiet | 1 dp border |
| ScreenHeader | — | textPrimary (cabecera Tinta) | título y acción en actionLabel | — |
| EmptyState | — | background | título textPrimary / mensaje textQuiet | — |
| OfflineBanner | visible | warning | textPrimary | — |
| StatusPill | por estado | ver sección 5 | ver sección 5 | ver sección 5 |
| BrandMark | — | transparente | — | — |

Estado de error: ningún componente tiene variante "error". Un error se muestra en la pantalla como texto `body` en `danger` junto a la acción que lo resuelve (p. ej. un `Button secondary` "Reintentar"), con `accessibilityLiveRegion="assertive"`.

**Campos de texto del login** (no hay `TextField` en el kit, decisión 7): se construyen en la pantalla solo con tokens: fondo `surface`, radio `inner`, `minHeight` 56, borde 2 dp `textQuiet` (5,62:1 sobre vanilla, supera 3:1), texto `body` `textPrimary`, placeholder `textQuiet`, borde `danger` en error.

---

## 3. Contraste (WCAG 2.x, calculado)

Cálculo: luminancia relativa WCAG 2.x (por canal sRGB `c ≤ 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4`; `L = 0.2126 R + 0.7152 G + 0.0722 B`; ratio `(L1+0.05)/(L2+0.05)`, L1 la mayor), con un script Node local, redondeado a 2 decimales y **recalculado para la paleta nueva**. Umbral: normal ≥ 4,5; grande (≥ 18 sp negrita) ≥ 3; no-texto ≥ 3. `quiet` = `textQuiet` `#5A6378`.

### Pares permitidos (forman `textPairs`)

| texto | fondo | ratio | tamaño | veredicto | uso |
|-------|-------|-------|--------|-----------|-----|
| navy | cream | 13,79 | normal | pasa | texto general |
| navy | vanilla | 14,74 | normal | pasa | texto en tarjetas |
| navy | gold | 4,91 | normal | pasa | OfflineBanner, píldoras en preparación y listo |
| vanilla | navy | 14,74 | normal | pasa | etiqueta del botón primario, cabecera, píldora en camino |
| vanilla | success | 4,66 | normal | pasa | píldora entregado |
| vanilla | alert | 6,23 | normal | pasa | píldora cancelado, relleno de peligro |
| alert | cream | 5,83 | normal | pasa | errores, texto de peligro |
| alert | vanilla | 6,23 | normal | pasa | errores en tarjeta |
| success | vanilla | 4,66 | normal | pasa | píldora evidencia enviada |
| quiet | cream | 5,26 | normal | pasa | texto secundario |
| quiet | vanilla | 5,62 | normal | pasa | texto secundario en tarjeta, borde de campos |

### Pares prohibidos (evidencia)

| texto | fondo | ratio | por qué se prohíbe |
|-------|-------|-------|--------------------|
| success | cream | 4,36 | **falla 4,5** (conflicto C1): texto success solo sobre vanilla |
| gold | cream | 2,81 | falla incluso 3:1 → el dorado nunca es color de texto |
| gold | vanilla | 3,00 | falla 4,5 (solo roza 3:1) → ídem |
| quiet | gold | 1,87 | ilegible → sobre gold solo navy |
| quiet | navy | 2,62 | ilegible → sobre navy solo vanilla |
| navy | success | 3,16 | falla 4,5 → sobre success solo vanilla |
| navy | alert | 2,37 | falla → sobre alert solo vanilla |
| alert | gold | 2,08 | falla → nunca rojo sobre dorado |

### No-texto (3:1)

| elemento | fondo | ratio | veredicto |
|----------|-------|-------|-----------|
| borde gold (2 dp, `pending_sync`) | vanilla | 3,00 | pasa por 0,0003 (3,0003); es el caso de uso real (dentro de una `Card`) |
| borde gold | cream | 2,81 | **no pasa** → nunca usar la píldora `pending_sync` directamente sobre cream; en cualquier caso **no es el único portador** (regla 1) |
| borde `textQuiet` de campos | vanilla | 5,62 | pasa |
| `border` (navy 16 %) | vanilla | decorativo | no es límite esencial de ningún control |

Texto deshabilitado queda exento de WCAG; aun así `textQuiet` sobre `tintPressed` (cream + 8 % navy) da 4,53.

---

## 4. Kit de componentes

Presentacionales (sin datos ni red), en `apps/mobile/src/ui/`, solo con tokens. Ningún alto es fijo: siempre `minHeight` (principio 9). El kit **no incluye `TextField`**.

### Button
- **Props:** `{ label: string; onPress: () => void; variant?: "primary" | "secondary" | "ghost"; loading?: boolean; disabled?: boolean; accessibilityHint?: string }` (default `primary`).
- **Medidas:** primary `minHeight` **56**, ancho completo, radio `pill`, padding horizontal `xl`; secondary `minHeight` 48, ancho completo, radio `pill`, borde 2 dp; ghost `minHeight` 48, `minWidth` 48, padding horizontal `md`, ancho según contenido. Texto `text.button` en las tres variantes, centrado, puede envolver.
- **Estados:** colores en 2.3. Presionado: escala 0,98. Deshabilitado y cargando: no tocables. Cargando: `ActivityIndicator` (`small`) a la izquierda de la etiqueta, separación `sm`; la etiqueta se mantiene para que el ancho no salte.
- **Accesibilidad:** `accessibilityRole="button"`, `accessibilityLabel={label}`, `accessibilityHint`, `accessibilityState={{ disabled: disabled || loading, busy: loading }}`.
- **Movimiento:** escala 1 → 0,98 con `PRESS_MS`, `useNativeDriver`. Reducir movimiento: sin escala, solo el cambio de color/opacidad.
- **Reglas:** una sola primaria por tarjeta y pantalla; ubicada en el tercio inferior; destructivas (cancelar, salir) nunca son `primary`.

### Card
- **Props:** `{ index?: number; children: ReactNode }`.
- **Medidas:** fondo `surface`, radio `card`, borde 1 dp `border`, padding `lg`, separación interna `md`, contenido alineado a la izquierda. La acción primaria va como último hijo, a todo el ancho.
- **Estados:** solo normal. "Pendiente de sincronizar" lo expresa la pantalla con un `StatusPill pending_sync` dentro (la Card no conoce el dato).
- **Accesibilidad:** contenedor no tocable y no agrupado (`accessible` falso) para no romper el foco hacia los botones.
- **Movimiento:** con `index`: opacidad 0 → 1 y `translateY` 16 → 0, `ENTER_MS`, retardo `min(index, 8) × STAGGER_MS`, `easeOut`, solo en el primer montaje. Reducir movimiento: aparece directo.

### StatusPill
- **Props:** `{ status: "received" | "in_prep" | "ready_for_pickup" | "out_for_delivery" | "delivered" | "cancelled" | "pending_sync" | "evidence_sent"; label: string }`.
- **Medidas:** radio `pill`, padding vertical `xs`, horizontal `md`, `minHeight` 24 (no tocable), `alignSelf: "flex-start"`; glifo + `xs` + `label` en `text.label` (Atkinson bold 13 sp). Colores y glifo por estado en la sección 5.
- **Accesibilidad:** `accessibilityRole="text"`, `accessibilityLabel={label}`; el glifo es decorativo (`importantForAccessibility="no"`).
- **Movimiento:** ninguno.

### ScreenHeader
- **Props:** `{ title: string; actionLabel?: string; onAction?: () => void }`.
- **Medidas:** cabecera **Tinta** (fondo `textPrimary`) dentro del área segura superior; `minHeight` 56, padding horizontal `lg`; fila: `mascot.png` estática 32 dp → `sm` → título `text.title` en `actionLabel` (flex 1, envuelve) → acción si llegan `actionLabel` y `onAction`. La acción es un `Button ghost` con colores invertidos (texto vanilla, subrayado), `minHeight` 48. Reemplaza el header nativo del stack (`headerShown: false`).
- **Accesibilidad:** título `accessibilityRole="header"`; mascota decorativa (`accessible={false}`); la acción, la del Button.
- **Movimiento:** ninguno.

### EmptyState
- **Props:** `{ title: string; message: string }`.
- **Medidas:** centrado en el espacio libre, padding `xl`: `BrandMark variant="isotipo" size={96}` animado → `lg` → título `text.heading` `textPrimary` → `sm` → mensaje `text.quiet`. Ancho máximo del texto 320 dp.
- **Accesibilidad:** título y mensaje en orden; contenedor con `accessibilityLiveRegion="polite"`.
- **Movimiento:** el isotipo puede ir en bucle (estado vacío, no lista de trabajo). Reducir movimiento: imagen estática.

### BrandMark
- **Props:** `{ variant: "isotipo" | "videologo"; size: number; animated?: boolean; playOnceMs?: number }` (default `animated` verdadero).
- **Medidas:** `size × size`, `contentFit="contain"`, fondo transparente. Usos: login `videologo` **144**; vacío y carga `isotipo` **96** (aprobados, decisión 11).
- **Comportamiento:** `expo-image` con el GIF de `assets/brand/`. Muestra `mascot.png` estática si `animated` es falso, si `useReduceMotion()` es verdadero o si la carga falla (`onError`). Con `playOnceMs`, pasado ese tiempo cambia a `mascot.png` (timer limpiado al desmontar).
- **Accesibilidad:** `accessibilityRole="image"`, `accessibilityLabel` desde i18n (p. ej. `staffApp.brand.mascotLabel` = "Sweet Sin").
- **Regla:** nunca animado dentro de una lista de trabajo ni de una tarjeta.

### OfflineBanner
- **Props:** `{ visible: boolean; message: string }`.
- **Medidas:** ancho completo, inmediatamente debajo del `ScreenHeader` (empuja el contenido), sin radio, `minHeight` 48, padding vertical `md`, horizontal `lg`; fondo `warning` (gold); glifo `⊘` (U+2298) + `sm` + mensaje `text.bodyStrong` en `textPrimary` (navy sobre gold, 4,91). No se descarta a mano.
- **Accesibilidad:** `accessibilityLiveRegion="polite"`, `accessibilityLabel={message}`; glifo decorativo.
- **Movimiento:** entra con `translateY` −alto → 0 en `ENTER_MS` `easeOut`; sale en `EXIT_BANNER_MS`. Reducir movimiento: sin desplazamiento.

### Layout de referencia (`DeliveryQueueScreen`)

Cabecera Tinta (nombre, salir) → `OfflineBanner` si corresponde → lista de `Card` (una orden por tarjeta, alineado a la izquierda: cliente · dirección, `StatusPill` de estado y, si aplica, de sincronización) → zona inferior fija con "Marcar entregada" (primaria, 56 dp) y "+ Foto de evidencia" (secondary, paso opcional).

---

## 5. Estados de orden y de sincronización

Siempre **glifo + texto**; el color refuerza, nunca informa solo. La clave es una idea de nombre; el copy final vive en `packages/i18n`.

| estado | clave (idea) | texto (idea ES / EN) | glifo | fondo | borde | texto y glifo |
|--------|--------------|----------------------|-------|-------|-------|---------------|
| received | `staffApp.status.received` | Recibido / Received | ○ (U+25CB) | surface | 1,5 dp textPrimary | textPrimary |
| in_prep | `staffApp.status.inPrep` | En preparación / In prep | ◐ (U+25D0) | warning (gold) | — | textPrimary |
| ready_for_pickup | `staffApp.status.readyForPickup` | Listo / Ready | ● (U+25CF) | warning (gold) | — | textPrimary |
| out_for_delivery | `staffApp.status.outForDelivery` | En camino / On the way | → (U+2192) | textPrimary (navy) | — | actionLabel (vanilla) |
| delivered | `staffApp.status.delivered` | Entregado / Delivered | ✓ (U+2713) | success | — | actionLabel (vanilla) |
| cancelled | `staffApp.status.cancelled` | Cancelado / Cancelled | ✕ (U+2715) | danger (alert) | — | actionLabel (vanilla) |
| pending_sync | `staffApp.status.pendingSync` | Pendiente de sincronizar / Waiting to sync | ↻ (U+21BB) | surface | 2 dp warning (gold) | textPrimary |
| evidence_sent | `staffApp.status.evidenceSent` | Evidencia enviada / Proof sent | ↑ (U+2191) | surface | 1,5 dp success | success |

- `in_prep` y `ready_for_pickup` comparten color (gold) **a propósito** (principio 3): se distinguen por glifo ◐ vs ● y por texto.
- `pending_sync`: borde gold + glifo ↻ + texto, **siempre los tres** (regla 1); solo sobre `surface`/`Card` (el borde no llega a 3:1 sobre cream).
- `evidence_sent` usa texto success sobre vanilla (4,66); nunca sobre cream.
- Los glifos son caracteres de texto, toman el color del texto de la píldora y se renderizan con la fuente de símbolos del sistema Android (Atkinson no los cubre): QA en más de un fabricante (regla 2). Una tarjeta puede llevar dos píldoras: primero el estado de la orden, después el de sincronización.

---

## 6. Movimiento

| qué | cómo | con "reducir movimiento" |
|-----|------|--------------------------|
| Entrada de tarjetas | opacidad + `translateY` 16 → 0, 400 ms, retardo `min(index, 8) × 60` ms, `easeOut`, solo primer montaje | sin animación |
| Presión de botón | escala 0,98, 100 ms al presionar / 150 al soltar, `easeOut` | solo cambio de color/opacidad |
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
| Wordmark "Sweet Sin" | texto con `text.brand` (`fonts.brand`) | Solo login; único uso de la tipografía display |
| Ícono de la app | `assets/icon.png`, `android-icon-foreground.png`, `android-icon-monochrome.png` | Mascota sobre **fondo Navy** (decisión 9/D3: se distingue entre apps de delivery de colores cálidos); validar en máscara circular y cuadrada |
| Splash | `assets/splash-icon.png` | Mascota estática centrada sobre Navy (Android 12+ no anima el splash); se retiene hasta que carga la fuente |
| Notificación | `assets/notification-icon.png` | Silueta blanca sobre transparente (requisito de Android) |

**Diferencia de navy en el ícono:** los assets existentes y `app.json` usan `#0F1B3D`; la paleta define navy `#14233A` (diferencia de pocas unidades RGB, imperceptible a simple vista). **El owner decidió no rehacer el asset.** Si se quisiera alinear, basta cambiar la constante `NAVY` de `scripts/generate-brand-assets.mjs` (hoy `#0F1B3D`) y los dos `backgroundColor` de `app.json`, y regenerar con `node scripts/generate-brand-assets.mjs` (desde `apps/mobile`). Ver Q-D.

**Limitación de la fuente:** la mascota de mayor resolución tiene 373 px. Alcanza para el primer plano adaptativo y la mascota de 32 dp, pero el ícono de 1024 px y la ficha del instalador quedan escalados, y los GIF a 96/144 dp en pantallas xxhdpi se amplían ≈ 1,4×. Pedidos al diseñador (no bloqueantes): ver Q-E.

---

## 9. Decisiones abiertas para el revisor

Las 12 decisiones de la justificación están aprobadas y se aplican tal cual. Queda abierto:

| # | Tema | Qué se decidió provisoriamente | Qué se pide |
|---|------|-------------------------------|-------------|
| Q3 | **Cara del wordmark "Sweet Sin"** (login) | Default **Fraunces Black Italic** (la display de la marca), 32/36 | Confirmar o indicar otra tipografía display; solo cambia `fonts.brand`. |
| Q-A | **Relleno del botón primario** (ya no hay rojo de marca) | `actionFill` = **navy** con etiqueta `actionLabel` vanilla (14,74:1), 56 dp. Motivo: el dorado es el único acento y no sirve como fondo con etiqueta vanilla (3,00) ni como texto (2,81); navy es el color de mayor contraste y ya es "Tinta" del sistema. Presionado: opacidad 0,85 + escala 0,98 (no hay tono más oscuro en la paleta). Link y `info` también navy (subrayado como diferenciador) | Confirmar. Alternativa: primaria en gold con etiqueta navy (4,91:1), a costa de gastar el único acento en cada pantalla de trabajo (contradice el principio 2). |
| C1 | **Conflicto de contraste: `success` `#2F7D5B`** | La justificación cita "4,80:1 / 4,52:1", medidos con los fondos viejos. Con la paleta nueva: vanilla sobre success **4,66** (pasa), success sobre vanilla **4,66** (pasa), **success sobre cream 4,36 (falla 4,5)**. Se mantiene el hex del owner; el par success-sobre-cream queda **prohibido** (texto success solo sobre vanilla, relleno con etiqueta vanilla) | Aceptar la restricción, o aprobar un verde algo más oscuro: `#2C7755` da 4,73 sobre cream y 5,06 sobre vanilla (cambiaría una fila de `colors`). |
| C2 | **Borde gold `pending_sync`** | La justificación daba 2,60:1 (fondo viejo). Nuevo: **3,00 sobre vanilla** (pasa por 0,0003), **2,81 sobre cream** (falla). Sigue aprobado como refuerzo, nunca único portador (regla 1); la píldora solo va dentro de `Card` (vanilla) | Confirmar. |
| Q-D | **Navy del ícono `#0F1B3D` vs paleta `#14233A`** | Se mantiene el asset actual (decisión del owner); diferencia de pocas unidades RGB | Confirmar que no se alinea; si se alinea, cambiar la constante `NAVY` del script y `app.json` y regenerar. |
| Q-E | **Mascota en alta resolución y logo estático** | Fuente de 373 px y respaldo estático `mascot.png` | Pedir al diseñador (no bloqueante): mascota en SVG o PNG ≥ 1024 px, y un PNG estático del logo completo con transparencia (hoy `logo-flat.png` tiene fondo blanco). |
| Q-F | **Glifo `→` de `out_for_delivery`** | La lista del owner (○ ◐ ● ✓ ✕ ↻ ↑ ⊘) no incluye un glifo para "en camino"; se conserva `→` del borrador | Aprobar `→` y sumarlo a la QA de glifos en más de un fabricante, o indicar otro. |
| Q-G | **Valores derivados sin color propio** | `border` = navy 16 %, `tintPressed` = navy 8 %, primaria presionada = opacidad 0,85 (derivados de navy, no entran a la tabla base de 6) | Confirmar. |
| Q-H | **Ubicación de `text.quiet` / `text.brand`** | `textQuiet` es token semántico de color; `text.quiet` (estilo) lo usa; `text.brand` es el estilo del wordmark. `textMuted` del borrador desaparece | Confirmar. |
