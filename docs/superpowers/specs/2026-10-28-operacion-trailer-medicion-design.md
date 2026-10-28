# Operación del trailer, pedidos ligados a paradas y medición de tiempos (proyecto 3 de 5)

Fecha: 2026-10-28. Estado: borrador para aprobación del owner. Las decisiones marcadas "(mi decisión)" son supuestos míos que el owner puede cambiar.

## Contexto y por qué

El trailer vende los mismos postres y cafés en el sitio y en la parada, y el stock es lo que garantiza que se puede despachar lo que se vende. Hoy:

- Una parada pasa de `scheduled` a `active` solo por edición manual de estado; no hay "abrir" ni "cerrar" con significado operativo.
- El stock de una parada se carga al crearla y se edita desde el panel (proyecto 2), pero no hay reposición ni merma desde el panel, aunque `restockProduct` y `reportStockWaste` existen en el dominio.
- Los pedidos **nunca** se ligan a una parada (`checkout.ts` escribe `stopId: null`), así que el stock jamás baja con una venta real. El descuento ya está implementado en `confirmOrderPayment` (solo corre si la orden tiene `stopId`).
- No se mide ningún tiempo: la orden solo guarda `createdAt` y `updatedAt`, no cuándo pasó por cada estado ni quién la movió.
- Los pedidos de retiro (`pickup`) no tienen transición a "entregada": se quedan en `ready_for_pickup` para siempre.
- No existe página de Settings en el panel; la tabla `settings` es una fila única con columnas tipadas (`deliveryFeeCents`, `deliveryEvidenceRequired`).

Este proyecto resuelve eso en tres bloques y deja listo el terreno para el motor de capacidad del proyecto 4. Es el proyecto 3 de 5 (hoja de ruta en `2026-10-28-paradas-crud-completo-design.md`; la numeración cambió: ver "Hoja de ruta actualizada").

## Hoja de ruta actualizada (acordada con el owner)

1. Paradas CRUD completo: hecho.
2. Plantillas de stock y stock de paradas existentes: hecho.
3. **Este proyecto:** abrir/cerrar el trailer, reposición y merma en vivo, pedidos ligados a paradas, "Agotado", medición de tiempos para el equipo interno y página de Settings con interruptores.
4. Motor de capacidad y reglas por producto: pasos de preparación con recursos (plancha de 50 piezas a 50 s, etc.), tandas de preparación y de traslado, capacidad del vehículo, topes de delivery por producto, antelación mínima, interruptor "se vende en línea" por producto. Se calibra con los tiempos medidos en este proyecto.
5. Jornadas de delivery con stock propio y configuración de stock compartido o separado.
6. (Transversal) Endpoints admin para la futura APK de administrador, construidos en cada etapa.

## Objetivos

- Abrir y cerrar una parada con significado operativo: revisar y confirmar el stock al abrir, ver el resumen al cerrar.
- Reponer stock y reportar merma desde el panel mientras la parada está abierta.
- Ligar los pedidos de retiro a una parada, descontar stock con la venta y mostrar "Agotado" cuando un postre se acaba.
- Registrar cada cambio de estado de un pedido con hora y autor, y calcular tiempos por tramo.
- Un reporte interno para ver dónde se pierde tiempo y qué pedidos tardan más, comparable por tipo de pedido, tamaño, composición (café vs dulces), día y persona.
- Una página de Settings con interruptores para encender o apagar cada función nueva.
- Cada acción del panel tiene su endpoint admin.

## No objetivos

- Tiempos estimados por producto, pasos de preparación, capacidad de la plancha o del vehículo, tandas y topes de delivery por producto (proyecto 4).
- Prometer una hora de entrega al cliente (etapa 2 de la medición, después del proyecto 4).
- Stock propio para delivery y pedidos de delivery ligados a paradas (proyecto 5). En este proyecto un pedido `self_delivery` sigue con `stopId: null` y no descuenta stock.
- Cobro en el sitio (punto de venta presencial) y reembolsos automáticos de Stripe.
- Historial de cambios de stock más allá de los `stock_events` que ya existen.
- Notificaciones al cliente por cambios de parada o stock.

