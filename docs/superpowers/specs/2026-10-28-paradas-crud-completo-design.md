# Paradas del trailer: CRUD completo (proyecto 1 de 5)

Fecha: 2026-10-28. Estado: borrador para aprobación del owner.

## Contexto y por qué

Sweet Sin acaba de inaugurar el trailer. Opera sobre todo fines de semana y feriados, pero el sistema no debe limitarse a esos días. Hoy el panel solo permite crear una parada y marcarla como completada o cancelada: no se puede corregir un error de lugar u hora, el detalle de la parada es casi vacío y el sitio público oculta una parada cancelada sin explicación. El owner necesita **poder cambiar de decisión** sobre una parada y que el cliente lo vea con claridad.

Este es el **proyecto 1 de 5** (ver "Hoja de ruta"). Se diseña y construye solo, sin depender de los demás.

## Hoja de ruta (acordada con el owner)

1. **Paradas completas** (este documento).
2. Plantillas de stock (CRUD con archivar) y agregar productos a una parada ya creada.
3. Abrir y cerrar el trailer (confirmar stock al abrir, reponer en vivo), pedidos asociados a la parada, "Agotado".
4. Jornadas de delivery: interruptor de delivery, stock propio, configuración de stock compartido o separado.
5. Endpoints para una futura APK de administrador. Se construyen en cada etapa, no al final.

## Objetivos

- Editar lugar (con coordenadas), fecha y hora de una parada.
- Cancelar una parada y poder reactivarla.
- Eliminar una parada por completo, con su stock.
- Sitio público (opción A elegida por el owner): la parada que cambió queda en la misma lista con una etiqueta, y el cliente ve el dato anterior.
- Aviso fijo en el sitio: "Las paradas pueden cambiar sin previo aviso".
- Detalle de parada completo en el admin: datos, mapa, estado y acciones.
- Cada acción del panel tiene su endpoint propio, reutilizable por la APK futura de administrador.

## No objetivos

- No se notifica a nadie de los cambios (ni email ni push). El aviso fijo en el sitio cubre eso.
- No se toca el stock (proyecto 2), ni abrir/cerrar el trailer (3), ni pedidos (3), ni delivery (4).
- El estado `active` sigue sin asignarse automáticamente en este proyecto.

## Anti-objetivos (sería un fracaso aunque funcione)

- Que una parada eliminada deje cualquier rastro público (nota, aviso, hueco en la lista).
- Que eliminar y cancelar se confundan: cancelar deja rastro público, eliminar no.
- Que alguien elimine una parada con stock sin enterarse de que el stock se pierde.

## Comportamiento acordado con el owner

### Sitio público ("Find Us")
- Las paradas siguen en una sola lista (opción A).
- **Cancelada:** fecha, hora y lugar tachados, con etiqueta "Cancelada".
- **Cambio de lugar o de fecha:** se muestra el dato nuevo, una etiqueta "Cambió de lugar" o "Cambió de fecha", y el dato anterior en gris ("antes: ...").
- **Eliminada:** desaparece de inmediato, sin nota.
- Aviso fijo bajo el título: "Las paradas pueden cambiar sin previo aviso" (inglés y español).

### Panel admin
- Cada parada se puede editar, cancelar o eliminar.
- **Eliminar** pide confirmación y avisa explícitamente que **el stock de la parada se elimina junto con ella**. Es irreversible.
- Todas las acciones tienen endpoint (ver más abajo).

## Decisiones de diseño (mías, el owner puede cambiarlas)

1. **Datos originales.** Para mostrar "antes: ..." se guardan en la parada los valores originales (lugar, inicio y fin) la primera vez que se edita. Si se edita varias veces, el "antes" siempre es el valor con que se creó la parada, no el penúltimo. Si el lugar vuelve a ser igual al original, la etiqueta desaparece.
2. **Etiquetas derivadas, no almacenadas.** "Cambió de lugar" y "Cambió de fecha" se calculan comparando el valor actual con el original. No hay un estado nuevo en el enum. Se pueden mostrar las dos a la vez.
3. **Estados y transiciones.** `scheduled` puede ir a `cancelled`. `cancelled` puede volver a `scheduled` (reactivar). `completed` no se edita ni se reactiva. Hoy el dominio no valida transiciones: esto agrega la validación en `packages/domain`, no solo en la interfaz.
4. **Visibilidad pública.** Hoy `listActive` oculta las canceladas. Pasa a **incluir las canceladas hasta que venza su `endTime`**, para poder mostrar la etiqueta. Las completadas siguen ocultas. Pasada la hora de fin, todo sale solo.
5. **Eliminar.** Borrado real (no lógico) de la parada y de su stock en una transacción. Si la parada tiene pedidos asociados, se rechaza la eliminación y se sugiere cancelarla (hoy ningún pedido se asocia a una parada, pero el proyecto 3 lo cambiará, así que la guarda se deja desde ya).
6. **Endpoints.** Siguen el patrón de `/api/mobile/**` con autorización de administrador (hoy `authorize-mobile`). Listar, ver, crear, editar, cancelar, reactivar y eliminar. El panel web y los endpoints llaman a los mismos casos de uso del dominio.
7. **Formulario de edición.** Reutiliza el componente `trailer-stop-form` (autocompletado de Places, `LocationPicker`, aviso de solapamiento con reservas de eventos). Se evita duplicar el formulario.
8. **Cambio de esquema.** Columnas nuevas, nullables, en `trailer_stops`: lugar, latitud, longitud, inicio y fin originales. Requiere `pnpm --filter @workspace/db run push` (la DB de dev y prod es la misma).

## Detalles a resolver por quien construye

- Zona horaria: hoy el sitio público formatea en Australia/Adelaide pero el admin usa la zona del navegador, y hay una parada real en WA. Debe elegirse una regla única para interpretar y mostrar la hora en el admin y documentarla. No se resuelve aquí.
- Texto exacto de las etiquetas y del aviso (hay que agregarlos a `packages/i18n`, ambos idiomas, con el test de paridad existente).
- Si el detalle de parada muestra o no el historial de cambios (por ahora solo "antes" vs "ahora").
- Forma exacta de las rutas de los endpoints.

## Lo que ya existe y se reutiliza

`packages/domain/src/trailer-stops` (entidad, puerto, casos de uso), `DrizzleTrailerStopRepository`, `admin-trailer-stops.ts`, `trailer-stop-form.tsx`, `location-picker`, `find-us-client.tsx`, `requireAdmin`, `authorize-mobile`.

## Verificación

Casos de uso con tests de dominio (transiciones, etiquetas derivadas, regla de eliminación). Prueba de integración del repositorio contra la DB real. Verificación manual del sitio público en inglés y español, con una parada cancelada, una con cambio de lugar, una con cambio de fecha y una eliminada.
