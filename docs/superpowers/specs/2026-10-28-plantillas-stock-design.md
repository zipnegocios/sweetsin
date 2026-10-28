# Plantillas de stock y stock de una parada existente (proyecto 2 de 5)

Fecha: 2026-10-28. Estado: borrador para aprobación del owner.

## Contexto y por qué

Hoy el stock de una parada solo se carga al crearla, producto por producto, y nunca se puede cambiar después. El owner recién inaugura el trailer, no maneja todavía detalles logísticos y necesita un sistema **abierto y flexible**: que no obligue a decidir cantidades, mínimos ni rutinas de antemano. Este proyecto agrega plantillas reutilizables y la edición del stock de una parada ya creada.

Es el proyecto 2 de 5 (ver la hoja de ruta en `2026-10-28-paradas-crud-completo-design.md`). El proyecto 3 (abrir/cerrar el trailer, reponer en vivo, "Agotado") y el 4 (delivery) quedan fuera.

## Objetivos

- Plantillas de stock: crear, listar, ver, renombrar, editar su lista de postres y cantidades, archivar, desarchivar y borrar.
- Al crear una parada: elegir una plantilla, cargar el stock a mano, o dejarla sin stock.
- En una parada ya creada: agregar un postre, quitarlo o cambiar su cantidad.
- Guardar el stock de una parada ya armada como plantilla nueva.
- Cada acción del panel tiene su endpoint admin (para la futura APK de administrador).

## No objetivos

- No se confirma el stock al abrir el trailer ni se repone en vivo (proyecto 3).
- No hay stock de delivery ni configuración de stock compartido (proyecto 4).
- No se muestra "Agotado" ni se enlazan pedidos nuevos a paradas (proyecto 3).
- Sin notificaciones, sin historial de cambios de stock.

## Anti-objetivos

- Que el sistema exija una plantilla, un mínimo o un máximo para poder crear o abrir una parada.
- Que editar una plantilla cambie en silencio el stock de paradas ya creadas.
- Que se pueda dejar el stock de un postre por debajo de lo ya vendido.

## Comportamiento acordado con el owner

- Plantillas: se pueden editar, borrar, renombrar y archivar. Puede haber las que se quiera y pueden estar vacías o incompletas.
- Al crear una parada se elige: una plantilla, stock manual, o nada.
- Una parada puede abrir con stock parcial y completarse después.
- **No se puede bajar la cantidad de un postre por debajo de lo ya vendido.** El sistema rechaza el cambio y dice cuánto se vendió.

## Decisiones de diseño (mías, el owner puede cambiarlas)

1. **Copia, no vínculo.** Elegir una plantilla copia sus cantidades a la parada. Editar o borrar la plantilla después no toca paradas existentes. Por eso borrar una plantilla es siempre posible.
2. **Archivar** oculta la plantilla del selector al crear paradas; se puede desarchivar. No afecta a nada ya creado.
3. **Vendido = suma de `quantity` de los `stock_events` de tipo `sale`** de esa fila de `stop_product_stock`. (Corregido al planificar: `max_stock − current_stock` no sirve porque `waste` también baja `current_stock` y `restock` lo sube sin tocar `max_stock`.) Regla de edición de la cantidad de un postre en una parada: nueva cantidad ≥ vendido; `max_stock` pasa a la nueva cantidad y `current_stock` aumenta o disminuye la misma diferencia, sin quedar negativo. Quitar un postre solo es posible si no tiene ningún evento de stock. Esta regla vive en `packages/domain`, no solo en la UI.
4. **Esquema nuevo:** tabla de plantillas (id, nombre, archivada, fechas) y tabla de ítems de plantilla (plantilla, producto, cantidad). Solo agrega tablas; requiere `pnpm --filter @workspace/db run push` (la DB de dev y prod es la misma).
5. **Guardar parada como plantilla** copia las cantidades `max_stock` actuales de la parada.
6. **Endpoints** bajo `/api/admin/` con la misma autorización y patrón que `/api/admin/trailer-stops/**` (sesión admin de Auth.js; la auth por token para la APK sigue pendiente).
7. **Nombres de plantilla** únicos entre las no archivadas, sin distinguir mayúsculas (mi decisión, evita dos "Sábado normal" confusas).

## Lo que queda al constructor

- Rutas exactas de los endpoints y forma de los formularios del panel.
- Textos de interfaz en `packages/i18n` (ambos idiomas, con el test de paridad existente).
- Dónde vive en el menú del admin la gestión de plantillas.
- Si el selector de plantilla en el formulario de nueva parada muestra el resumen de cantidades.

## Lo que ya existe y se reutiliza

`initializeStopStock` y el repositorio de stock (`DrizzleStockRepository`), `trailer-stop-form.tsx`, `requireAdmin`, el detalle de parada del proyecto 1, el patrón de errores de dominio y respuestas de `/api/admin/trailer-stops`.

## Verificación

Tests de dominio de la regla "no bajar de lo vendido", copia de plantilla sin vínculo, archivar/desarchivar y unicidad de nombre. Prueba de integración de los repositorios contra la DB real (con limpieza de datos de prueba). Verificación manual: crear plantilla, crear parada desde ella, editar la plantilla y comprobar que la parada no cambia, subir y bajar cantidades en la parada.
