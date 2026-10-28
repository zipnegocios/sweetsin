# Plantillas de stock y stock de paradas existentes — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plantillas de stock reutilizables (CRUD + archivar), elegirlas al crear una parada, y editar el stock de una parada ya creada sin bajar de lo vendido; con endpoint admin por cada acción.

**Architecture:** Núcleo hexagonal: nuevo módulo `packages/domain/src/stock-templates` (entidades, puerto, casos de uso) y casos de uso nuevos en `packages/domain/src/stock`. Repos Drizzle en `packages/db`. `apps/web` los adapta con Route Handlers `/api/admin/**` (patrón de `trailer-stops`) y Server Actions del panel. Elegir plantilla **copia** cantidades; no hay vínculo.

**Tech Stack:** TypeScript, Drizzle + Postgres (DB compartida dev/prod), Zod (`zod/v4`), Next.js 15, next-intl, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-plantillas-stock-design.md`

## Global Constraints

- Commits directo en `main`, un solo subject en español de una línea, sin firmas ni cuerpo; nunca `--force`/`--no-verify`; solo `git add` de archivos de la tarea (hay cambios ajenos en `.github/workflows/build-dev-apk.yml`: no tocarlos).
- `db push` nunca con `--force`; solo debe AGREGAR tablas. Las pruebas de `packages/db` golpean la DB real compartida: toda fila de prueba se limpia en `afterAll`.
- Reutilizar antes de crear: `initializeStopStock`, `DrizzleStockRepository`, `authorizeAdmin`, `domainErrorResponse`/`isUuid`, `requireAdmin`, patrones de `trailer-stop-body.ts`. Sin abstracciones especulativas.
- Textos de UI en `packages/i18n` (en + es; `types.ts` + ambos diccionarios; existe test de paridad).
- Vendido de una fila de stock = suma de `quantity` de sus `stock_events` con `eventType = "sale"`.
- Mensajes de error de dominio (exactos): `"Template not found"`, `"Template name is required"`, `"Template name already exists"`, `"Quantity must be a positive integer"`, `"Cannot set stock below units already sold"`, `"Stock row has movements"`, `"Product already has stock at this stop"`, `"Stock row not found"`, `"Stop not found"` (ya existe).
- Cantidades de stock/plantilla: enteros ≥ 1.

## Review Focus

- Dos plantillas "Sábado" y "sábado ": nombre se normaliza con trim y se compara sin mayúsculas entre no archivadas → `"Template name already exists"`.
- Plantilla vacía (0 ítems) es válida y se puede usar (copia nada).
- Editar una plantilla o borrarla no cambia el stock de paradas creadas.
- Bajar cantidad por debajo de lo vendido, o dejar `current_stock` negativo → rechazado (409), nada se modifica.
- Quitar un postre con ventas, mermas o reposiciones → rechazado; sin movimientos → se elimina.
- Producto repetido en una plantilla o agregado dos veces a una parada → rechazado.

---

### Task 1: Esquema de plantillas

**Files:**
- Create: `packages/db/src/schema/stock-templates.ts`
- Modify: `packages/db/src/schema/index.ts`

**Interfaces:**
- Produces: tablas `stockTemplatesTable` (`id` uuid pk, `name` text not null, `archivedAt` timestamptz null, `createdAt` timestamptz default now) y `stockTemplateItemsTable` (`id` uuid pk, `templateId` uuid not null FK → templates, `productId` uuid not null FK → products, `quantity` integer not null; unique `(templateId, productId)`).

- [ ] **Step 1:** Crear el schema en `stock-templates.ts` siguiendo el estilo de `stock.ts` (nombres de columna snake_case: `stock_templates`, `stock_template_items`, `template_id`, `product_id`, `archived_at`, `created_at`); unique con `unique()` de `drizzle-orm/pg-core`. Exportarlo desde `schema/index.ts`.
- [ ] **Step 2:** `pnpm --filter @workspace/db run push` (SIN `--force`). Revisar la salida: solo debe crear las dos tablas. Si propone cambiar o borrar algo existente, detenerse y avisar.
- [ ] **Step 3:** `pnpm run typecheck` → sin errores.
- [ ] **Step 4:** Commit `Agrega las tablas de plantillas de stock` (push a main).

### Task 2: Dominio de plantillas

**Files:**
- Create: `packages/domain/src/stock-templates/{entities,ports,use-cases,index}.ts`, `packages/domain/src/stock-templates/use-cases.test.ts`
- Modify: `packages/domain/package.json` (export `"./stock-templates": "./src/stock-templates/index.ts"`)

**Interfaces:**
- Produces (`entities.ts`): `StockTemplate { id; name; archivedAt: Date | null; createdAt: Date }`, `StockTemplateItem { productId: string; quantity: number }`, `StockTemplateWithItems = StockTemplate & { items: StockTemplateItem[] }`.
- Produces (`ports.ts`): `StockTemplateRepository { list(includeArchived: boolean): Promise<StockTemplateWithItems[]>; findById(id): Promise<StockTemplateWithItems | null>; create(name: string, items: StockTemplateItem[]): Promise<StockTemplateWithItems>; update(id, name: string, items: StockTemplateItem[]): Promise<StockTemplateWithItems>; setArchived(id, archived: boolean): Promise<void>; delete(id): Promise<void>; nameExists(name: string, excludeId?: string): Promise<boolean> }` (`nameExists` compara sin mayúsculas solo contra no archivadas).
- Produces (`use-cases.ts`): `listStockTemplates(repo, includeArchived)`, `getStockTemplate(repo, id)` (lanza `"Template not found"`), `createStockTemplate(repo, input: {name: string; items: StockTemplateItem[]})`, `updateStockTemplate(repo, id, input)`, `archiveStockTemplate(repo, id)`, `unarchiveStockTemplate(repo, id)` (también valida nombre único al desarchivar), `deleteStockTemplate(repo, id)`, y `isStockTemplateConflictMessage(message: string): boolean`.
- Reglas: nombre `trim()`; vacío → `"Template name is required"`; duplicado → `"Template name already exists"`; cantidad no entera ≥ 1 → `"Quantity must be a positive integer"`; `productId` repetido → `"Duplicate product in template"` (también entra en `isStockTemplateConflictMessage`, junto con los demás mensajes de plantilla salvo "Template not found"); `update`/`archive`/`delete` de id inexistente → `"Template not found"`.

- [ ] **Step 1:** Escribir tests (fake repo en memoria, estilo de `stock/use-cases.test.ts`) con estos casos por nombre: `crea una plantilla vacía`, `recorta el nombre y rechaza uno vacío`, `rechaza nombre duplicado sin distinguir mayúsculas`, `permite repetir el nombre de una archivada`, `rechaza cantidad 0, negativa o decimal`, `rechaza producto repetido`, `update de id inexistente lanza Template not found`, `archivar y desarchivar`, `desarchivar con nombre en uso lanza Template name already exists`, `delete inexistente lanza Template not found`, `isStockTemplateConflictMessage reconoce los mensajes de negocio y no otros`.
- [ ] **Step 2:** `pnpm --filter @workspace/domain exec vitest run src/stock-templates` → FAIL (módulo no existe).
- [ ] **Step 3:** Implementar entidades, puerto y casos de uso según Interfaces; `index.ts` reexporta los tres; agregar el export en `package.json`.
- [ ] **Step 4:** Mismo comando → PASS; `pnpm run typecheck`.
- [ ] **Step 5:** Commit `Agrega el dominio de plantillas de stock`.

### Task 3: Dominio del stock de una parada

**Files:**
- Modify: `packages/domain/src/stock/{ports,use-cases}.ts`, `packages/domain/src/stock/use-cases.test.ts` (ampliar `fakeStockRepo`)

**Interfaces:**
- Consumes: `StockRepository` actual; `StockTemplateRepository` (Task 2).
- Produces — nuevos métodos del puerto `StockRepository`: `sumSold(stopProductStockId: string): Promise<number>`, `hasMovements(stopProductStockId: string): Promise<boolean>`, `setQuantity(stopProductStockId: string, maxStock: number, currentStock: number): Promise<StopProductStock>`, `remove(stopProductStockId: string): Promise<void>`.
- Produces — casos de uso en `stock/use-cases.ts`:
  - `setStopProductQuantity(repo, stopId, productId, quantity): Promise<StopProductStock>`: valida entero ≥ 1; fila inexistente → `"Stock row not found"`; `sold = sumSold`; `quantity < sold` → `"Cannot set stock below units already sold"`; `delta = quantity - fila.maxStock`; `fila.currentStock + delta < 0` → mismo mensaje de "below sold"; si no, `setQuantity(id, quantity, current + delta)`.
  - `addStopProduct(repo, stopId, productId, quantity)`: valida cantidad; si ya existe fila → `"Product already has stock at this stop"`; si no, `create`.
  - `removeStopProduct(repo, stopId, productId)`: fila inexistente → `"Stock row not found"`; `hasMovements` → `"Stock row has movements"`; si no, `remove`.
  - `saveStopStockAsTemplate(stock: StockRepository, templates: StockTemplateRepository, stopId, name): Promise<StockTemplateWithItems>`: copia `maxStock` de `listByStop` como ítems y delega en `createStockTemplate`.
  - Exportar `isStockConflictMessage(message)` con `"Cannot set stock below units already sold"`, `"Stock row has movements"`, `"Product already has stock at this stop"`, `"Stock row not found"`, `"Quantity must be a positive integer"`.
- `stock/index.ts` ya reexporta todo.

- [ ] **Step 1:** Ampliar el fake con los 4 métodos (ventas simuladas con un arreglo de eventos) y escribir tests: `sube la cantidad y suma la diferencia al stock actual`, `baja la cantidad hasta lo vendido`, `rechaza bajar por debajo de lo vendido`, `rechaza si el stock actual quedaría negativo (hubo mermas)`, `rechaza cantidad 0 o decimal`, `agrega un producto nuevo`, `rechaza agregar un producto ya presente`, `quita un producto sin movimientos`, `rechaza quitar uno con movimientos`, `guarda la parada como plantilla copiando maxStock` (con fake de plantillas mínimo).
- [ ] **Step 2:** `pnpm --filter @workspace/domain exec vitest run src/stock` → FAIL.
- [ ] **Step 3:** Implementar puerto y casos de uso según Interfaces.
- [ ] **Step 4:** PASS; `pnpm run typecheck` (el typecheck de `packages/db` fallará hasta la Task 4 por los métodos faltantes del repo: aceptado entre estas tareas).
- [ ] **Step 5:** Commit `Agrega las reglas de edición del stock de una parada`.

### Task 4: Repositorios Drizzle

**Files:**
- Create: `packages/db/src/repositories/stock-template-repository.ts`, `packages/db/src/repositories/stock-template-repository.test.ts`
- Modify: `packages/db/src/repositories/stock-repository.ts`, `packages/db/src/repositories/stock-repository.test.ts`, `packages/db/src/repositories/index.ts`

**Interfaces:**
- Produces: `DrizzleStockTemplateRepository implements StockTemplateRepository`; `DrizzleStockRepository` gana `sumSold`, `hasMovements`, `setQuantity`, `remove` (`remove` borra la fila; solo se llama sin movimientos).
- Notas: `create`/`update` de plantilla corren en `db.transaction` (update reemplaza todos los ítems); `delete` borra ítems y plantilla en transacción; `nameExists` usa `lower()` + `archivedAt IS NULL` y excluye `excludeId`; `list` devuelve ítems por plantilla ordenada por `createdAt` desc, ocultando archivadas si `includeArchived` es false.

- [ ] **Step 1:** Tests de integración (patrón de `stock-repository.test.ts`: producto `gluttony` del seed, timeout 15000, `afterAll` que BORRA todas las plantillas y paradas creadas): `crea, lista y busca una plantilla con ítems`, `update reemplaza los ítems`, `archivar la oculta de list(false) y la muestra en list(true)`, `nameExists ignora mayúsculas, archivadas y el excludeId`, `delete elimina plantilla e ítems`; en stock: `sumSold suma solo eventos sale`, `hasMovements`, `setQuantity y remove`.
- [ ] **Step 2:** `pnpm --filter @workspace/db exec vitest run src/repositories/stock` → FAIL.
- [ ] **Step 3:** Implementar; exportar en `index.ts`.
- [ ] **Step 4:** PASS; `pnpm run typecheck` completo OK. Confirmar con una consulta que no quedaron filas de prueba (`stock_templates` vacía de nombres de test, sin paradas "Stock Test Stop").
- [ ] **Step 5:** Commit `Agrega los repositorios de plantillas y la edición de stock`.

### Task 5: Endpoints admin

**Files:**
- Create: `apps/web/src/app/api/admin/stock-templates/route.ts` (GET `?includeArchived=true`, POST), `.../stock-templates/[id]/route.ts` (GET, PATCH, DELETE), `.../stock-templates/[id]/archive/route.ts` (POST), `.../stock-templates/[id]/unarchive/route.ts` (POST), `apps/web/src/app/api/admin/trailer-stops/[id]/stock/route.ts` (GET lista, POST agrega `{productId, quantity}`), `.../[id]/stock/[productId]/route.ts` (PATCH `{quantity}`, DELETE), `.../[id]/save-as-template/route.ts` (POST `{name}` → 201), `apps/web/src/app/api/admin/_lib/stock-body.ts` (schemas Zod), y un `route.test.ts` por cada grupo.
- Modify: `apps/web/src/app/api/admin/_lib/domain-error-response.ts`

**Interfaces:**
- `stock-body.ts`: `templateBodySchema = z.object({ name: z.string(), items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int() })) })`; `stockAddBodySchema`, `stockQuantityBodySchema`, `saveTemplateBodySchema`.
- `domainErrorResponse`: además de lo actual, `"Template not found"` y `"Stock row not found"` → 404; `isStockTemplateConflictMessage` o `isStockConflictMessage` → 409. Ids no UUID (plantilla, parada o producto) → 404 sin tocar dominio. La respuesta 404 de "Stop not found" se mantiene para paradas.

- [ ] **Step 1:** Tests de ruta con mocks de `@/auth` y de `@workspace/db/repositories` (patrón de `trailer-stops/route.test.ts`): 401/403 sin admin, 400 con cuerpo inválido, 201/200 felices, 404 con id no UUID o inexistente, 409 con nombre duplicado y con "below sold". Un archivo de test por ruta nueva.
- [ ] **Step 2:** `pnpm --filter @workspace/web exec vitest run src/app/api/admin` → FAIL.
- [ ] **Step 3:** Implementar rutas y mapeo de errores; las rutas de stock de una parada validan antes que la parada exista (`DrizzleTrailerStopRepository.findById`, si no → `"Stop not found"`).
- [ ] **Step 4:** PASS + `pnpm run typecheck`.
- [ ] **Step 5:** Commit `Agrega los endpoints admin de plantillas y stock de paradas`.

### Task 6: Panel de plantillas

**Files:**
- Create: `apps/web/src/app/actions/admin-stock-templates.ts` (Server Actions con `requireAdmin`: create, update, archive, unarchive, delete), `apps/web/src/app/[locale]/admin/stock-templates/page.tsx` (lista con filtro "ver archivadas" por `searchParams`), `.../stock-templates/new/page.tsx`, `.../stock-templates/[id]/page.tsx`, `apps/web/src/components/admin/stock-template-form.tsx`, `apps/web/src/components/admin/stock-template-row-actions.tsx`
- Modify: `apps/web/src/app/[locale]/admin/layout.tsx` (nuevo ítem `navStockTemplates`), `apps/web/src/components/admin/admin-icons.tsx` (si hace falta ícono; reutilizar uno existente si sirve), `packages/i18n/src/types.ts` y ambos diccionarios (`navStockTemplates`, títulos, botones crear/guardar/archivar/desarchivar/borrar, confirmación de borrado ("no cambia las paradas ya creadas"), vacío, errores)

**Interfaces:**
- Consumes: casos de uso de Task 2, `listAvailableProducts` + `DrizzleProductRepository` (como `trailer-stops/new/page.tsx`).
- `StockTemplateForm({ products, template? })`: nombre + lista de postres con checkbox y cantidad (patrón del selector de productos de `trailer-stop-form.tsx`); mensajes de error del servidor mostrados con `role="alert"`; crear o guardar redirige a la lista.

- [ ] **Step 1:** Agregar claves i18n (en + es) primero; `pnpm --filter @workspace/i18n exec vitest run` (paridad) → PASS.
- [ ] **Step 2:** Implementar actions, páginas y componentes. Borrado con confirmación visible; archivadas con etiqueta y botón desarchivar.
- [ ] **Step 3:** `pnpm run typecheck` y `pnpm --filter @workspace/web run build` (necesita `.env.local`; si falta, solo typecheck y decirlo).
- [ ] **Step 4:** Commit `Agrega el panel de plantillas de stock`.

### Task 7: Plantilla en la parada y edición del stock existente

**Files:**
- Create: `apps/web/src/components/admin/stop-stock-editor.tsx` (reemplaza el uso de `StockRow` en el detalle: cantidad editable por postre, quitar, agregar postre, botón "Guardar como plantilla")
- Modify: `apps/web/src/app/actions/admin-trailer-stops.ts` (agregar `setStopProductQuantityAction`, `addStopProductAction`, `removeStopProductAction`, `saveStopStockAsTemplateAction`), `apps/web/src/components/admin/trailer-stop-form.tsx` (selector "Plantilla" en alta: elegir una copia sus cantidades al estado `selectedProducts`, editable; "Ninguna" lo deja como está), `apps/web/src/app/[locale]/admin/trailer-stops/new/page.tsx` (pasar plantillas activas con ítems al form), `apps/web/src/app/[locale]/admin/trailer-stops/[id]/page.tsx` (usar el editor; pasar productos disponibles y vendidos), `apps/web/src/components/admin/stock-row.tsx` (conservar reposición y merma; el editor lo compone o se le añade la edición de cantidad, a criterio del implementador, sin duplicar lógica), i18n (en + es + types)

**Interfaces:**
- Consumes: casos de uso de Task 3. El detalle muestra por postre: vendido, actual, cantidad (máx). Los errores de dominio (ej. "Cannot set stock below units already sold") se muestran traducidos con `role="alert"`; no se traga ningún error.
- El editor está disponible en estados `scheduled`, `active`, `cancelled`; en `completed` es de solo lectura (consistente con el dominio de paradas).

- [ ] **Step 1:** Claves i18n (en + es) + test de paridad PASS.
- [ ] **Step 2:** Agregar las 4 Server Actions (delegan en casos de uso con `requireAdmin`) y el selector de plantilla en el formulario de alta.
- [ ] **Step 3:** Implementar `stop-stock-editor.tsx` y cablearlo en el detalle.
- [ ] **Step 4:** `pnpm run typecheck`; `pnpm run test`; limpiar a mano cualquier fila de prueba que quede en la DB.
- [ ] **Step 5:** Commit `Permite elegir plantilla al crear paradas y editar el stock de una parada existente`.

### Task 8: Verificación y cierre

- [ ] **Step 1:** `pnpm run typecheck` y `pnpm run test` completos: 0 fallos. Verificar en la DB que no quedan plantillas ni paradas de prueba.
- [ ] **Step 2:** Guía de prueba manual para el owner: crear plantilla, crear parada desde ella, editar la plantilla y comprobar que la parada no cambia, subir/bajar cantidad en una parada, intentar bajar por debajo de lo vendido (requiere un `sale` registrado: documentar que hoy los pedidos aún no se enlazan a la parada, así que la guarda se ejercita por tests), guardar parada como plantilla, probar endpoints con la sesión admin.
- [ ] **Step 3:** Actualizar `handoff.md` (5 secciones, sin borrar "Intentos fallidos") y la sección de la fase en `CLAUDE.md` con una línea sobre plantillas y el cambio de esquema (tablas nuevas, ya aplicado).
- [ ] **Step 4:** Commit `Documenta las plantillas de stock y actualiza el handoff`.