## Anti-objetivos

- Que abrir una parada exija tener stock, una plantilla o cantidades mínimas.
- Que una venta deje el stock en negativo o que dos clientes compren la misma última unidad.
- Que apagar la medición o un interruptor rompa el flujo de pedidos.
- Que la medición se convierta en vigilancia: el reporte es de uso interno del admin y no se muestra a deliveries ni despachadores.
- Que aparezcan números inventados: lo que no se midió se muestra como "sin datos", nunca como cero.

## Comportamiento acordado con el owner

- Primero se mide para el equipo interno (despachadores, deliveries, admin); la promesa de tiempo al cliente es la etapa 2.
- Importan por igual los pedidos grandes (por ejemplo $100 o $200 en cafés, solos o mezclados con dulces) y los pequeños, porque hay que ver qué pedido toma más tiempo que otro.
- Todo lo nuevo se puede encender o apagar desde Settings.
- Retiro en el sitio no tiene tope de cantidad mientras haya stock en la parada. Los topes de delivery son del proyecto 4.
- Cafés y jugos pueden formar parte de los pedidos (la categoría `coffee` ya existe en el catálogo).

## Diseño

### 1. Abrir y cerrar una parada

Transiciones nuevas con significado (se suman a las del proyecto 1: `scheduled→cancelled`, `cancelled→scheduled`, `scheduled|active→completed`):

- **Abrir** (`scheduled→active`): muestra el stock de la parada producto por producto (vendido, disponible) y permite ajustar cantidades con las mismas reglas del proyecto 2 antes de confirmar. Botón "Confirmar y abrir". Con el interruptor `requireStockConfirmationOnOpen` apagado, abrir es un clic sin revisión.
- Abrir con stock vacío o parcial es válido (anti-objetivo: no exigir). Se muestra un aviso, no un bloqueo.
- Solo una parada activa a la vez (mi decisión, el trailer es físico). Abrir otra mientras hay una activa se rechaza con el nombre de la parada activa. Interruptor `allowMultipleActiveStops`, apagado por defecto.
- Se puede abrir antes o después de `startTime`; no hay restricción de hora. Si la hora de cierre ya pasó, la lista marca "pasó la hora de cierre" pero no cierra sola (mi decisión: flexible, no hay cierre automático).
- **Cerrar** (`active→completed`): muestra un resumen (vendido, merma, sobrante y productos agotados por producto) y la cantidad de pedidos de esa parada aún sin entregar. Si hay pedidos sin entregar, se advierte y se exige confirmación; esos pedidos siguen siendo válidos y se pueden terminar de despachar después del cierre.
- Cerrar no modifica ningún número de stock (el sobrante no se convierte en merma).
- Una parada cerrada no se reabre (coherente con la regla del proyecto 1: `completed` no se edita). Cerrar por error es un caso conocido; queda como mejora futura si resulta frecuente.
- Cancelar una parada que tiene pedidos pagados sin entregar se rechaza con el número de pedidos; el admin debe resolverlos primero (cierra el pendiente "cancelar parada activa" del proyecto 1).

### 2. Reposición y merma en vivo

- En el detalle de una parada `active` el admin puede registrar reposición (`restock`, sube el stock actual sin tocar el máximo) y merma (`waste`, baja el stock actual con motivo opcional), reutilizando `restockProduct` y `reportStockWaste`.
- Ambas devuelven resultado `{ ok }` en vez de lanzar (patrón del proyecto 2), con cantidad entera positiva validada.
- Merma mayor al stock actual se rechaza con mensaje claro. Reposición o merma en una parada que no está `active` se rechaza.
- Cada registro guarda el usuario que lo reportó (`reportedByUserId`).
- Hay interruptor `liveStockEnabled` (encendido por defecto); apagado, esas acciones se ocultan y los endpoints responden 409.

