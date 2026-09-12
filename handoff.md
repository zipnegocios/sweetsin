# Handoff — Sweet Sin

## Objetivo

Ejecutar `docs/superpowers/plan-desarrollo.md` fase por fase, sin adelantar
trabajo de fases posteriores. Sesión 1: roadmap completo (Fases 1-8) +
Fase 1 (Cimientos) de punta a punta. Sesión 2 (esta): plan bite-sized de
Fase 2 vía `superpowers:writing-plans`, revisado con el owner en una
interview exhaustiva (`grill-me`, 8 preguntas reales resueltas) que cambió
la arquitectura de i18n a mitad de plan, y ejecución completa de las 17
tareas con `superpowers:executing-plans`.

## Estado actual

**Fase 1 y Fase 2 completas. Fase 2 verificada de punta a punta localmente
(typecheck + tests + build + smoke test manual contra la DB real); el
deploy a producción (Tarea 17) queda como el paso final, pendiente de que
el owner haga `git push` y verifique el resultado en EasyPanel — ver
"Próximos pasos".**

Fase 1 (sin cambios respecto al handoff anterior): prototipo descartado
retirado, monorepo reestructurado (`packages/domain`, `packages/db`,
`packages/notifications`), schema completo de Drizzle (11 tablas)
aplicado, dominio hexagonal con 20 tests, repositorios con test de
integración end-to-end, deploy inicial a EasyPanel funcionando.

Fase 2 — Catálogo público bilingüe (nuevo en esta sesión):

- **Arquitectura de i18n cambiada a mitad de plan por decisión del owner**:
  el plan original (writing-plans) proponía un `LocaleProvider` con Context
  de React + `localStorage`. El owner lo rechazó explícitamente en el
  grill-me por motivos de SEO/SSR — se reescribió el plan completo para usar
  `next-intl` con routing por locale real (`en` en la raíz `/` sin prefijo,
  `es` en `/es`, `localePrefix: "as-needed"`, middleware de
  detección/redirect). `packages/i18n` sigue siendo solo diccionarios
  framework-free; `next-intl` vive únicamente en `apps/web`.
- `packages/i18n` (nuevo paquete): diccionarios ES/EN completos (9
  namespaces: common, nav, hero, brandStory, menu, events, findUs, footer),
  con test de paridad de claves.
- `packages/domain/src/trailer-stops` (nuevo subdominio, no existía desde
  Fase 1): entidad `TrailerStop`, puerto `TrailerStopRepository`, caso de
  uso `listActiveTrailerStops`. El filtro de "activa" se amplió durante el
  grill-me para excluir también paradas vencidas por fecha (`endTime`), no
  solo por `status` — decisión del owner, ver Intentos fallidos.
- `packages/db`: `DrizzleTrailerStopRepository` (con el filtro por fecha),
  script de seed idempotente (`src/seed.ts`) que cargó los 16 productos y 3
  paradas del trailer legacy a Postgres real — **las traducciones al
  español son un primer borrador de Claude, no revisadas por Oscar**.
- `apps/web`: sitio público completo en `app/[locale]/`, todas las
  secciones migradas de `apps/web-legacy` (Navbar, MobileNav, Hero,
  BrandStory, Menu, Events, FindUs, Footer), Server Action real para
  cotizaciones de evento (`requestEventQuoteAction`, primer uso de Zod en
  `apps/web`), mapa de Google en FindUs. Sin carrito ni checkout — eso es
  Fase 3.
- Verificación end-to-end real contra la DB de producción: catálogo (16
  productos, ambos idiomas), paradas del trailer, y el Server Action de
  eventos probado con un `FormData` real (fila insertada, verificada por
  query directa, y borrada después para no dejar datos de prueba en la DB
  compartida dev=prod).
- `CLAUDE.md` actualizado: Run & Operate (script seed, env vars de
  `apps/web`), Where things live (`packages/i18n`), Architecture decisions
  (i18n con next-intl), Product (descripción real del sitio), y 6 gotchas
  nuevos (ver `CLAUDE.md` directamente — incluyen el hoisting de `@types`
  en pnpm, `force-dynamic` para páginas con fetch a Postgres, y el
  renombre de `middleware.ts`→`proxy.ts` en Next 16, que no aplica acá
  porque el proyecto está pineado a `^15.5.0`).
