-- Limpieza de datos de prueba (Sweet Sin). NO ejecutar sin revisar.
-- Corre todo dentro de una transacción que termina en ROLLBACK: primero mira los conteos,
-- y solo cuando estés conforme cambia la última línea a COMMIT.
-- Uso: psql "$DATABASE_URL" -f scripts/limpieza-datos-prueba.sql
BEGIN;

CREATE TEMP TABLE t_orders AS
  SELECT id FROM orders
  WHERE customer_name IN ('Test','Jane Doe','List Test A','List Test B','Status Test','Customer History Test');

CREATE TEMP TABLE t_users AS
  SELECT id FROM users
  WHERE role = 'customer'
    AND name IN ('Test Customer','Customer History Test','Auth Test Customer','Locale Test User')
  UNION
  SELECT id FROM users WHERE name IN ('Delivery Test','Test Staff','Qa test2');

CREATE TEMP TABLE t_products AS
  SELECT id FROM products WHERE name_en = 'Test Product';

DELETE FROM order_status_events WHERE order_id IN (SELECT id FROM t_orders);
DELETE FROM stock_events        WHERE order_id IN (SELECT id FROM t_orders);
DELETE FROM order_items         WHERE order_id IN (SELECT id FROM t_orders);
DELETE FROM orders              WHERE id       IN (SELECT id FROM t_orders);

-- Productos de prueba: solo los que ya no tienen ninguna referencia.
DELETE FROM products p USING t_products t
 WHERE p.id = t.id
   AND NOT EXISTS (SELECT 1 FROM order_items      WHERE product_id = p.id)
   AND NOT EXISTS (SELECT 1 FROM cart_items       WHERE product_id = p.id)
   AND NOT EXISTS (SELECT 1 FROM stop_product_stock WHERE product_id = p.id)
   AND NOT EXISTS (SELECT 1 FROM stock_template_items WHERE product_id = p.id);

-- Usuarios de prueba: solo los que ya no tienen referencias (si alguno falla por FK, queda sin borrar).
DELETE FROM push_tokens        WHERE user_id IN (SELECT id FROM t_users);
DELETE FROM delivery_locations WHERE user_id IN (SELECT id FROM t_users);
DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE customer_id IN (SELECT id FROM t_users));
DELETE FROM carts WHERE customer_id IN (SELECT id FROM t_users);
DELETE FROM users u USING t_users t
 WHERE u.id = t.id
   AND NOT EXISTS (SELECT 1 FROM orders WHERE customer_id = u.id OR assigned_delivery_user_id = u.id)
   AND NOT EXISTS (SELECT 1 FROM order_status_events WHERE actor_user_id = u.id)
   AND NOT EXISTS (SELECT 1 FROM stock_events WHERE reported_by_user_id = u.id);

-- Revisión: qué quedó.
SELECT 'orders' AS tabla, count(*) FROM orders
UNION ALL SELECT 'products', count(*) FROM products
UNION ALL SELECT 'users', count(*) FROM users;

ROLLBACK;  -- cambia a COMMIT solo tras revisar
