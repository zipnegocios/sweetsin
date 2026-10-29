# Jornadas de delivery con stock propio (proyecto 5) — diseño

Fecha: 2026-10-29. Proyecto 5 de 5. Todo lo marcado **(mi decisión)** es una suposición mía, fácil de cambiar. Lo que dijo el dueño: el delivery es simple (empacar lo pedido por la web y transportarlo en el vehículo); un interruptor en Settings enciende o apaga el control; encendido, aplica stock y las reglas del motor de capacidad (proyecto 4); apagado, las entregas se reciben como hoy.

## 1. Para qué

Hoy un pedido `self_delivery` no se liga a nada y no descuenta stock (`stopId: null`). El negocio quiere poder controlar qué se promete a domicilio contra lo que realmente se alistó para repartir, sin afectar el stock que está en el trailer.

## 2. Objetivos, no objetivos, anti-objetivos

Objetivos:
- Interruptor `deliveryStockControlEnabled` (apagado por defecto) en `/admin/settings`.
- Encendido: la entrega exige una **jornada de delivery abierta**, descuenta su stock (todo o nada, idempotente) y pasa por las reglas del proyecto 4.
- Ajuste `deliveryStockMode`: `separate` (la jornada tiene stock propio) o `shared` (descuenta del stock de la parada activa). Por defecto `separate` **(mi decisión)**.
- Endpoints admin para cada pieza (futura APK admin).

No objetivos:
- Cambios en la app del repartidor.
- Rutas, horarios de atención o varias jornadas simultáneas con asignación por zona.
- Reabrir una jornada cerrada.

Anti-objetivos:
- Con el interruptor apagado, el comportamiento debe ser idéntico al actual (sin jornada, sin stock, sin cambios en el checkout).
- Que el retiro en la parada cambie en algo.
- Vender dos veces la última unidad, o fallar en silencio cuando el stock no alcanza.

## 3. Reglas de negocio

1. Interruptor apagado: nada de este proyecto se aplica.
2. Interruptor encendido, modo `separate`: el pedido `self_delivery` se liga a la jornada abierta (`orders.delivery_jornada_id`). Sin jornada abierta se rechaza con una razón nueva `no_open_jornada` y salida por WhatsApp (mismo camino que `CapacityRejectedError`).
3. Modo `shared`: no hay jornada; el pedido se liga a la parada `active` (`stopId`) y descuenta de su stock. Sin parada activa se rechaza con `no_open_jornada`. Una parada activa se comparte con el retiro **(mi decisión)**.
4. Orden de evaluación: producto disponible (proyecto 3) → reglas de capacidad (proyecto 4) → existencia de jornada/parada → stock.
5. Una sola jornada abierta a la vez **(mi decisión)**. Abrir otra mientras hay una abierta se rechaza.
6. El stock se descuenta al confirmarse el pago, igual que el retiro (`decrementForOrder`, atómico, evento `sale`). Si no alcanza, el pedido queda en "requiere atención" (`orders.attention_reason`, `insufficient_stock`). Cancelar devuelve con `sale_reversal`.
7. Si el cliente pide más de lo disponible, se ofrece la cantidad máxima disponible, igual que el retiro. Producto sin fila de stock en la jornada: no se puede pedir a domicilio.
8. Cerrar una jornada con pedidos aún sin entregar se permite (el reparto continúa); no acepta pedidos nuevos. Lo no vendido queda registrado como sobrante en el cierre, solo informativo **(mi decisión)**.
9. Con la jornada abierta se puede reponer y registrar merma, regidos por `liveStockEnabled`, igual que las paradas.
10. Cambiar el interruptor o el modo no toca pedidos ya creados.

## 4. Datos (aditivos; DB compartida; nunca `--force`)

> **Nota (ruling del plan, implementado):** una jornada es una fila de `trailer_stops` con `kind = 'delivery'`. **No existen** la tabla `delivery_jornadas`, la columna `orders.delivery_jornada_id`, `closed_at` ni `opened_by_user_id`: el pedido se liga con el `orders.stop_id` existente y el stock usa `stop_product_stock`/`stock_events`. Los estados reales son los de `trailer_stops`: una jornada se crea `active` (abierta) y al cerrarse pasa a `completed`; `scheduled` no se usa para jornadas. Lo que sigue en esta sección es el diseño original.


- Tabla `delivery_jornadas`: `id`, `name` (opcional), `status` (`open` | `closed`), `opened_at`, `closed_at`, `opened_by_user_id`.
- Stock por jornada: reutilizar la estructura y los eventos de stock de paradas si el código existente lo permite sin duplicar (el plan decide: tabla `delivery_jornada_stock` análoga o generalizar `trailer_stop_stock`/`stock_events` con una referencia opcional a la jornada). Prioridad: no duplicar lógica de `decrementForOrder`.
- `orders.delivery_jornada_id` nullable.
- `settings`: `delivery_stock_control_enabled` boolean default false; `delivery_stock_mode` enum/texto default `separate`.
- Plantillas de stock existentes se pueden copiar a una jornada al abrirla **(mi decisión)**.

## 5. Interfaz

- `/admin/settings`: el interruptor y el selector de modo, cada uno con una línea que explica qué hace.
- `/admin/jornadas` (nueva, en el menú): abrir (nombre opcional + stock inicial o plantilla), ver stock vendido/disponible, reponer, merma y cerrar. Lista de jornadas pasadas con vendido y sobrante.
- Checkout de entrega a domicilio (solo con el interruptor encendido): muestra cantidades disponibles, "Agotado" y el rechazo `no_open_jornada` con WhatsApp. Textos en inglés y español.
- Detalle de pedido admin: muestra la jornada ligada.

## 6. API admin

Sesión admin de Auth.js, id no UUID → 404, `domainErrorResponse`, Server Actions devuelven `{ ok }`:
- `GET /api/admin/jornadas`, `POST` (abrir), `GET /api/admin/jornadas/[id]`
- `POST /api/admin/jornadas/[id]/close`
- `POST /api/admin/jornadas/[id]/stock/[productId]/restock` y `/waste`
- `GET/PUT /api/admin/settings` (extendido con los dos ajustes)

## 7. Casos límite a cubrir

1. Interruptor apagado: regresión completa del checkout actual.
2. Encendido sin jornada: rechazo `no_open_jornada`; el retiro sigue pasando.
3. Pedido igual al stock de la jornada: pasa; stock + 1: se ofrece el máximo.
4. Pago llega sin stock suficiente: "requiere atención".
5. Cancelación de pedido pagado: `sale_reversal`.
6. Dos pedidos concurrentes por la última unidad: solo uno descuenta.
7. Modo `shared` sin parada activa: rechazo; con parada activa: descuenta de la parada.
8. Cerrar jornada con pedidos en reparto: no se rompen; nuevos pedidos rechazados.
9. Abrir segunda jornada con una abierta: rechazo.
10. Rechazo del motor de capacidad antes que el de jornada.
11. Cambiar modo con jornada abierta: no mueve stock ya descontado.

## 8. Limitaciones aceptadas

- Una jornada a la vez; no hay stock por zona.
- El sobrante no se devuelve automáticamente a ningún inventario.
- El modo `shared` mezcla ventas de retiro y entrega en la misma parada.

## 9. Verificación

Pruebas de dominio para los casos de §7, pruebas de repositorio contra la DB real (atomicidad del descuento), typecheck/build y guía de prueba manual en `handoff.md`.

## 10. Pendiente de confirmar con el dueño

Todo lo marcado **(mi decisión)**: modo por defecto `separate`, una sola jornada abierta, `shared` sobre la parada activa, sobrante informativo y copia de plantillas.