- **Nueva regla de proceso, agregada a `CLAUDE.md` a pedido del owner en
  esta sesión**: todo el razonamiento de Claude (incluido el bloque de
  thinking extendido, no solo la respuesta visible) va en español, con una
  estructura fija de 4 pasos (Evaluación de Impacto, Resolución de
  Conflictos, Mentoría Técnica, Plan de Acción) antes de tocar código —
  framing explícito de mentoría/aprendizaje, no solo verbosidad.

## Archivos y cambios

Fase 1 (sin cambios, ver handoff anterior si hace falta el detalle
completo): `docs/superpowers/plan-desarrollo.md`, plan bite-sized de Fase
1, `packages/domain/src/**`, `packages/db/src/schema/**` y
`repositories/**`, `apps/web/**` (scaffold), `apps/web-legacy/**` (ex
`apps/web`), `pnpm-workspace.yaml`, `CLAUDE.md`, `package.json` raíz.

Fase 2 (nuevo en esta sesión):

- `docs/superpowers/plans/2026-09-12-fase-2-catalogo-publico.md` — plan
  bite-sized de Fase 2 (17 tareas), reescrito a mitad de camino tras el
  grill-me (cambio de arquitectura de i18n), ejecutado completo.
- `docs/superpowers/plan-desarrollo.md` — nueva anotación en la sección
  Fase 5: el panel admin debe resaltar visualmente las cotizaciones de
  evento con `location = "TBD"` (decisión del owner sobre el formulario de
  baja fricción de Fase 2).
- `packages/i18n/**` — paquete nuevo completo.
- `packages/domain/src/trailer-stops/**` — subdominio nuevo.
- `packages/domain/package.json` — export `"./trailer-stops"` agregado.
- `packages/db/src/repositories/trailer-stop-repository.ts` (+ test) —
  nuevo.
- `packages/db/src/repositories/index.ts` — export agregado.
- `packages/db/package.json` — export `"./repositories"`, script `seed`,
  devDependency `tsx` agregados.
- `packages/db/src/seed.ts` — nuevo, corrido contra la DB real.
- `apps/web/package.json` — dependencias del monorepo + next-intl + gsap +
  three + `@googlemaps/js-api-loader` + zod.
- `apps/web/src/i18n/**`, `apps/web/src/middleware.ts`,
  `apps/web/src/global.d.ts` — configuración de next-intl.
- `apps/web/src/app/[locale]/**` — layout y page reales (reemplazan el
  scaffold plano de Fase 1).
- `apps/web/src/components/**` — 8 secciones/componentes migrados.
- `apps/web/src/lib/**` — `animations.ts`, `google-maps.ts`.
- `apps/web/src/app/actions/event-bookings.ts` — Server Action.
- `apps/web/src/app/globals.css`, `next.config.ts` — tema visual + plugin
  de next-intl.
- `apps/web/.env.local` (gitignored, no en git) — `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
  y `DATABASE_URL`, ambas copiadas de fuentes existentes sin imprimir los
  valores.
- `pnpm-workspace.yaml` — `allowBuilds` completado para `@parcel/watcher` y
  `@swc/core` (mismo patrón que Fase 1).
- `CLAUDE.md` — 5 secciones actualizadas + 6 gotchas nuevos + la regla de
  idioma/mentoría de esta sesión.

## Intentos fallidos

*(no borrar entradas previas, solo agregar)*

1-7. Ver handoff anterior (Fase 1) — sin cambios.

8. **`pnpm install` volvió a dejar un placeholder inválido en
   `pnpm-workspace.yaml`** (`allowBuilds` para `@parcel/watcher` y
   `@swc/core: set this to true or false`), mismo síntoma que el intento
   fallido #2 de Fase 1, esta vez disparado por `next-intl`/`gsap`/`three`.
   Fix idéntico: completado en `true` (`@swc/core` ya estaba en
   `onlyBuiltDependencies` desde Fase 1; `@parcel/watcher` es un watcher de
   archivos nativo ampliamente usado, bajo riesgo).
9. **`@types/google.maps` no se auto-incluía en TypeScript** pese a estar
   bien instalado — diagnosticado con `tsc --listFiles` (no adivinado):
   pnpm hoistea a la raíz del monorepo los `@types` compartidos entre
   paquetes (`react`, `node`), pero uno exclusivo de `apps/web` queda
   aislado en `apps/web/node_modules/@types/` y el auto-discovery de `tsc`
   no lo alcanza ahí. Fix: `/// <reference types="google.maps" />`
   explícito en `apps/web/src/global.d.ts` — deliberadamente no se declaró
   `compilerOptions.types`, porque eso habría apagado el auto-include para
   todo lo demás (react/react-dom incluidos).
