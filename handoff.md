# Handoff — Sweet Sin

## Objetivo

Ejecutar `docs/superpowers/plan-desarrollo.md` fase por fase, sin adelantar
trabajo de fases posteriores. Esta sesión cubrió: escribir el roadmap
completo (Fases 1-8) resolviendo las decisiones pendientes que lo
bloqueaban, y ejecutar la Fase 1 (Cimientos) de punta a punta — dominio
hexagonal, schema de Drizzle, repositorios, y el deploy a producción
resultante.

## Estado actual

**Fase 1 completa, commiteada y deployada en producción sin errores.**

- Prototipo descartado (`apps/api`, `lib/api-spec`, `lib/api-zod`,
  `lib/api-client-react`) retirado por completo.
- Monorepo reestructurado: `packages/domain` (dominio hexagonal puro),
  `packages/db` (ex `lib/db`), `packages/notifications` (esqueleto vacío,
  se llena en Fase 6).
- `apps/web` reemplazado por el scaffold de Next.js 15; el prototipo Vite
  vive en `apps/web-legacy` (referencia, sin deploy, se elimina en Fase 8).
- Schema completo de Drizzle (11 tablas: `users`, `products` bilingüe,
  `trailer_stops`, `stop_product_stock`, `stock_events`, `event_bookings`,
  `event_booking_items`, `carts`, `cart_items`, `orders`, `order_items`)
  aplicado contra el Postgres real de EasyPanel (dev=prod, misma instancia).
- Dominio hexagonal completo con Vitest: productos, pricing/descuento por
  volumen, órdenes (`createOrder`), stock (`decrementStockOnSale`),
  usuarios (`registerCustomer`/`listActiveStaff`), event bookings
  (`requestEventQuote`), y puertos externos de pagos/notificaciones
  (interfaces, sin implementación todavía). 20 tests en verde.
- Repositorios Drizzle implementando todos los puertos, con test de
  integración end-to-end de `createOrder` contra la DB real. 1 test más
  en verde (21 en total en el workspace).
- `apps/web/Dockerfile` creado y deployado con éxito en EasyPanel (build
  confirmado limpio, `next build` compila las 5 páginas del scaffold).
- `pnpm@11.13.0` fijado como `packageManager` para reproducibilidad entre
  local y Docker.
- Roadmap completo (Fases 1-8) en `docs/superpowers/plan-desarrollo.md`,
  con 5 decisiones de producto/arquitectura resueltas el 2026-09-12: idioma
  bilingüe (ES/EN) en **todo** el producto (web público, panel admin, app
  mobile — no solo el catálogo), checkout de invitado con cuenta opcional,
  carrito sincronizado server-side para customers logueados, naming
  `snake_case` en DB, y reemplazo inmediato de `apps/web` (con downtime
  funcional aceptado hasta Fase 2).
- Fase 2 (catálogo público bilingüe) **todavía no arrancó**.

## Archivos y cambios

- `docs/superpowers/plan-desarrollo.md` — reescrito: roadmap completo
  Fases 1-8, decisiones resueltas, boceto de schema actualizado.
- `docs/superpowers/plans/2026-09-12-fase-1-cimientos.md` — plan bite-sized
  de Fase 1 (13 tareas), ejecutado completo.
- `packages/domain/src/**` — dominio hexagonal (7 subdominios: shared,
  products, pricing, orders, stock, users, event-bookings, payments,
  notifications).
- `packages/db/src/schema/**` — schema completo de Drizzle.
- `packages/db/src/repositories/**` — repositorios Drizzle + test de
  integración.
- `packages/db/drizzle.config.ts` — bug de Windows corregido (ver
  Intentos fallidos).
- `packages/db/vitest.config.ts`, `packages/domain/vitest.config.ts` —
  config de Vitest (nuevo).
- `apps/web/**` — scaffold de Next.js 15 (nuevo), incluye `Dockerfile`.
- `apps/web-legacy/**` — ex `apps/web` (prototipo Vite), movido y
  renombrado (`@workspace/web-legacy`).
- `pnpm-workspace.yaml` — `packages: apps/*, packages/*` (ya no `lib/*`),
  catálogo con `vitest` agregado.
- `CLAUDE.md` — actualizado con el estado real post-Fase 1 (Run & Operate,
  Stack, Where things live, Gotchas, Deploy).
- `package.json` (raíz) — `packageManager` fijado, scripts `test` agregado.

## Intentos fallidos

*(no borrar entradas previas, solo agregar)*