### 3. Pedidos ligados a paradas, stock y "Agotado"

Alcance: pedidos de retiro (`pickup`). Los de `self_delivery` quedan con `stopId: null` hasta el proyecto 5.

- El checkout de retiro pide elegir la parada. Se ofrecen la parada `active` y las `scheduled` que aún no terminaron (pre-pedido, mi decisión). Nunca `completed` ni `cancelled`.
- Para cada producto se muestra la cantidad disponible de esa parada. Un producto sin fila de stock en esa parada no se puede pedir ahí. Un producto con stock 0 se muestra "Agotado" y no se puede agregar.
- Si el cliente pide más de lo disponible, se le ofrece la cantidad máxima disponible de ese producto y nada más; no se rechaza todo el pedido.
- El stock se descuenta al confirmarse el pago (`confirmOrderPayment`, ya implementado) como evento `sale`. El pedido de WhatsApp lo confirma el personal desde el panel cuando recibe el pago.
- Para no vender dos veces la última unidad, el descuento debe ser atómico: un solo `UPDATE ... WHERE current_stock >= cantidad` (mismo patrón que `setQuantity`). Si el stock ya no alcanza al confirmar, el pago no se revierte; el pedido queda marcado como **"requiere atención"** (campo visible en la cola y en `/admin/orders`) para que el equipo lo resuelva con el cliente (mi decisión: Stripe ya cobró, no se puede fallar en silencio ni vender de más).
- Cancelar una orden ya pagada devuelve el stock: nuevo tipo de evento `sale_reversal` (cambio aditivo en el enum `stock_event_type`, requiere `db push`). "Vendido" pasa a ser `sum(sale) − sum(sale_reversal)`, para que la guarda "no bajar de lo vendido" del proyecto 2 siga correcta.
- "Agotado" se deriva (stock actual = 0 en una parada activa o programada), no se guarda. Cuando una venta deja un producto en 0, se registra un evento `early_sellout` (tipo que ya existe) una sola vez, para el reporte. La sección pública y el checkout leen el mismo cálculo.
- Interruptor `autoSoldOutEnabled` (encendido por defecto). Apagado, no se bloquea ni se marca nada y el stock solo se descuenta.
- Retiro: nueva transición `ready_for_pickup → delivered` para pedidos `pickup` ("Entregado al cliente"), hoy inexistente. Sin ella no se puede cerrar ni medir un pedido de retiro. La acción la hace el despachador o el admin.

### 4. Medición de tiempos

**Datos.** Tabla nueva `order_status_events` (solo agrega): `id`, `order_id`, `from_status` (nullable), `to_status`, `recorded_at` (hora del servidor), `occurred_at` (hora en que ocurrió realmente), `actor_user_id` (nullable, p. ej. webhook de Stripe), `source` (`web`, `mobile`, `webhook`, `system`). Se escribe en la misma operación que el cambio de estado, en la capa de dominio/repositorio, nunca desde la UI. También se registra el cambio de `payment_status` a `paid` como evento propio (columna `kind`: `fulfillment` o `payment`, mi decisión).

- `occurred_at` es igual a `recorded_at` salvo cuando la app móvil envía la hora en que el repartidor tocó "Marcar entregada" estando sin conexión; el servidor la acepta solo si no es futura y tiene menos de 24 horas (mi decisión). Esto evita medir como "reparto lento" un pedido que solo esperó señal.
- Un cambio de estado repetido (no-op, p. ej. reintento offline idempotente) no genera evento.
- No hay datos retroactivos: los pedidos anteriores no tienen eventos y el reporte los excluye ("sin datos").
- Interruptor `timingEnabled` (encendido por defecto): apagado, deja de registrar; los eventos ya guardados se conservan.

