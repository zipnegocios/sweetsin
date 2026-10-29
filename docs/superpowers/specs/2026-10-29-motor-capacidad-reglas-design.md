# Motor de capacidad y reglas por producto (proyecto 4) — diseño

Fecha: 2026-10-29. Proyecto 4 de 5 (hoja de ruta en `2026-10-28-paradas-crud-completo-design.md` y `2026-10-28-operacion-trailer-medicion-design.md`). Nota: el dueño pidió seguir sin más preguntas; todo lo marcado **(mi decisión)** es una suposición mía, fácil de cambiar.

## 1. Para qué

Sweet Sin vende postres que hay que contar y preparar a mano. Un pedido grande para entrega a domicilio puede ser imposible de cumplir a tiempo (por ejemplo, 1.000 cafés, o muchas unidades de algo que tarda de 3 a 8 minutos cada una). Hoy el sitio acepta cualquier pedido y el problema aparece después. Este proyecto agrega un motor de reglas que decide **antes de aceptar el pedido** qué se puede despachar, estima cuánto tarda y, cuando no se puede, deja al cliente un camino claro para negociarlo con el negocio.

El motor es genérico: no asume ningún equipo concreto (el proceso real aún no está descrito). Todo se expresa con números configurables.

## 2. Objetivos, no objetivos, anti-objetivos

Objetivos:
- Topes por producto para entrega a domicilio y un interruptor "se vende en línea" por producto.
- Capacidad de preparación: cuántas unidades se alistan a la vez y cuánto tarda cada lote, con pasos opcionales por producto.
- Capacidad de traslado: unidades por viaje y duración de cada viaje.
- Antelación mínima por producto y hora pedida para entregas que la necesiten.
- Una estimación de tiempo visible para el admin y, si el interruptor lo permite, para el cliente.
- Mostrar al admin el tiempo medido real (proyecto 3) junto al configurado, para calibrar a mano.
- Todo apagado por defecto: con el motor apagado el sitio se comporta exactamente como hoy.

No objetivos:
- Prometer una hora de entrega exacta al cliente (etapa 2 de la medición).
- Calibración automática: el sistema muestra la mediana medida, pero el admin decide si cambia el valor.
- Simulación de colas entre varios pedidos simultáneos (el motor evalúa cada pedido por sí solo; ver §9).
- Jornadas de delivery con stock propio (proyecto 5).
- Cambios en la app móvil, salvo los endpoints admin (§8).

Anti-objetivos (sería un fracaso aunque "funcione"):
- Rechazar un pedido de retiro en la parada por culpa del motor: el retiro en el sitio no tiene tope mientras haya stock.
- Rechazos sin explicación o sin salida para el cliente.
- Que un error de configuración (campo vacío) bloquee las ventas: un dato faltante significa "sin límite", no "prohibido".

## 3. Reglas de negocio

1. **Retiro en parada:** nunca lo limita el motor. Solo aplica stock (proyecto 3).
2. **Entrega a domicilio (`self_delivery`):** el motor evalúa cada línea y el pedido completo.
3. **Se vende en línea (por producto):** si está apagado, el producto no se puede pedir en entrega a domicilio; sigue disponible para retiro. Se muestra "Solo en el trailer" en el menú.
4. **Tope de entrega por producto:** cantidad máxima de ese producto en un pedido de entrega a domicilio. Vacío = sin tope.
5. **Antelación mínima por producto (minutos):** si el pedido incluye un producto con antelación, la hora pedida debe ser al menos `ahora + antelación`. Vacío o 0 = sin antelación.
6. **Estimación de preparación:** para cada producto, `lotes = ceil(cantidad / unidadesPorLote)` y `tiempo = lotes × segundosPorLote`, más los pasos opcionales del producto. `unidadesPorLote` es el menor entre las unidades simultáneas del área de trabajo y el tamaño de lote del producto (si lo tiene). El tiempo total es la **suma de los productos** (conservador: se asume que el área de trabajo se usa en secuencia) **(mi decisión)**.
7. **Estimación de traslado:** `viajes = ceil(unidadesTotales / capacidadDelVehículo)`; `tiempo = viajes × minutosPorViaje`. Vacío = un solo viaje de 0 minutos.
8. **Resultado de la evaluación:** `{ ok, razones[], estimación }`. Una razón tiene código (`not_sold_online`, `over_delivery_cap`, `lead_time`, `over_vehicle_trips`) y los datos para mostrarla. El pedido se rechaza si hay al menos una razón con efecto de bloqueo.
9. **Tope de viajes:** ajuste `maxDeliveryTrips` (vacío = sin tope). Si el pedido necesita más viajes, se rechaza con `over_vehicle_trips`.
10. **Salida del cliente cuando se rechaza:** el mensaje explica qué producto o cantidad es el problema, cuánto sí se puede pedir y ofrece contactar al negocio por WhatsApp para negociarlo. No se pierde el carrito.
11. **Motor apagado (`capacityEngineEnabled = false`):** no se aplica ninguna regla, no se muestra ninguna estimación y no se guarda `scheduled_for`. Es el valor por defecto.
12. **Los datos configurados no cambian pedidos ya creados:** la evaluación ocurre al crear el pedido; después no se reevalúa.

