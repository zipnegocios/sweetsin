# Sistema de diseño móvil — Sweet Sin Staff
## Documento de justificación (D2 + D3)

**Rol de este documento:** no es una guía de estilo genérica — cada decisión está atada a *por qué* funciona para este usuario, en este contexto físico. Si una decisión te parece arbitraria en algún momento, volvé a esta sección antes de cambiarla.

---

## 1. El contexto que manda el diseño

Esta no es una app de consumo que alguien mira sentado, con buena luz, decidiendo si le gusta. Es una **herramienta de trabajo de campo**, usada en tres contextos físicos muy distintos:

- **Delivery**: a pleno sol, en movimiento, probablemente con una sola mano libre, chequeando la pantalla en segundos entre semáforos o en la puerta de un cliente. Acá un error de lectura (confundir "pendiente de sincronizar" con "entregada") tiene costo real.
- **Despachador**: adentro del local, de pie frente a un mostrador, con más tiempo para mirar pero bajo presión de volumen en hora pico.
- **Admin** (Plan 2, pantalla de escritorio/tablet): sentado, contexto de oficina, puede permitirse más detalle visual.

La decisión central de todo el sistema se deriva de esto: **el delivery es el caso más exigente, y el sistema entero se diseña para que funcione ahí primero** — lo demás hereda esa base y puede relajarse un poco, nunca al revés.

---

## 2. Paleta — 6 colores base

| Nombre | Hex | Rol |
|---|---|---|
| **Tinta** (navy) | `#14233A` | Texto principal, cabeceras, fondo del ícono de la app |
| **Concha** (cream) | `#F6EFE1` | Fondo primario de pantalla — cálido, no blanco clínico |
| **Vainilla** (vanilla) | `#FBF7EC` | Fondo de tarjetas/superficies elevadas sobre Concha |
| **Dorado** (gold) | `#B8872B` | Único acento de marca — estados "en preparación" / listo, usado con moderación |
| **Verde éxito** | `#2F7D5B` | Confirmaciones, "entregada" — fuera de paleta de marca a propósito (ver §4) |
| **Rojo alerta** | `#A6351F` | Errores, conflictos, sesión vencida |

Nada de negro puro, nada de blanco puro: todo el sistema vive en el rango cálido Tinta↔Concha, que es lo que ya tenías con la mascota sobre azul marino. Esto evita el default genérico de "fondo crema + acento terracota" que cualquier generador produciría — acá el crema y el dorado **son** la marca, no una paleta de moda.

---

## 3. Tipografía

Una sola familia para todo el sistema, elegida por legibilidad al sol y a distancia de brazo, no por estética de marca: **Atkinson Hyperlegible** (gratuita, diseñada específicamente para distinguir caracteres fácilmente confundibles — crítico cuando alguien lee un número de orden o una dirección con el sol pegándole a la pantalla). Dos pesos nada más: regular y bold.

La única excepción es el **wordmark "Sweet Sin"** en la pantalla de login — ahí sí entra una tipografía display con personalidad (curva, un poco traviesa, acorde al nombre de la marca), pero nunca se usa en texto operativo. La marca se expresa en los bordes de la experiencia (login, pantallas vacías), nunca compite con la tarea en curso.

---

## 4. Las 12 decisiones + ícono, resueltas