**Tramos** (con las transiciones que ya existen más la de retiro):

| Tramo | De → a | Aplica |
|---|---|---|
| Espera en cola | `received → in_prep` | todos |
| Preparación | `in_prep → ready_for_pickup` | todos |
| Espera de asignación | `ready_for_pickup → out_for_delivery` | delivery |
| Reparto | `out_for_delivery → delivered` | delivery |
| Espera de retiro | `ready_for_pickup → delivered` | retiro |
| Total | `received → delivered` | todos |

La carga del vehículo cae dentro de "espera de asignación" y no se separa en este proyecto; estados más finos (cargando, en tanda 2 de 3) son del proyecto 4.

**Reporte** en el panel (`/admin/reports/fulfillment`, mi decisión de ruta): por tramo muestra cantidad de pedidos, mediana y percentil 90 (no solo promedio, porque los pedidos grandes distorsionan). Se puede agrupar y filtrar por:

- día o semana (hora de Adelaida, helper existente), parada y rango de fechas;
- tipo (retiro / delivery) y canal (web / whatsapp);
- tamaño por unidades (1–5, 6–20, 21–50, más de 50, mi decisión) y por monto;
- composición: solo café, solo dulces, mixto (según `products.category`);
- persona: quién movió el pedido (despachador) y quién lo entregó (delivery). Interruptor `showPerStaffBreakdown` (encendido por defecto, solo admin).

Además: lista de los 10 pedidos más lentos con enlace al pedido, los pedidos aún en curso mostrados aparte (sin entrar en las medianas), los cancelados excluidos, un aviso cuando un grupo tiene menos de 5 pedidos ("muestra pequeña") y exportación a CSV. Un tramo sin datos se muestra "sin datos".

### 5. Página de Settings

Nueva `/admin/settings` (no existe hoy), con sección "Operación del trailer" que edita interruptores guardados como columnas booleanas nuevas de la fila única de `settings` (patrón existente: columnas tipadas, no clave-valor). Interruptores y valores por defecto:

| Interruptor | Defecto |
|---|---|
| `requireStockConfirmationOnOpen` | encendido |
| `allowMultipleActiveStops` | apagado |
| `liveStockEnabled` | encendido |
| `autoSoldOutEnabled` | encendido |
| `timingEnabled` | encendido |
| `showPerStaffBreakdown` | encendido |

La misma página mostrará los ajustes que ya existen en la tabla (`deliveryFeeCents` y `deliveryEvidenceRequired`) para que Settings sea el lugar único. Cada interruptor tiene una línea que explica qué hace. El proyecto 4 sumará aquí sus reglas. Endpoint admin `GET/PUT /api/admin/settings`.

### 6. Endpoints admin (todos con sesión admin de Auth.js, mismo patrón que `/api/admin/trailer-stops/**`)

- `POST /api/admin/trailer-stops/[id]/open` y `/close` (cuerpo opcional con ajustes de stock al abrir y confirmación al cerrar).
- `POST /api/admin/trailer-stops/[id]/stock/[productId]/restock` y `/waste`.
- `GET /api/admin/reports/fulfillment` (filtros por query, CSV con `?format=csv`).
- `GET/PUT /api/admin/settings`.
- Marcar un pedido de retiro como entregado reutiliza la actualización de estado de `/admin/orders` y el endpoint móvil del despachador.
- La auth por token para la APK de administrador sigue pendiente (igual que en el proyecto 1).

## Decisiones tomadas tras la revisión del constructor (mis decisiones)