## 4. Datos

Cambios de esquema, todos aditivos (la base de desarrollo y producción es la misma; nunca `--force`):

- Tabla `product_capacity_rules` (una fila por producto, única por `product_id`): `sold_online` boolean no nulo default true, `delivery_max_qty` entero nullable, `lead_time_minutes` entero nullable, `batch_units` entero nullable, `batch_seconds` entero nullable.
- Tabla `product_prep_steps`: `id`, `product_id`, `position`, `name`, `seconds`, `mode` (`per_batch` | `per_unit`). Pasos opcionales por producto; el orden solo afecta cómo se muestran.
- Columnas nuevas en `settings` (nullable salvo el interruptor): `capacity_engine_enabled` boolean default false, `work_area_units` entero, `vehicle_capacity_units` entero, `trip_minutes` entero, `max_delivery_trips` entero, `show_estimate_to_customer` boolean default false.
- Columna nueva `orders.scheduled_for` timestamp con zona, nullable: hora pedida por el cliente para entregas que exigen antelación. Se guarda en UTC y se muestra en Australia/Adelaide.

Validaciones: todos los números son enteros positivos; `batch_seconds` sin `batch_units` o al revés se acepta (el que falta cae al valor del área de trabajo / 0); `seconds` de un paso mayor que 0.

## 5. Dominio (`packages/domain/src/capacity`)

Funciones puras, sin dependencias de framework:
- `estimatePreparation(lines, rulesByProduct, stepsByProduct, workAreaUnits) -> { seconds, perProduct[] }`
- `estimateTransport(totalUnits, vehicleCapacityUnits, tripMinutes) -> { trips, minutes }`
- `evaluateDeliveryOrder({ lines, rules, steps, settings, now, scheduledFor }) -> { ok, reasons, estimate }`
- `suggestMeasuredVsConfigured(measuredMedianSecondsByProduct, rulesByProduct)` para la vista de calibración.

Puertos nuevos: `CapacityRulesRepository` (leer/guardar reglas, pasos y ajustes de capacidad). `createOrder` recibe un `capacity` opcional como dependencia: si el interruptor está apagado o no es entrega a domicilio, no se llama.

## 6. Casos de uso y casos límite