| # | Punto | Resolución | Por qué |
|---|---|---|---|
| 1 | Verde de éxito `#2F7D5B` fuera de marca | **Aprobado** | Un color de "éxito" reconocible universalmente (verde) pesa más que la consistencia de marca en una pantalla que se lee en un segundo, en movimiento. Clearance de contraste ya validado (4,80:1 / 4,52:1). |
| 2 | Texto atenuado `#5A6378`: ¿semántico o base? | **Semántico** (`text.quiet`, no un token de color base) | Este color significa "información secundaria", no "este matiz de gris". Si mañana cambia el fondo (ej. modo oscuro para uso nocturno), el significado debe preservarse aunque el valor hex cambie. |
| 3 | Glifos de estado: Unicode o `@expo/vector-icons` | **Unicode**, sin dependencia nueva | Menos peso en el APK, sin romper si una librería de íconos cambia de versión. **Agregar a QA de Task 8 (dispositivo real):** verificar que los glifos (○ ◐ ● ✓ ✕ ↻ ↑ ⊘) se vean iguales en los teléfonos Android reales del staff — distintos fabricantes (Samsung, Xiaomi) a veces renderizan fuentes de sistema distinto. |
| 4 | Tamaño de etiqueta de píldoras: 11sp o 13sp | **13sp** | A pleno sol, con el brazo extendido, 11sp es el punto donde la gente empieza a acercar el teléfono a la cara. 13sp es la diferencia entre leer de un vistazo o tener que detenerse. |
| 5 | Colores por estado (dorado para `in_prep`/`ready_for_pickup`) | **Aprobado** | Consistente con mantener el dorado como único acento de marca (ver principio en §5). |
| 6 | Borde dorado "pendiente de sincronizar" (2,60:1, bajo) | **Aprobado como refuerzo, no como único portador de significado** | El contraste bajo del borde solo no alcanza para accesibilidad, así que esa pantalla **nunca depende solo del borde**: siempre va acompañado de ícono + texto "Pendiente de sincronizar". El borde es decoración de refuerzo, no el canal de información. |
| 7 | `TextField` compartido en el kit | **No por ahora** | El login es la única pantalla con campos de texto reales; generalizar un componente para un solo uso es sobre-ingeniería hoy. Se revisita si el rol admin (Plan 2) trae formularios más ricos. |
| 8 | PNG del logo completo (hoy solo `mascot.png`) | **Aprobado, no bloqueante** | Pedir al diseñador, seguir con `mascot.png` mientras tanto. |
| 9/D3 | Fondo del ícono de la app: Navy o Cream | **Navy** | En la grilla de íconos del home de Android, rodeado de apps de comida/delivery que suelen usar colores cálidos y saturados (naranjas, rojos), un ícono Navy con la mascota se distingue en vez de mezclarse. Además ya coincide con la vista previa existente — no hay que rehacer el asset. |
| 10 | Valores de movimiento (100/150ms, 16dp, banner 250ms) | **Aprobado** | Transiciones cortas y utilitarias, coherentes con "la marca no compite con la tarea". |
| 11 | Tamaños de mascota animada (login 144dp, vacío 96dp) | **Aprobado** | Proporcional al rol: protagonista en login (momento de marca), discreta en estado vacío (momento operativo). |
| 12 | Tokens `text.brand` y `text.quiet` | **Aprobado**, coherente con el punto 2 — ambos semánticos, no base | — |

---

## 5. Los 4 principios del sistema

1. **Contraste de campo primero.** Todo elemento interactivo y todo indicador de estado debe superar 4,5:1 de contraste contra su fondo, y además estar codificado por ícono + texto, nunca solo por color — así una persona con dificultad para distinguir colores, o con la pantalla lavada por el sol, igual entiende el estado.
2. **La marca vive en los bordes.** El calor de marca completo (mascota animada, dorado, tipografía display) aparece solo en login y en pantallas vacías/de éxito — los momentos emocionales, no los operativos. Durante una tarea activa (cola de entregas, marcar como entregado) la paleta se achica a Tinta/Concha/estado, para que nada compita con la velocidad de lectura.
3. **Un acento, muchos estados.** El dorado es el único color de acento de marca. Los distintos estados se diferencian por glifo e texto, no agregando más colores — así la paleta se mantiene chica y rápida de interpretar bajo presión.
4. **Zona del pulgar.** Las acciones primarias (marcar entregada, agregar evidencia) siempre viven en el tercio inferior de la pantalla, mínimo 56dp de alto — pensado para uso con una sola mano, en movimiento, posiblemente con guantes o con el otro brazo ocupado.

---

## 6. Layout — concepto para `DeliveryQueueScreen`

```
┌─────────────────────────┐
│ ░░ Tinta — cabecera ░░  │  ← nombre, botón salir
├─────────────────────────┤
│  [Banner offline, si]   │
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ Vainilla — tarjeta   │ │  ← una orden por tarjeta,
│ │ ● Pendiente de sync  │ │     alineado a la izquierda,
│ │ Cliente · Dirección  │ │     sin justificar (mejor
│ └─────────────────────┘ │     lectura rápida)
│ ┌─────────────────────┐ │
│ │ ...                  │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│  [ Marcar entregada ]   │  ← 56dp, zona del pulgar,
│  [ + Foto de evidencia ]│     evidencia como paso
└─────────────────────────┘     secundario, opcional
```

Alineación izquierda en todo el contenido operativo (no centrado, no justificado) — es lo que se lee más rápido en una lista que hay que escanear en movimiento.

---

## Qué cambia respecto al documento original

Nada se revierte — las 12 decisiones originales quedan aprobadas tal como estaban propuestas. Lo que este documento agrega es el **por qué**, y dos puntos de atención nuevos para la ejecución:
- QA de glifos Unicode en dispositivos reales distintos (Task 8).
- El borde dorado de "pendiente de sincronizar" nunca debe ser el único portador de esa información en el código — siempre acompañado de ícono y texto.