1. **`drizzle.config.ts` con `path.join(__dirname, ...)` rompía `drizzle-kit
   push` en Windows** ("No schema files found" pese a que el archivo
   existía) — `path.join` genera backslashes, y el glob interno de
   `drizzle-kit` no los matchea. Bug preexistente (nunca se había probado
   porque el schema estaba vacío), no introducido en esta sesión. Fix:
   ruta relativa string simple (`"./src/schema/index.ts"`).
2. **`pnpm install` dejó un placeholder inválido en `pnpm-workspace.yaml`**
   (`allowBuilds.unrs-resolver: set this to true or false`) al toparse con
   un build script sin aprobar de una dependencia nueva de Next.js/ESLint.
   Fix: completado en `true` (ya estaba permitido en
   `onlyBuiltDependencies`).
3. **`apps/web/tsconfig.json` tenía una referencia de proyecto huérfana**
   a `lib/api-client-react` que el plan de Fase 1 no había detectado al
   escribirlo. Se encontró al correr el grep de verificación de la Tarea 1
   y se corrigió en el momento.
4. **Vitest no carga `.env` automáticamente** (a diferencia de
   `drizzle-kit`) — el test de integración de `packages/db` fallaba con
   "DATABASE_URL must be set". Fix: `packages/db/vitest.config.ts` con
   `process.loadEnvFile()` antes de que se importe `../index`.
5. **El deploy de producción en EasyPanel falló dos veces al cerrar
   Fase 1**, con "open Dockerfile: no such file or directory": primero
   porque `apps/api` (borrado en Fase 1) ya no tenía `Dockerfile`, y
   `apps/web` tampoco (el original se había movido a `apps/web-legacy` al
   reemplazar el scaffold). No se había comunicado con suficiente claridad
   que esto rompería el build entero, no solo dejaría el sitio vacío. Fix:
   se creó `apps/web/Dockerfile` (build context = raíz, `next start`
   reutilizando el stage de build en vez de `output: "standalone"`, sin
   poder testear con Docker local en este entorno). El build de `apps/web`
   pasó limpio en el segundo intento (confirmado por el log de EasyPanel).
   **El servicio `apps/api` en EasyPanel sigue roto** y pendiente de que
   el owner lo pause/elimine manualmente — fuera de mi alcance.
6. **Next.js auto-modifica `apps/web/tsconfig.json` en cada build**
   (agrega `allowJs`, `strict: false`, `esModuleInterop`). No rompe nada
   porque `tsconfig.base.json` ya fija explícitamente los flags
   individuales de la familia `strict` (esos siempre ganan sobre el
   `strict` general, sin importar de qué archivo del `extends` vengan) —
   se documentó en `CLAUDE.md` en vez de pelear contra el comportamiento
   de Next reescribiéndolo en cada build.
7. **Corepack usó pnpm 12.4.1 en el build de Docker** mientras local usa
   11.13.0, por no haber `packageManager` fijado en el `package.json` raíz
   — no rompió nada todavía (el lockfile es compatible con ambas
   versiones), pero es un riesgo de reproducibilidad a futuro. Fix:
   `"packageManager": "pnpm@11.13.0"` agregado.

## Próximos pasos

- **Arrancar Fase 2 — Catálogo público bilingüe** (ver
  `docs/superpowers/plan-desarrollo.md`, sección "Fase 2"). Todavía no
  tiene plan bite-sized — escribirlo con `superpowers:writing-plans` antes
  de tocar código, igual que se hizo con Fase 1.
- Elegir librería de i18n para Next.js App Router (candidata: `next-intl`)
  y crear `packages/i18n` con los diccionarios ES/EN — se reutiliza después
  en el panel admin (Fase 4) y en la app mobile (Fase 7), porque el owner
  pidió bilingüe en **todo** el producto, no solo el catálogo.
- Migrar las secciones de `apps/web-legacy` (Hero, Menu, BrandStory,
  FindUs, Events sin el formulario roto, Footer) al App Router de Next.js.
- Server Component que use `listAvailableProducts` (`packages/domain`, ya
  existe) vía `DrizzleProductRepository` (`packages/db`, ya existe) para
  reemplazar el catálogo hardcodeado de `apps/web-legacy/src/lib/data.ts`.
- `FindUs` debe leer `trailer_stops` activos desde Postgres en vez del
  array `schedule` hardcodeado.
- El formulario de cotización de `Events.tsx` (hoy hace `console.log`) debe
  pasar a un Server Action que llame `requestEventQuote`
  (`packages/domain`, ya existe).
- **Pendiente operativo del owner en EasyPanel** (no resoluble desde acá):
  pausar/eliminar el servicio `apps/api` (sigue fallando el deploy con
  "Dockerfile no existe"), y decidir qué mostrar en `apps/web` mientras
  Fase 2 no tenga contenido real (hoy sirve el placeholder default de
  Next.js).