1. **Descuento todo o nada.** El descuento de todas las líneas de un pedido ocurre en una sola transacción de base de datos (método nuevo del repositorio de stock). Si una línea no alcanza, no se descuenta ninguna y el pedido queda "requiere atención" sin stock tocado. Hoy el bucle de `confirmOrderPayment` descuenta línea por línea después de `markAsPaid`; hay que cambiarlo (el texto "ya implementado" de arriba se refiere solo al enlace entre pedido y parada).
2. **Retiro entregado.** `ready_for_pickup → delivered` para pedidos `pickup` no exige repartidor asignado: se separa la rama `delivered` de `changeOrderFulfillmentStatus` según el tipo. La pueden hacer el admin y el despachador; el endpoint móvil del despachador se extiende con esa acción.
3. **Elección de parada en el sitio.** La parada se elige primero, arriba del menú y del carrito, solo para retiro. Cada línea del carrito se limita a la cantidad disponible al agregarla y el servidor revalida todo al crear el pedido (`createOrder` valida stock y estado de la parada). Si el cliente cambia de parada, las líneas se recortan a lo disponible en la nueva y se le avisa qué cambió.
4. **"Requiere atención".** Un pedido en ese estado no entra a la cola del despachador. El admin lo ve en `/admin/orders` con el motivo y puede: reintentar el descuento (tras reponer stock), cancelarlo (el reembolso se hace a mano fuera del sistema) o marcarlo resuelto. Cancelarlo no genera `sale_reversal` porque no descontó nada.
5. **Reversión exacta.** `stock_events` gana una columna nullable `order_id`. Cada evento `sale` guarda su pedido, y `sale_reversal` solo se crea si hay `sale` de ese pedido sin reversión; así cancelar dos veces no devuelve dos veces.
6. **Reversión y topes.** `sale_reversal` suma al stock actual (como `restock`, sin tope por `maxStock`) y se permite también en paradas cerradas. La fórmula de "vendido" (`sale − sale_reversal`) se actualiza en el dominio y el repositorio del proyecto 2, con sus pruebas.
7. **Pedidos sin pagar y paradas.** Los pedidos `pending` (p. ej. WhatsApp esperando pago) no bloquean cancelar la parada: se cancelan junto con ella. Solo bloquean los pagados sin entregar. Al cerrar una parada, los `pending` siguen siendo pagables.
8. **Pre-pedidos y edición de la parada.** Se permite editar hora y lugar de una parada con pre-pedidos (aparece la etiqueta pública de cambio ya existente). Avisar a los clientes queda fuera de alcance.
9. **Hora del cliente.** La acepta solo el comando "Marcar entregada" de la app móvil. No se crean eventos sintéticos para pedidos en curso al desplegar: sus primeros tramos aparecen como "sin datos".
10. **Composición.** Café = categoría `coffee`; dulces = `sin` y `virtue`. "Solo café" = 100 % de las unidades de café, "solo dulces" = 0 %, cualquier otra cosa = "mixto".

## Casos de uso y casos límite (pruebas obligatorias del dominio)

**Abrir y cerrar**
- Abrir una parada con stock completo, parcial y vacío (válido en los tres).
- Abrir con otra parada activa: rechazo con el nombre; con `allowMultipleActiveStops` encendido, permitido.
- Abrir una parada `cancelled` o `completed`: rechazo. Abrir una parada ya `active`: no-op sin error.
- Ajustar una cantidad por debajo de lo vendido al abrir: rechazo con la regla del proyecto 2.
- Cerrar con pedidos sin entregar: advertencia y confirmación; cerrar sin ellos: directo; cerrar una parada no activa: rechazo.
- Cancelar una parada con pedidos pagados pendientes: rechazo; sin ellos: permitido.

**Stock en vivo**
- Reponer en una parada activa; reponer en una cerrada: rechazo.
- Merma igual al stock actual (queda en 0), mayor (rechazo), con y sin motivo.
- Cantidades no enteras, cero o negativas: rechazo.