1. Motor apagado: ningún cambio de comportamiento (pruebas de regresión del checkout actual).
2. Retiro con cantidad enorme: se acepta si hay stock.
3. Entrega con producto `sold_online = false`: rechazo `not_sold_online`.
4. Entrega con cantidad igual al tope: se acepta; tope + 1: rechazo con la cantidad permitida.
5. Dos productos, uno ilimitado y otro con tope: solo el segundo bloquea.
6. Producto sin regla: sin límite, sin tiempo de preparación (se estima 0 y se avisa "sin dato" en el admin).
7. Antelación 120 min y `scheduled_for` en 30 min: rechazo `lead_time` con la hora mínima posible; sin `scheduled_for`: rechazo pidiendo una hora.
8. `scheduled_for` en el pasado o a más de 60 días: rechazo de validación.
9. Cantidad 1.000 con lote de 50 y 90 s: 20 lotes = 1.800 s. Cantidad 1: 1 lote.
10. Pasos `per_unit` y `per_batch` mezclados: se suman con la regla de §3.6.
11. Vehículo de 100 unidades y pedido de 250: 3 viajes; con `maxDeliveryTrips = 2`, rechazo.
12. Valores en 0 o negativos en la configuración: se rechazan al guardar.
13. Cambiar la configuración mientras hay un carrito abierto: la evaluación final ocurre al enviar el pedido; el servidor es la autoridad, la interfaz solo anticipa.
14. Producto desactivado (`available = false`): lo sigue rechazando `createOrder` (proyecto 3), antes que el motor.
15. Pedido mixto con café y dulces: se evalúa por producto, no por categoría.
16. `show_estimate_to_customer` se conserva como ajuste pero **aún no tiene efecto**: el cliente no ve ninguna estimación hasta que exista una real (la antelación mínima no es un tiempo de preparación).
17. Dos admins editando reglas a la vez: gana el último guardado; se muestra la hora de la última modificación.
18. Calibración sin datos medidos: se muestra "sin datos" y no se sugiere nada.
19. Muestra pequeña (menos de 10 pedidos medidos): se muestra el valor con aviso, igual que el reporte del proyecto 3.

## 7. Interfaz

- **`/admin/capacity`** (nueva, en el menú): interruptor general, valores del área de trabajo y del vehículo, y una tabla de productos con las cinco reglas editables por fila y sus pasos. Cada campo explica qué hace. Junto al tiempo configurado de cada producto se muestra la mediana medida del proyecto 3 y cuántos pedidos la respaldan.
- **Simulador** en la misma página: el admin elige productos y cantidades y ve el resultado de `evaluateDeliveryOrder` (razones y tiempos) sin crear un pedido.
- **Checkout:** si la entrega a domicilio se rechaza, mensaje con la razón y botón de WhatsApp; si un producto exige antelación, aparece un selector de fecha y hora (Australia/Adelaide). Menú: etiqueta "Solo en el trailer" y topes visibles cuando aplican.
- **Detalle de pedido (admin):** muestra la hora pedida (`scheduled_for`, en Adelaida). Guardar la estimación calculada en el pedido queda para después (no se persiste).
- Textos en inglés y español (tuteo).

## 8. API admin (para la futura APK admin)

Cada pieza nace con endpoint, protegido igual que el resto de `/api/admin/**`:
- `GET/PUT /api/admin/capacity/settings`
- `GET/PUT /api/admin/capacity/products/[id]` (regla y pasos)
- `POST /api/admin/capacity/simulate`
- `GET /api/admin/capacity/calibration`

Reglas del repositorio: un id que no es UUID responde 404; errores de dominio mediante `domainErrorResponse`; las Server Actions devuelven `{ ok }`.

## 9. Limitaciones aceptadas

- El motor evalúa cada pedido aislado: no sabe cuántos pedidos grandes hay ya en cola. La carga conjunta del área de trabajo queda para una mejora posterior, cuando haya datos de medición reales.
- La estimación suma productos en secuencia (conservadora). Si el negocio trabaja productos en paralelo, la estimación saldrá alta.
- Sin horario de atención: `scheduled_for` solo valida antelación mínima, no horas de apertura.

## 10. Verificación

- Pruebas unitarias del dominio con los casos de §6 (incluidos 1, 4, 7, 9, 11).
- Pruebas de repositorio contra la base real para reglas, pasos y ajustes.
- Regresión: con el motor apagado, las pruebas del checkout actual pasan sin cambios.
- Prueba manual en el navegador (guía en `handoff.md`): configurar un producto con tope 5, pedir 6 por entrega y ver el rechazo con WhatsApp; pedir 6 por retiro y ver que pasa.

## 11. Pendiente de confirmar con el dueño

Todo lo marcado **(mi decisión)** más: si el cliente debe ver la estimación de tiempo (`show_estimate_to_customer`, apagado por defecto), y el número de WhatsApp al que se redirige la negociación (se reutiliza el que ya usa el checkout).