10. **`next build` corre ESLint**, algo que ningún `tsc --noEmit` de las
    tareas anteriores ejercía. 2 errores bloqueantes de
    `@typescript-eslint/no-explicit-any` en `hero-particles.tsx` (casts a
    `any` para `navigator.connection`/`navigator.deviceMemory`, APIs no
    estandarizadas) — fix: interfaz `NavigatorWithExtras` tipada en vez de
    `any`. Más 2 warnings limpiados (código muerto en `generateMetadata`,
    `eslint-disable` explícito y documentado para un efecto mount-only
    intencional en `LocationMap`).
11. **`apps/web` necesitaba su propia copia de `DATABASE_URL`** en
    `.env.local` — Next.js no hereda el `.env` de `packages/db`, que vive
    en otro paquete del monorepo sin ninguna relación automática. Sin esto,
    `next build` revienta ("DATABASE_URL must be set") apenas un Server
    Component importa `@workspace/db/repositories` — se manifestó recién
    en la Tarea 15, primera vez que `page.tsx` componía `Menu`/`FindUs`.
12. **Hallazgo de arquitectura, no solo un bug**: `generateStaticParams()`
    en `app/[locale]/layout.tsx`, sin más, hace que `next build` intente
    pre-renderizar `/en`/`/es` como HTML estático — ejecutando las queries
    de `Menu`/`FindUs` contra Postgres real *en build time* y congelando
    el catálogo hasta el próximo deploy. Se manifestó como un
    `connect ETIMEDOUT` de red, que en realidad era síntoma de intentar
    conectar a la DB en un momento donde nunca debería hacerlo. Fix:
    `export const dynamic = "force-dynamic"` en `page.tsx`. Verificado con
    el manifiesto real (`.next/prerender-manifest.json`), no con el
    símbolo `●`/`○` de la tabla resumen de `next build`, que solo indica
    si la ruta usa `generateStaticParams()`, no si el contenido quedó
    congelado — confiar en ese símbolo habría llevado a una conclusión
    incorrecta.

## Próximos pasos

- **Deploy a producción (Tarea 17 del plan de Fase 2) — el owner ejecuta:**
  1. `git push` (Claude no lo hace por su cuenta, ver reglas de commits).
  2. **Antes de dar el deploy por exitoso**, inyectar en el panel de
     EasyPanel, para el servicio `apps/web`, dos variables de entorno:
     - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (mismo valor que
       `apps/web/.env.local`) — si falta, el build pasa igual pero el mapa
       de FindUs no carga para nadie, en silencio.
     - `DATABASE_URL` (mismo valor que `packages/db/.env`) — si falta, el
       build **entero falla**, con el mismo error que se vio localmente.
  3. Verificar el log de build en EasyPanel y el sitio real: `/` en
     inglés sin redirect, `/es` en español, mapa cargando, formulario de
     eventos funcionando contra la DB real.
- **El servicio `apps/api` en EasyPanel sigue roto**, arrastrado desde el
  cierre de Fase 1 — pendiente de que el owner lo pause/elimine
  manualmente. Sigue fuera de mi alcance.
- **Revisión de copy pendiente**: las traducciones al español de los 16
  productos (`packages/db/src/seed.ts`) son un primer borrador de Claude,
  no revisadas por Oscar. Corregirlas es tan simple como editar el array y
  re-correr `pnpm --filter @workspace/db run seed` (idempotente).
- **Arrancar Fase 3 — Checkout, carrito y órdenes** (ver
  `docs/superpowers/plan-desarrollo.md`, sección "Fase 3") una vez
  confirmado el deploy — todavía no tiene plan bite-sized.
- Decisión pendiente de Fase 5 ya anotada en `plan-desarrollo.md`: el panel
  admin debe resaltar visualmente las cotizaciones de evento con
  `location = "TBD"`.