**Pedidos y stock**
- Pedido con dos clientes sobre la última unidad: exactamente uno descuenta; el otro queda "requiere atención".
- Pedido con producto sin fila de stock en la parada, con producto `available=false`, con cantidad mayor a la disponible (se ofrece el máximo).
- La parada se cierra o se cancela entre el checkout y el pago: el pago confirma el pedido si la parada no está cancelada; si lo está, queda "requiere atención".
- Webhook de Stripe duplicado: un solo descuento (ya cubierto por idempotencia; se añade prueba de stock).
- Pago de WhatsApp confirmado tras cerrarse la parada: se descuenta igual (el stock de una parada cerrada solo se mueve por ventas ya comprometidas).
- Cancelar un pedido pagado devuelve el stock y registra `sale_reversal`; cancelar uno sin pagar no toca stock; cancelar dos veces no devuelve dos veces.
- Producto que llega a 0 por venta registra un solo `early_sellout`; reponer y volver a agotar registra otro.
- Pedido `self_delivery`: `stopId: null`, sin descuento (documentado como proyecto 5).

**Medición**
- Recorrido completo de delivery y de retiro genera los eventos esperados con actor y fuente.
- Cancelación en cualquier estado cierra la cuenta sin tramo "total".
- Reintento offline idempotente no duplica eventos; hora del cliente futura o de hace más de 24 horas se ignora y se usa la del servidor.
- Pedido con eventos incompletos (p. ej. anteriores a la función): excluido de las medianas, no cero.
- Mediana y percentil 90 con 1, 2 y muchos datos; grupos con menos de 5 se marcan.
- Pedido solo café, solo dulces y mixto se clasifican bien; pedido de una sola unidad y de 200.
- Hora de Adelaida en el cambio de horario (primer domingo de octubre y de abril): el agrupamiento por día no pierde ni duplica pedidos.
- Con `timingEnabled` apagado no se escriben eventos y el flujo de pedidos no cambia.

**Settings**
- Cada interruptor cambia el comportamiento descrito y su valor por defecto aplica en una base existente (columnas con default).
- Solo el admin lee y escribe Settings; un usuario sin sesión recibe 401 y uno sin rol 403.

## Lo que queda al constructor

- Nombres exactos de tablas, columnas, rutas de Server Actions y componentes del panel.
- Textos de interfaz en `packages/i18n` (ambos idiomas, con el test de paridad existente).
- Diseño visual del reporte (tablas o gráficos simples) y de la página de Settings.
- Dónde vive en el menú del admin "Settings" y "Reportes".
- Forma exacta del estado "requiere atención" (campo booleano o motivo) y cómo se limpia al resolverlo.

## Lo que ya existe y se reutiliza

`confirmOrderPayment` y `decrementStockOnSale`, `restockProduct`, `reportStockWaste`, `setStopProductQuantity` y su patrón de UPDATE atómico, `ALLOWED_TRANSITIONS` y `changeOrderFulfillmentStatus`, `adelaide-time.ts`, `requireAdmin`/`authorizeAdmin`, el patrón de Server Actions con `{ ok }` y de errores de dominio, la tabla `settings`, y el enum `stock_event_type` (con `early_sellout`).

## Cambios de esquema (todos aditivos; requieren `pnpm --filter @workspace/db run push`, la DB de dev y prod es la misma)

- Tabla nueva `order_status_events`.
- Valor nuevo `sale_reversal` en el enum `stock_event_type`.
- Columnas booleanas nuevas en `settings` (con default).
- Campo "requiere atención" (con motivo) en `orders`.
- Columna nullable `order_id` en `stock_events`.

## Verificación

Pruebas de dominio de cada caso de la lista anterior (obligatorias, en `packages/domain`); pruebas de integración de los repositorios contra la DB real con limpieza de datos de prueba; `pnpm run typecheck`, `pnpm run test` y `next build`. Verificación manual en el navegador: crear parada con stock, abrirla, hacer un pedido de retiro que agote un producto y ver "Agotado", pagarlo, reponer, cerrar la parada, recorrer un pedido por todos los estados y abrir el reporte.
