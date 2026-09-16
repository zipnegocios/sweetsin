# Fase 5 — Inventario y Calendario del Trailer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CRUD completo de `trailer_stops` en el panel admin (con mapa interactivo para fijar ubicación y advertencia en vivo de solapamiento con eventos confirmados), gestión de stock por parada (carga inicial manual, reposición, merma), gestión de `event_bookings` (cambio de status con la regla de negocio de no confirmar con `location = "TBD"`, carga de items cotizados), y una vista visual de calendario que combina paradas y eventos.

**Architecture:** Hexagonal estricta, mismo patrón que Fases 1-4. Los tres subdominios de dominio (`trailer-stops`, `stock`, `event-bookings`) ya existen desde Fase 1 con un caso de uso mínimo cada uno — esta fase los extiende con los métodos de escritura/consulta que faltan, implementa esos métodos en los repositorios Drizzle ya existentes, y construye la UI del panel admin sobre el mismo patrón ya usado para Orders en Fase 4 (Server Actions con guard de rol, Server Components con `searchParams` para filtros).

**Tech Stack:** `react-big-calendar` + `date-fns` (vista de calendario, nuevas dependencias), `@googlemaps/js-api-loader` (ya instalado, se reutiliza para un mapa interactivo nuevo).

**Spec:** `docs/superpowers/plan-desarrollo.md`, sección "Fase 5 — Inventario y calendario del trailer".

## Global Constraints

- **Sin tablas nuevas.** Todo el schema de `trailer_stops`, `stop_product_stock`, `stock_events`, `event_bookings`, `event_booking_items` ya existe desde Fase 1 — esta fase solo agrega métodos a los repositorios y ports existentes.
- **Vista de calendario real** (decisión del owner, 2026-09-15): `react-big-calendar` + `date-fns` como localizer, mostrando `trailer_stops` activas y `event_bookings` confirmados como eventos coloreados distinto por tipo.
- **Ubicación de paradas vía mapa interactivo** (decisión del owner, 2026-09-15): el admin fija la ubicación de una `trailer_stop` nueva haciendo click o arrastrando un marker en un mapa de Google — no inputs numéricos de lat/lng como único método (quedan como fallback si el mapa no carga).
- **Stock inicial manual** (decisión del owner, 2026-09-15): al crear una parada, el admin elige explícitamente qué productos van a esa parada y su `maxStock` inicial — no se crea automáticamente una fila de stock para todos los productos activos.
- **Advertencia de solapamiento en vivo** (decisión del owner, 2026-09-15): mientras el admin completa fecha/hora de una parada nueva, una Server Action consulta `findOverlapping` (ya implementado desde Fase 1, sin consumidor hasta ahora) y muestra un aviso no bloqueante si hay un evento confirmado que se superpone — no se valida recién al hacer submit.
- **Regla de negocio nueva:** una `event_booking` no puede pasar a `status: "confirmed"` mientras `location === "TBD"` (decisión del owner al planificar Fase 2, ya anotada en el roadmap) — se aplica en el dominio (`confirmEventBooking`), no solo como advertencia visual en la UI.
- **Alcance de "editar" una `trailer_stop`:** el roadmap dice "crear/editar paradas" — esta fase cubre **crear** (Tarea 12) y **cambiar de estado** (`completed`/`cancelled`, Tarea 11), pero no editar `location`/`lat`/`lng`/horario de una parada ya creada (YAGNI hasta que aparezca una necesidad real — si el admin se equivoca, cancela y crea de nuevo). Las `event_bookings` sí tienen edición completa de `location`/horario/`estimatedGuests` (Tarea 16) porque el roadmap la exige explícitamente para poder confirmar una reserva.
- **Sin validación de máquina de estados** para el resto de las transiciones de `TrailerStopStatus`/`EventBookingStatus` — mismo criterio YAGNI que Fase 4 usó para `fulfillmentStatus`/`paymentStatus`.
- **`requireAdmin()` se extrae a un helper compartido** (`apps/web/src/lib/require-admin.ts`) — en Fase 4 vivía duplicado dentro de `admin-orders.ts`; esta fase lo usa en 3 archivos de Server Actions nuevos, así que se centraliza antes de triplicar la duplicación (`admin-orders.ts` se refactoriza para consumirlo también, sin cambiar su comportamiento).
- **Idioma y razonamiento:** regla ya vigente en `CLAUDE.md` — no se repite en cada tarea de este plan.
- **Commits:** un commit por tarea. Quien ejecute el plan nunca corre `git commit` — solo `git add` de los archivos relevantes y sugiere el comando exacto (español, una línea, sin firmas).
- **Branching:** directo sobre `main`, sin branches ni PRs.
- **Verificación de build real, no solo `tsc`:** Fase 4 encontró dos bugs (`useSearchParams` sin `Suspense`, `trustHost` faltante) que solo aparecían en `next build`/producción, nunca en `tsc --noEmit`. Cada tarea de UI nueva corre `pnpm run typecheck`; la Tarea de verificación end-to-end corre `pnpm run build` completo y revisa `.next/prerender-manifest.json` antes de dar por buena cualquier ruta nueva bajo `/admin/**`.

---

### Tarea 1: `packages/domain/src/trailer-stops` — CRUD y cambio de estado

**Files:**
- Modify: `packages/domain/src/trailer-stops/ports.ts`
- Modify: `packages/domain/src/trailer-stops/use-cases.ts`
- Modify: `packages/domain/src/trailer-stops/use-cases.test.ts`

**Interfaces:**
- Produces: `TrailerStopRepository.create(stop: Omit<TrailerStop, "id">): Promise<TrailerStop>`, `.findById(id): Promise<TrailerStop | null>`, `.updateStatus(id, status): Promise<void>`. `createTrailerStop(repo, input: { location: string; lat: number; lng: number; startTime: Date; endTime: Date }): Promise<TrailerStop>`, `completeTrailerStop(repo, id): Promise<void>`, `cancelTrailerStop(repo, id): Promise<void>`.

- [ ] **Step 1: Escribir los tests (fallan primero)**

Reemplazar `fakeRepo` en `packages/domain/src/trailer-stops/use-cases.test.ts` por una versión que implemente el puerto completo, y agregar los tests nuevos al final del archivo:

```ts
import { describe, it, expect } from "vitest";
import { listActiveTrailerStops, createTrailerStop, completeTrailerStop, cancelTrailerStop } from "./use-cases";
import type { TrailerStop } from "./entities";
import type { TrailerStopRepository } from "./ports";

function fakeStop(overrides: Partial<TrailerStop> = {}): TrailerStop {
  return {
    id: "stop1",
    location: "Central Market, Adelaide CBD",
    lat: -34.9289,
    lng: 138.5999,
    startTime: new Date("2026-09-18T06:30:00Z"),
    endTime: new Date("2026-09-18T10:30:00Z"),
    status: "scheduled",
    ...overrides,
  };
}

function fakeRepo(stops: TrailerStop[]): TrailerStopRepository & { created: Omit<TrailerStop, "id">[] } {
  const created: Omit<TrailerStop, "id">[] = [];
  return {
    created,
    async listActive() {
      return stops.filter((s) => s.status !== "completed" && s.status !== "cancelled");
    },
    async create(stop) {
      created.push(stop);
      const inserted = { ...stop, id: `stop-${created.length}` };
      stops.push(inserted);
      return inserted;
    },
    async findById(id) {
      return stops.find((s) => s.id === id) ?? null;
    },
    async updateStatus(id, status) {
      const stop = stops.find((s) => s.id === id);
      if (stop) stop.status = status;
    },
  };
}

describe("listActiveTrailerStops", () => {
  it("returns only stops that are not completed or cancelled", async () => {
    const repo = fakeRepo([
      fakeStop({ id: "stop1", status: "scheduled" }),
      fakeStop({ id: "stop2", status: "cancelled" }),
      fakeStop({ id: "stop3", status: "completed" }),
      fakeStop({ id: "stop4", status: "active" }),
    ]);

    const result = await listActiveTrailerStops(repo);
    expect(result.map((s) => s.id)).toEqual(["stop1", "stop4"]);
  });
});

describe("createTrailerStop", () => {
  it("creates a stop with status scheduled", async () => {
    const repo = fakeRepo([]);

    const stop = await createTrailerStop(repo, {
      location: "Rundle Park, Adelaide",
      lat: -34.9235,
      lng: 138.6087,
      startTime: new Date("2026-10-01T00:00:00Z"),
      endTime: new Date("2026-10-01T05:00:00Z"),
    });

    expect(stop.status).toBe("scheduled");
    expect(repo.created).toHaveLength(1);
  });

  it("throws when startTime is not before endTime", async () => {
    const repo = fakeRepo([]);

    await expect(
      createTrailerStop(repo, {
        location: "Rundle Park, Adelaide",
        lat: -34.9235,
        lng: 138.6087,
        startTime: new Date("2026-10-01T05:00:00Z"),
        endTime: new Date("2026-10-01T00:00:00Z"),
      }),
    ).rejects.toThrow("startTime must be before endTime");
  });
});

describe("completeTrailerStop / cancelTrailerStop", () => {
  it("marks a stop as completed", async () => {
    const repo = fakeRepo([fakeStop({ id: "stop1", status: "active" })]);

    await completeTrailerStop(repo, "stop1");

    expect((await repo.findById("stop1"))?.status).toBe("completed");
  });

  it("marks a stop as cancelled", async () => {
    const repo = fakeRepo([fakeStop({ id: "stop1", status: "scheduled" })]);

    await cancelTrailerStop(repo, "stop1");

    expect((await repo.findById("stop1"))?.status).toBe("cancelled");
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `pnpm --filter @workspace/domain run test -- trailer-stops`
Expected: FAIL — `create`/`findById`/`updateStatus` no existen en el fake (error de tipos), `createTrailerStop`/`completeTrailerStop`/`cancelTrailerStop` no existen

- [ ] **Step 3: Extender el puerto**

```ts
// packages/domain/src/trailer-stops/ports.ts
import type { TrailerStop, TrailerStopStatus } from "./entities";

export interface TrailerStopRepository {
  listActive(): Promise<TrailerStop[]>;
  create(stop: Omit<TrailerStop, "id">): Promise<TrailerStop>;
  findById(id: string): Promise<TrailerStop | null>;
  updateStatus(id: string, status: TrailerStopStatus): Promise<void>;
}
```

- [ ] **Step 4: Implementar los casos de uso**

```ts
// packages/domain/src/trailer-stops/use-cases.ts
import type { TrailerStopRepository } from "./ports";
import type { TrailerStop } from "./entities";

export function listActiveTrailerStops(repo: TrailerStopRepository): Promise<TrailerStop[]> {
  return repo.listActive();
}

export async function createTrailerStop(
  repo: TrailerStopRepository,
  input: { location: string; lat: number; lng: number; startTime: Date; endTime: Date },
): Promise<TrailerStop> {
  if (input.startTime >= input.endTime) {
    throw new Error("startTime must be before endTime");
  }
  return repo.create({ ...input, status: "scheduled" });
}

export async function completeTrailerStop(repo: TrailerStopRepository, id: string): Promise<void> {
  await repo.updateStatus(id, "completed");
}

export async function cancelTrailerStop(repo: TrailerStopRepository, id: string): Promise<void> {
  await repo.updateStatus(id, "cancelled");
}
```

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `pnpm --filter @workspace/domain run test -- trailer-stops`
Expected: PASS (6 tests)

- [ ] **Step 6: Verificar que el paquete completo sigue tipando limpio**

Run: `pnpm run typecheck`
Expected: falla transitoriamente en `packages/db`/`apps/web` (`DrizzleTrailerStopRepository` todavía no implementa el puerto ampliado) — se resuelve en la Tarea 2, mismo patrón que Fase 4.

- [ ] **Step 7: Commit**

```bash
git add packages/domain/src/trailer-stops
```

Comando sugerido: `git commit -m "Extiende TrailerStopRepository con create, findById y cambio de estado"`

---

### Tarea 2: Implementar los métodos nuevos en `DrizzleTrailerStopRepository`

**Files:**
- Modify: `packages/db/src/repositories/trailer-stop-repository.ts`
- Modify: `packages/db/src/repositories/trailer-stop-repository.test.ts`

**Interfaces:**
- Consumes: puerto extendido de `TrailerStopRepository` (Tarea 1).

- [ ] **Step 1: Agregar los casos al test de integración (fallan primero)**

Agregar al final de `packages/db/src/repositories/trailer-stop-repository.test.ts`:

```ts
  it("creates a stop, finds it by id, and updates its status", async () => {
    const repo = new DrizzleTrailerStopRepository();

    const stop = await repo.create({
      location: `Test Stop ${Date.now()}`,
      lat: -34.9,
      lng: 138.6,
      startTime: new Date("2026-11-01T00:00:00Z"),
      endTime: new Date("2026-11-01T05:00:00Z"),
      status: "scheduled",
    });

    const found = await repo.findById(stop.id);
    expect(found?.location).toBe(stop.location);

    await repo.updateStatus(stop.id, "completed");
    const updated = await repo.findById(stop.id);
    expect(updated?.status).toBe("completed");
  });
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `pnpm --filter @workspace/db run test -- trailer-stop-repository`
Expected: FAIL — `repo.create is not a function`

- [ ] **Step 3: Implementar los métodos**

Agregar dentro de `class DrizzleTrailerStopRepository`, después de `listActive`:

```ts
  async create(stop: Omit<TrailerStop, "id">): Promise<TrailerStop> {
    const [inserted] = await db.insert(trailerStopsTable).values(stop).returning();
    return inserted;
  }

  async findById(id: string): Promise<TrailerStop | null> {
    const [row] = await db.select().from(trailerStopsTable).where(eq(trailerStopsTable.id, id));
    return row ?? null;
  }

  async updateStatus(id: string, status: TrailerStop["status"]): Promise<void> {
    await db.update(trailerStopsTable).set({ status }).where(eq(trailerStopsTable.id, id));
  }
```

Agregar `eq` al import de `drizzle-orm` (reemplazar la línea de import existente):

```ts
import { and, asc, eq, gte, ne } from "drizzle-orm";
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `pnpm --filter @workspace/db run test -- trailer-stop-repository`
Expected: PASS

- [ ] **Step 5: Verificar que el monorepo sigue tipando limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/repositories/trailer-stop-repository.ts packages/db/src/repositories/trailer-stop-repository.test.ts
```

Comando sugerido: `git commit -m "Implementa create, findById y updateStatus en DrizzleTrailerStopRepository"`

---

### Tarea 3: `packages/domain/src/stock` — inicialización, reposición y merma

**Files:**
- Modify: `packages/domain/src/stock/ports.ts`
- Modify: `packages/domain/src/stock/use-cases.ts`
- Modify: `packages/domain/src/stock/use-cases.test.ts`

**Interfaces:**
- Produces: `StockRepository.create(stock: Omit<StopProductStock, "id">): Promise<StopProductStock>`, `.listByStop(stopId): Promise<StopProductStock[]>`, `.incrementStock(id, quantity): Promise<StopProductStock>`. `initializeStopStock(repo, stopId, items: { productId: string; maxStock: number }[]): Promise<StopProductStock[]>`, `restockProduct(repo, stopId, productId, quantity, reportedByUserId): Promise<void>`, `reportStockWaste(repo, stopId, productId, quantity, reason, reportedByUserId): Promise<void>`.

`decrementStockOnSale` y `reportStockWaste` comparten la misma lógica de "buscar, validar suficiencia, decrementar, registrar evento" — se extrae a un helper interno no exportado (`decrementWithEvent`) para no duplicarla.

- [ ] **Step 1: Escribir los tests (fallan primero)**

Reemplazar el contenido completo de `packages/domain/src/stock/use-cases.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { decrementStockOnSale, initializeStopStock, restockProduct, reportStockWaste } from "./use-cases";
import type { StopProductStock, StockEvent } from "./entities";
import type { StockRepository } from "./ports";

function fakeStockRepo(initial: StopProductStock[] = []): StockRepository & {
  events: Omit<StockEvent, "id">[];
  created: Omit<StopProductStock, "id">[];
} {
  const stock = [...initial];
  const events: Omit<StockEvent, "id">[] = [];
  const created: Omit<StopProductStock, "id">[] = [];
  return {
    events,
    created,
    async findByStopAndProduct(stopId, productId) {
      return stock.find((s) => s.stopId === stopId && s.productId === productId) ?? null;
    },
    async decrementStock(id, quantity) {
      const item = stock.find((s) => s.id === id);
      if (!item) throw new Error("not found");
      item.currentStock -= quantity;
      return item;
    },
    async incrementStock(id, quantity) {
      const item = stock.find((s) => s.id === id);
      if (!item) throw new Error("not found");
      item.currentStock += quantity;
      return item;
    },
    async recordEvent(event) {
      events.push(event);
      return { ...event, id: `event-${events.length}` };
    },
    async create(item) {
      created.push(item);
      const inserted = { ...item, id: `stock-${created.length}` };
      stock.push(inserted);
      return inserted;
    },
    async listByStop(stopId) {
      return stock.filter((s) => s.stopId === stopId);
    },
  };
}

describe("decrementStockOnSale", () => {
  it("decrements stock and records a sale event", async () => {
    const repo = fakeStockRepo([{ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 10 }]);

    await decrementStockOnSale(repo, "stop1", "p1", 3);

    expect(repo.events).toEqual([
      { stopProductStockId: "s1", eventType: "sale", quantity: 3, reason: null, reportedByUserId: null },
    ]);
  });

  it("throws when there is no stock record for that stop/product", async () => {
    const repo = fakeStockRepo([{ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 10 }]);

    await expect(decrementStockOnSale(repo, "other-stop", "p1", 1)).rejects.toThrow(
      "No stock record for product p1 at stop other-stop",
    );
  });

  it("throws when there is not enough stock", async () => {
    const repo = fakeStockRepo([{ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 2 }]);

    await expect(decrementStockOnSale(repo, "stop1", "p1", 3)).rejects.toThrow(
      "Insufficient stock for product p1 at stop stop1",
    );
  });
});

describe("initializeStopStock", () => {
  it("creates one stock row per product with currentStock equal to maxStock", async () => {
    const repo = fakeStockRepo([]);

    const result = await initializeStopStock(repo, "stop1", [
      { productId: "p1", maxStock: 20 },
      { productId: "p2", maxStock: 15 },
    ]);

    expect(result).toHaveLength(2);
    expect(repo.created).toEqual([
      { stopId: "stop1", productId: "p1", maxStock: 20, currentStock: 20 },
      { stopId: "stop1", productId: "p2", maxStock: 15, currentStock: 15 },
    ]);
  });
});

describe("restockProduct", () => {
  it("increments stock and records a restock event", async () => {
    const repo = fakeStockRepo([{ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 10 }]);

    await restockProduct(repo, "stop1", "p1", 5, "user1");

    expect(repo.events).toEqual([
      { stopProductStockId: "s1", eventType: "restock", quantity: 5, reason: null, reportedByUserId: "user1" },
    ]);
  });
});

describe("reportStockWaste", () => {
  it("decrements stock and records a waste event with a reason", async () => {
    const repo = fakeStockRepo([{ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 10 }]);

    await reportStockWaste(repo, "stop1", "p1", 2, "Dropped tray", "user1");

    expect(repo.events).toEqual([
      { stopProductStockId: "s1", eventType: "waste", quantity: 2, reason: "Dropped tray", reportedByUserId: "user1" },
    ]);
  });

  it("throws when there is not enough stock to waste", async () => {
    const repo = fakeStockRepo([{ id: "s1", stopId: "stop1", productId: "p1", maxStock: 50, currentStock: 1 }]);

    await expect(reportStockWaste(repo, "stop1", "p1", 2, null, null)).rejects.toThrow(
      "Insufficient stock for product p1 at stop stop1",
    );
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `pnpm --filter @workspace/domain run test -- stock`
Expected: FAIL — `incrementStock`/`create`/`listByStop` no existen en el fake, `initializeStopStock`/`restockProduct`/`reportStockWaste` no existen

- [ ] **Step 3: Extender el puerto**

```ts
// packages/domain/src/stock/ports.ts
import type { StopProductStock, StockEvent } from "./entities";

export interface StockRepository {
  findByStopAndProduct(stopId: string, productId: string): Promise<StopProductStock | null>;
  decrementStock(stopProductStockId: string, quantity: number): Promise<StopProductStock>;
  incrementStock(stopProductStockId: string, quantity: number): Promise<StopProductStock>;
  recordEvent(event: Omit<StockEvent, "id">): Promise<StockEvent>;
  create(stock: Omit<StopProductStock, "id">): Promise<StopProductStock>;
  listByStop(stopId: string): Promise<StopProductStock[]>;
}
```

- [ ] **Step 4: Implementar los casos de uso**

```ts
// packages/domain/src/stock/use-cases.ts
import type { StockRepository } from "./ports";
import type { StockEventType } from "./entities";

async function decrementWithEvent(
  repo: StockRepository,
  stopId: string,
  productId: string,
  quantity: number,
  eventType: StockEventType,
  reason: string | null,
  reportedByUserId: string | null,
): Promise<void> {
  const stock = await repo.findByStopAndProduct(stopId, productId);
  if (!stock) throw new Error(`No stock record for product ${productId} at stop ${stopId}`);
  if (stock.currentStock < quantity) {
    throw new Error(`Insufficient stock for product ${productId} at stop ${stopId}`);
  }

  await repo.decrementStock(stock.id, quantity);
  await repo.recordEvent({
    stopProductStockId: stock.id,
    eventType,
    quantity,
    reason,
    reportedByUserId,
  });
}

export function decrementStockOnSale(
  repo: StockRepository,
  stopId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  return decrementWithEvent(repo, stopId, productId, quantity, "sale", null, null);
}

export function reportStockWaste(
  repo: StockRepository,
  stopId: string,
  productId: string,
  quantity: number,
  reason: string | null,
  reportedByUserId: string | null,
): Promise<void> {
  return decrementWithEvent(repo, stopId, productId, quantity, "waste", reason, reportedByUserId);
}

export async function initializeStopStock(
  repo: StockRepository,
  stopId: string,
  items: { productId: string; maxStock: number }[],
): Promise<import("./entities").StopProductStock[]> {
  const created = [];
  for (const item of items) {
    created.push(await repo.create({ stopId, productId: item.productId, maxStock: item.maxStock, currentStock: item.maxStock }));
  }
  return created;
}

export async function restockProduct(
  repo: StockRepository,
  stopId: string,
  productId: string,
  quantity: number,
  reportedByUserId: string | null,
): Promise<void> {
  const stock = await repo.findByStopAndProduct(stopId, productId);
  if (!stock) throw new Error(`No stock record for product ${productId} at stop ${stopId}`);

  await repo.incrementStock(stock.id, quantity);
  await repo.recordEvent({
    stopProductStockId: stock.id,
    eventType: "restock",
    quantity,
    reason: null,
    reportedByUserId,
  });
}
```

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `pnpm --filter @workspace/domain run test -- stock`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/stock
```

Comando sugerido: `git commit -m "Agrega inicializacion de stock, reposicion y reporte de merma al dominio"`

---

### Tarea 4: Implementar los métodos nuevos en `DrizzleStockRepository`

**Files:**
- Modify: `packages/db/src/repositories/stock-repository.ts`
- Modify: `packages/db/src/repositories/stock-repository.test.ts` (crear si no existe)

**Interfaces:**
- Consumes: puerto extendido de `StockRepository` (Tarea 3).

- [ ] **Step 1: Escribir el test de integración (falla primero)**

Si `packages/db/src/repositories/stock-repository.test.ts` no existe, crearlo:

```ts
// packages/db/src/repositories/stock-repository.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { DrizzleStockRepository } from "./stock-repository";
import { DrizzleTrailerStopRepository } from "./trailer-stop-repository";
import { DrizzleProductRepository } from "./product-repository";

describe("DrizzleStockRepository", () => {
  let stopId: string;
  let productId: string;

  beforeAll(async () => {
    const stops = new DrizzleTrailerStopRepository();
    const stop = await stops.create({
      location: `Stock Test Stop ${Date.now()}`,
      lat: -34.9,
      lng: 138.6,
      startTime: new Date("2026-11-02T00:00:00Z"),
      endTime: new Date("2026-11-02T05:00:00Z"),
      status: "scheduled",
    });
    stopId = stop.id;

    const products = new DrizzleProductRepository();
    const product = await products.findBySlug("gluttony");
    if (!product) throw new Error("Seed product 'gluttony' not found — run the seed first");
    productId = product.id;
  });

  it("creates a stock row, lists it by stop, increments and decrements it", async () => {
    const repo = new DrizzleStockRepository();

    const created = await repo.create({ stopId, productId, maxStock: 30, currentStock: 30 });
    expect(created.currentStock).toBe(30);

    const byStop = await repo.listByStop(stopId);
    expect(byStop.some((s) => s.id === created.id)).toBe(true);

    const incremented = await repo.incrementStock(created.id, 5);
    expect(incremented.currentStock).toBe(35);

    const decremented = await repo.decrementStock(created.id, 10);
    expect(decremented.currentStock).toBe(25);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `pnpm --filter @workspace/db run test -- stock-repository`
Expected: FAIL — `repo.create is not a function`

- [ ] **Step 3: Implementar los métodos**

Agregar dentro de `class DrizzleStockRepository`, después de `recordEvent`:

```ts
  async create(stock: Omit<StopProductStock, "id">): Promise<StopProductStock> {
    const [inserted] = await db.insert(stopProductStockTable).values(stock).returning();
    return inserted;
  }

  async listByStop(stopId: string): Promise<StopProductStock[]> {
    return db.select().from(stopProductStockTable).where(eq(stopProductStockTable.stopId, stopId));
  }

  async incrementStock(stopProductStockId: string, quantity: number): Promise<StopProductStock> {
    const [updated] = await db
      .update(stopProductStockTable)
      .set({ currentStock: sql`${stopProductStockTable.currentStock} + ${quantity}` })
      .where(eq(stopProductStockTable.id, stopProductStockId))
      .returning();
    return updated;
  }
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `pnpm --filter @workspace/db run test -- stock-repository`
Expected: PASS

- [ ] **Step 5: Verificar que el monorepo sigue tipando limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/repositories/stock-repository.ts packages/db/src/repositories/stock-repository.test.ts
```

Comando sugerido: `git commit -m "Implementa create, listByStop e incrementStock en DrizzleStockRepository"`

---

### Tarea 5: `packages/domain/src/event-bookings` — consulta, cambio de estado e items

**Files:**
- Modify: `packages/domain/src/event-bookings/ports.ts`
- Modify: `packages/domain/src/event-bookings/use-cases.ts`
- Modify: `packages/domain/src/event-bookings/use-cases.test.ts`

**Interfaces:**
- Produces: `EventBookingRepository.findById(id): Promise<EventBooking | null>`, `.listAll(filters?: { status?: EventBookingStatus }): Promise<EventBooking[]>`, `.updateStatus(id, status): Promise<void>`, `.addItem(eventBookingId, item: EventBookingItem): Promise<EventBooking>`, `.update(id, fields): Promise<void>`. `quoteEventBooking(repo, id): Promise<void>`, `confirmEventBooking(repo, id): Promise<void>` (lanza si `location === "TBD"`), `cancelEventBooking(repo, id): Promise<void>`, `completeEventBooking(repo, id): Promise<void>`, `addEventBookingItem(repo, eventBookingId, item: { description: string; quantity: number; agreedUnitPriceCents: number }): Promise<EventBooking>`, `updateEventBookingDetails(repo, id, fields: Partial<Pick<EventBooking, "location" | "startTime" | "endTime" | "estimatedGuests" | "notes">>): Promise<void>` — esta última es lo que le permite al admin reemplazar el placeholder `location: "TBD"` (y el horario "día completo" del formulario público, Fase 2) por datos reales antes de confirmar.

- [ ] **Step 1: Escribir los tests (fallan primero)**

Reemplazar el contenido completo de `packages/domain/src/event-bookings/use-cases.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  requestEventQuote,
  quoteEventBooking,
  confirmEventBooking,
  cancelEventBooking,
  completeEventBooking,
  addEventBookingItem,
} from "./use-cases";
import type { EventBooking } from "./entities";
import type { EventBookingRepository } from "./ports";

function fakeBooking(overrides: Partial<EventBooking> = {}): EventBooking {
  return {
    id: "booking1",
    clientName: "Acme Corp",
    clientCompany: "Acme",
    clientEmail: "events@acme.com",
    clientPhone: "+61400000000",
    eventType: "corporate",
    eventDate: new Date("2026-11-01"),
    startTime: new Date("2026-11-01T17:00:00Z"),
    endTime: new Date("2026-11-01T20:00:00Z"),
    location: "TBD",
    estimatedGuests: 40,
    status: "quote_requested",
    notes: null,
    items: [],
    ...overrides,
  };
}

function fakeEventBookingRepo(
  bookings: EventBooking[] = [],
): EventBookingRepository & { created: Omit<EventBooking, "id">[] } {
  const created: Omit<EventBooking, "id">[] = [];
  return {
    created,
    async create(booking) {
      created.push(booking);
      const inserted = { ...booking, id: `booking-${created.length}` };
      bookings.push(inserted);
      return inserted;
    },
    async findOverlapping() {
      return [];
    },
    async findById(id) {
      return bookings.find((b) => b.id === id) ?? null;
    },
    async listAll(filters) {
      if (filters?.status) return bookings.filter((b) => b.status === filters.status);
      return bookings;
    },
    async updateStatus(id, status) {
      const booking = bookings.find((b) => b.id === id);
      if (booking) booking.status = status;
    },
    async addItem(eventBookingId, item) {
      const booking = bookings.find((b) => b.id === eventBookingId);
      if (!booking) throw new Error("not found");
      booking.items.push(item);
      return booking;
    },
  };
}

describe("requestEventQuote", () => {
  it("creates a booking with status quote_requested and no items by default", async () => {
    const repo = fakeEventBookingRepo();

    const booking = await requestEventQuote(repo, {
      clientName: "Acme Corp",
      clientCompany: "Acme",
      clientEmail: "events@acme.com",
      clientPhone: "+61400000000",
      eventType: "corporate",
      eventDate: new Date("2026-11-01"),
      startTime: new Date("2026-11-01T17:00:00Z"),
      endTime: new Date("2026-11-01T20:00:00Z"),
      location: "Adelaide CBD",
      estimatedGuests: 40,
      notes: null,
    });

    expect(booking.status).toBe("quote_requested");
    expect(booking.items).toEqual([]);
  });
});

describe("quoteEventBooking", () => {
  it("moves a booking to status quoted", async () => {
    const repo = fakeEventBookingRepo([fakeBooking({ id: "b1", status: "quote_requested" })]);

    await quoteEventBooking(repo, "b1");

    expect((await repo.findById("b1"))?.status).toBe("quoted");
  });
});

describe("confirmEventBooking", () => {
  it("moves a booking to status confirmed when location is defined", async () => {
    const repo = fakeEventBookingRepo([fakeBooking({ id: "b1", status: "quoted", location: "Adelaide CBD" })]);

    await confirmEventBooking(repo, "b1");

    expect((await repo.findById("b1"))?.status).toBe("confirmed");
  });

  it("throws when trying to confirm a booking with location still TBD", async () => {
    const repo = fakeEventBookingRepo([fakeBooking({ id: "b1", status: "quoted", location: "TBD" })]);

    await expect(confirmEventBooking(repo, "b1")).rejects.toThrow(
      "Cannot confirm a booking with location still TBD",
    );
    expect((await repo.findById("b1"))?.status).toBe("quoted");
  });

  it("throws when the booking does not exist", async () => {
    const repo = fakeEventBookingRepo([]);

    await expect(confirmEventBooking(repo, "missing")).rejects.toThrow("Event booking not found: missing");
  });
});

describe("cancelEventBooking / completeEventBooking", () => {
  it("cancels a booking", async () => {
    const repo = fakeEventBookingRepo([fakeBooking({ id: "b1", status: "quoted" })]);

    await cancelEventBooking(repo, "b1");

    expect((await repo.findById("b1"))?.status).toBe("cancelled");
  });

  it("completes a booking", async () => {
    const repo = fakeEventBookingRepo([fakeBooking({ id: "b1", status: "confirmed" })]);

    await completeEventBooking(repo, "b1");

    expect((await repo.findById("b1"))?.status).toBe("completed");
  });
});

describe("addEventBookingItem", () => {
  it("appends an item to the booking", async () => {
    const repo = fakeEventBookingRepo([fakeBooking({ id: "b1" })]);

    const updated = await addEventBookingItem(repo, "b1", {
      description: "Custom dessert platter",
      quantity: 40,
      agreedUnitPriceCents: 1200,
    });

    expect(updated.items).toEqual([
      { description: "Custom dessert platter", quantity: 40, agreedUnitPriceCents: 1200 },
    ]);
  });
});

describe("updateEventBookingDetails", () => {
  it("updates location, schedule and guest count", async () => {
    const repo = fakeEventBookingRepo([fakeBooking({ id: "b1", location: "TBD" })]);

    await updateEventBookingDetails(repo, "b1", {
      location: "Adelaide Hills Winery",
      startTime: new Date("2026-11-01T18:00:00Z"),
      endTime: new Date("2026-11-01T23:00:00Z"),
      estimatedGuests: 60,
    });

    const updated = await repo.findById("b1");
    expect(updated?.location).toBe("Adelaide Hills Winery");
    expect(updated?.estimatedGuests).toBe(60);
  });
});
```

Agregar `updateEventBookingDetails` al import de `./use-cases` en la primera línea del archivo, junto a los demás.

Agregar `async update(id, fields) { const booking = bookings.find((b) => b.id === id); if (booking) Object.assign(booking, fields); },` dentro de `fakeEventBookingRepo`, junto a los demás métodos.

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `pnpm --filter @workspace/domain run test -- event-bookings`
Expected: FAIL — `findById`/`listAll`/`updateStatus`/`addItem` no existen en el fake, `quoteEventBooking`/`confirmEventBooking`/`cancelEventBooking`/`completeEventBooking`/`addEventBookingItem` no existen

- [ ] **Step 3: Extender el puerto**

```ts
// packages/domain/src/event-bookings/ports.ts
import type { EventBooking, EventBookingStatus, EventBookingItem } from "./entities";

export interface EventBookingRepository {
  create(booking: Omit<EventBooking, "id">): Promise<EventBooking>;
  findOverlapping(eventDate: Date, startTime: Date, endTime: Date): Promise<EventBooking[]>;
  findById(id: string): Promise<EventBooking | null>;
  listAll(filters?: { status?: EventBookingStatus }): Promise<EventBooking[]>;
  updateStatus(id: string, status: EventBookingStatus): Promise<void>;
  addItem(eventBookingId: string, item: EventBookingItem): Promise<EventBooking>;
  update(id: string, fields: Partial<Pick<EventBooking, "location" | "startTime" | "endTime" | "estimatedGuests" | "notes">>): Promise<void>;
}
```

- [ ] **Step 4: Implementar los casos de uso**

Agregar al final de `packages/domain/src/event-bookings/use-cases.ts`:

```ts
export async function quoteEventBooking(repo: EventBookingRepository, id: string): Promise<void> {
  await repo.updateStatus(id, "quoted");
}

export async function confirmEventBooking(repo: EventBookingRepository, id: string): Promise<void> {
  const booking = await repo.findById(id);
  if (!booking) throw new Error(`Event booking not found: ${id}`);
  if (booking.location === "TBD") {
    throw new Error("Cannot confirm a booking with location still TBD");
  }
  await repo.updateStatus(id, "confirmed");
}

export async function cancelEventBooking(repo: EventBookingRepository, id: string): Promise<void> {
  await repo.updateStatus(id, "cancelled");
}

export async function completeEventBooking(repo: EventBookingRepository, id: string): Promise<void> {
  await repo.updateStatus(id, "completed");
}

export async function addEventBookingItem(
  repo: EventBookingRepository,
  eventBookingId: string,
  item: EventBookingItem,
): Promise<EventBooking> {
  return repo.addItem(eventBookingId, item);
}

export async function updateEventBookingDetails(
  repo: EventBookingRepository,
  id: string,
  fields: Partial<Pick<EventBooking, "location" | "startTime" | "endTime" | "estimatedGuests" | "notes">>,
): Promise<void> {
  await repo.update(id, fields);
}
```

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `pnpm --filter @workspace/domain run test -- event-bookings`
Expected: PASS (10 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/event-bookings
```

Comando sugerido: `git commit -m "Agrega cambio de estado, consulta e items al dominio de event bookings"`

---

### Tarea 6: Implementar los métodos nuevos en `DrizzleEventBookingRepository`

**Files:**
- Modify: `packages/db/src/repositories/event-booking-repository.ts`
- Modify: `packages/db/src/repositories/event-booking-repository.test.ts` (crear si no existe)

**Interfaces:**
- Consumes: puerto extendido de `EventBookingRepository` (Tarea 5).

`findOverlapping` hoy retorna `items: []` siempre (no hace join). Se agrega un `attachItems` privado, mismo patrón que `DrizzleOrderRepository` en Fase 4, y se lo usa también en `findOverlapping`, `findById` y `listAll` para que los items reales viajen siempre.

- [ ] **Step 1: Escribir el test de integración (falla primero)**

Si `packages/db/src/repositories/event-booking-repository.test.ts` no existe, crearlo:

```ts
// packages/db/src/repositories/event-booking-repository.test.ts
import { describe, it, expect } from "vitest";
import { requestEventQuote } from "@workspace/domain/event-bookings";
import { DrizzleEventBookingRepository } from "./event-booking-repository";

describe("DrizzleEventBookingRepository", () => {
  it("creates a booking, finds it by id, lists it, updates its status and adds an item", async () => {
    const repo = new DrizzleEventBookingRepository();

    const booking = await requestEventQuote(repo, {
      clientName: "Integration Test Client",
      clientCompany: null,
      clientEmail: `event-test-${Date.now()}@example.com`,
      clientPhone: "+61400000005",
      eventType: "wedding",
      eventDate: new Date("2026-12-01"),
      startTime: new Date("2026-12-01T15:00:00Z"),
      endTime: new Date("2026-12-01T22:00:00Z"),
      location: "Adelaide Hills",
      estimatedGuests: 80,
      notes: null,
    });

    const found = await repo.findById(booking.id);
    expect(found?.clientName).toBe("Integration Test Client");

    const all = await repo.listAll({ status: "quote_requested" });
    expect(all.some((b) => b.id === booking.id)).toBe(true);

    await repo.updateStatus(booking.id, "quoted");
    expect((await repo.findById(booking.id))?.status).toBe("quoted");

    const withItem = await repo.addItem(booking.id, {
      description: "Wedding cake tier",
      quantity: 1,
      agreedUnitPriceCents: 25000,
    });
    expect(withItem.items).toEqual([
      { description: "Wedding cake tier", quantity: 1, agreedUnitPriceCents: 25000 },
    ]);

    await repo.update(booking.id, { location: "Adelaide Hills Winery", estimatedGuests: 100 });
    const updated = await repo.findById(booking.id);
    expect(updated?.location).toBe("Adelaide Hills Winery");
    expect(updated?.estimatedGuests).toBe(100);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `pnpm --filter @workspace/db run test -- event-booking-repository`
Expected: FAIL — `repo.findById is not a function`

- [ ] **Step 3: Implementar los métodos**

Reemplazar el archivo completo `packages/db/src/repositories/event-booking-repository.ts`:

```ts
import { and, eq, gt, lt } from "drizzle-orm";
import type { EventBooking, EventBookingRepository, EventBookingStatus, EventBookingItem } from "@workspace/domain/event-bookings";
import { db } from "../index";
import { eventBookingItemsTable, eventBookingsTable } from "../schema";

export class DrizzleEventBookingRepository implements EventBookingRepository {
  async create(booking: Omit<EventBooking, "id">): Promise<EventBooking> {
    return db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(eventBookingsTable)
        .values({
          clientName: booking.clientName,
          clientCompany: booking.clientCompany,
          clientEmail: booking.clientEmail,
          clientPhone: booking.clientPhone,
          eventType: booking.eventType,
          eventDate: booking.eventDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
          location: booking.location,
          estimatedGuests: booking.estimatedGuests,
          status: booking.status,
          notes: booking.notes,
        })
        .returning();

      if (booking.items.length > 0) {
        await tx.insert(eventBookingItemsTable).values(
          booking.items.map((item) => ({
            eventBookingId: inserted.id,
            description: item.description,
            quantity: item.quantity,
            agreedUnitPriceCents: item.agreedUnitPriceCents,
          })),
        );
      }

      return { ...inserted, items: booking.items };
    });
  }

  async findOverlapping(eventDate: Date, startTime: Date, endTime: Date): Promise<EventBooking[]> {
    const rows = await db
      .select()
      .from(eventBookingsTable)
      .where(
        and(
          eq(eventBookingsTable.status, "confirmed"),
          lt(eventBookingsTable.startTime, endTime),
          gt(eventBookingsTable.endTime, startTime),
        ),
      );

    return Promise.all(rows.map((row) => this.attachItems(row)));
  }

  async findById(id: string): Promise<EventBooking | null> {
    const [row] = await db.select().from(eventBookingsTable).where(eq(eventBookingsTable.id, id));
    if (!row) return null;
    return this.attachItems(row);
  }

  async listAll(filters?: { status?: EventBookingStatus }): Promise<EventBooking[]> {
    const rows = await db
      .select()
      .from(eventBookingsTable)
      .where(filters?.status ? eq(eventBookingsTable.status, filters.status) : undefined);
    return Promise.all(rows.map((row) => this.attachItems(row)));
  }

  async updateStatus(id: string, status: EventBookingStatus): Promise<void> {
    await db.update(eventBookingsTable).set({ status }).where(eq(eventBookingsTable.id, id));
  }

  async update(
    id: string,
    fields: Partial<Pick<EventBooking, "location" | "startTime" | "endTime" | "estimatedGuests" | "notes">>,
  ): Promise<void> {
    await db.update(eventBookingsTable).set(fields).where(eq(eventBookingsTable.id, id));
  }

  async addItem(eventBookingId: string, item: EventBookingItem): Promise<EventBooking> {
    await db.insert(eventBookingItemsTable).values({ eventBookingId, ...item });
    const updated = await this.findById(eventBookingId);
    if (!updated) throw new Error(`Event booking not found: ${eventBookingId}`);
    return updated;
  }

  private async attachItems(row: typeof eventBookingsTable.$inferSelect): Promise<EventBooking> {
    const itemRows = await db
      .select()
      .from(eventBookingItemsTable)
      .where(eq(eventBookingItemsTable.eventBookingId, row.id));
    return {
      ...row,
      items: itemRows.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        agreedUnitPriceCents: item.agreedUnitPriceCents,
      })),
    };
  }
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `pnpm --filter @workspace/db run test -- event-booking-repository`
Expected: PASS

- [ ] **Step 5: Verificar que el monorepo sigue tipando limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/repositories/event-booking-repository.ts packages/db/src/repositories/event-booking-repository.test.ts
```

Comando sugerido: `git commit -m "Implementa consulta, cambio de estado e items en DrizzleEventBookingRepository"`

---

### Tarea 7: `apps/web/src/lib/require-admin.ts` — helper compartido de guard de rol

**Files:**
- Create: `apps/web/src/lib/require-admin.ts`
- Modify: `apps/web/src/app/actions/admin-orders.ts`

**Interfaces:**
- Produces: `requireAdmin(): Promise<void>` — lanza `Error("Forbidden")` si no hay sesión o el rol no es `admin`.

Esta fase agrega 3 archivos de Server Actions nuevos (Tareas 10, 14) que necesitan la misma guardia que ya usa `admin-orders.ts` — se extrae ahora para no triplicarla, y `admin-orders.ts` se refactoriza para consumirla sin cambiar su comportamiento externo.

- [ ] **Step 1: Crear el helper**

```ts
// apps/web/src/lib/require-admin.ts
import { auth } from "@/auth";

export async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    throw new Error("Forbidden");
  }
}
```

- [ ] **Step 2: Refactorizar `admin-orders.ts` para usarlo**

En `apps/web/src/app/actions/admin-orders.ts`, eliminar la función local `requireAdmin` y su import de `auth`, reemplazándolos por:

```ts
import { requireAdmin } from "@/lib/require-admin";
```

El resto del archivo (`listOrdersAction`, `updateOrderStatusAction`) queda igual.

- [ ] **Step 3: Correr los tests existentes de order-repository y typecheck**

Run: `pnpm --filter @workspace/db run test -- order-repository && pnpm run typecheck`
Expected: ambos PASS — este refactor no toca lógica de negocio, solo mueve dónde vive `requireAdmin`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/require-admin.ts apps/web/src/app/actions/admin-orders.ts
```

Comando sugerido: `git commit -m "Extrae requireAdmin a un helper compartido"`

---

### Tarea 8: `packages/i18n` — namespace `admin` extendido (trailer stops, stock, event bookings, calendario)

**Files:**
- Modify: `packages/i18n/src/types.ts`
- Modify: `packages/i18n/src/dictionaries/en.ts`
- Modify: `packages/i18n/src/dictionaries/es.ts`

- [ ] **Step 1: Agregar las claves nuevas al tipo `Dictionary`**

En `packages/i18n/src/types.ts`, dentro del bloque `admin: {...}` ya existente, agregar después de `statusSaved: string;`:

```ts
    navOrders: string;
    navTrailerStops: string;
    navEventBookings: string;
    navCalendar: string;
    stopsTitle: string;
    stopsCreateButton: string;
    stopsColumnLocation: string;
    stopsColumnDate: string;
    stopsColumnStatus: string;
    stopsCompleteButton: string;
    stopsCancelButton: string;
    stopFormLocation: string;
    stopFormStartTime: string;
    stopFormEndTime: string;
    stopFormMapHint: string;
    stopFormOverlapWarning: string;
    stopFormProducts: string;
    stopFormMaxStock: string;
    stopFormSubmit: string;
    stockTitle: string;
    stockColumnProduct: string;
    stockColumnCurrent: string;
    stockColumnMax: string;
    stockRestockButton: string;
    stockWasteButton: string;
    stockWasteReasonPlaceholder: string;
    bookingsTitle: string;
    bookingsFilterStatus: string;
    bookingsColumnClient: string;
    bookingsColumnEventType: string;
    bookingsColumnDate: string;
    bookingsColumnLocation: string;
    bookingsColumnStatus: string;
    bookingLocationTbdWarning: string;
    bookingQuoteButton: string;
    bookingConfirmButton: string;
    bookingConfirmBlockedTbd: string;
    bookingCancelButton: string;
    bookingCompleteButton: string;
    bookingAddItemTitle: string;
    bookingItemDescription: string;
    bookingItemQuantity: string;
    bookingItemPrice: string;
    bookingAddItemButton: string;
    calendarTitle: string;
    calendarLegendStop: string;
    calendarLegendBooking: string;
```

- [ ] **Step 2: Agregar las traducciones en inglés**

En `packages/i18n/src/dictionaries/en.ts`, dentro del bloque `admin: {...}`, agregar después de `statusSaved: "Saved",`:

```ts
    navOrders: "Orders",
    navTrailerStops: "Trailer Stops",
    navEventBookings: "Event Bookings",
    navCalendar: "Calendar",
    stopsTitle: "Trailer Stops",
    stopsCreateButton: "New stop",
    stopsColumnLocation: "Location",
    stopsColumnDate: "Date",
    stopsColumnStatus: "Status",
    stopsCompleteButton: "Mark completed",
    stopsCancelButton: "Cancel",
    stopFormLocation: "Location name",
    stopFormStartTime: "Start time",
    stopFormEndTime: "End time",
    stopFormMapHint: "Click or drag the pin to set the exact location",
    stopFormOverlapWarning: "This overlaps with a confirmed event booking",
    stopFormProducts: "Products at this stop",
    stopFormMaxStock: "Initial stock",
    stopFormSubmit: "Create stop",
    stockTitle: "Stock",
    stockColumnProduct: "Product",
    stockColumnCurrent: "Current",
    stockColumnMax: "Max",
    stockRestockButton: "Restock",
    stockWasteButton: "Report waste",
    stockWasteReasonPlaceholder: "Reason (optional)",
    bookingsTitle: "Event Bookings",
    bookingsFilterStatus: "Status",
    bookingsColumnClient: "Client",
    bookingsColumnEventType: "Type",
    bookingsColumnDate: "Date",
    bookingsColumnLocation: "Location",
    bookingsColumnStatus: "Status",
    bookingLocationTbdWarning: "Location still TBD",
    bookingQuoteButton: "Mark as quoted",
    bookingConfirmButton: "Confirm booking",
    bookingConfirmBlockedTbd: "Set a real location before confirming",
    bookingCancelButton: "Cancel booking",
    bookingCompleteButton: "Mark completed",
    bookingAddItemTitle: "Quote items",
    bookingItemDescription: "Description",
    bookingItemQuantity: "Quantity",
    bookingItemPrice: "Unit price (cents)",
    bookingAddItemButton: "Add item",
    calendarTitle: "Calendar",
    calendarLegendStop: "Trailer stop",
    calendarLegendBooking: "Confirmed event",
```

- [ ] **Step 3: Agregar las traducciones en español**

En `packages/i18n/src/dictionaries/es.ts`, dentro del bloque `admin: {...}`, agregar después de `statusSaved: "Guardado",`:

```ts
    navOrders: "Órdenes",
    navTrailerStops: "Paradas del Trailer",
    navEventBookings: "Reservas de Eventos",
    navCalendar: "Calendario",
    stopsTitle: "Paradas del Trailer",
    stopsCreateButton: "Nueva parada",
    stopsColumnLocation: "Ubicación",
    stopsColumnDate: "Fecha",
    stopsColumnStatus: "Estado",
    stopsCompleteButton: "Marcar completada",
    stopsCancelButton: "Cancelar",
    stopFormLocation: "Nombre de la ubicación",
    stopFormStartTime: "Hora de inicio",
    stopFormEndTime: "Hora de fin",
    stopFormMapHint: "Hacé click o arrastrá el pin para fijar la ubicación exacta",
    stopFormOverlapWarning: "Esto se solapa con una reserva de evento confirmada",
    stopFormProducts: "Productos en esta parada",
    stopFormMaxStock: "Stock inicial",
    stopFormSubmit: "Crear parada",
    stockTitle: "Stock",
    stockColumnProduct: "Producto",
    stockColumnCurrent: "Actual",
    stockColumnMax: "Máximo",
    stockRestockButton: "Reponer",
    stockWasteButton: "Reportar merma",
    stockWasteReasonPlaceholder: "Motivo (opcional)",
    bookingsTitle: "Reservas de Eventos",
    bookingsFilterStatus: "Estado",
    bookingsColumnClient: "Cliente",
    bookingsColumnEventType: "Tipo",
    bookingsColumnDate: "Fecha",
    bookingsColumnLocation: "Ubicación",
    bookingsColumnStatus: "Estado",
    bookingLocationTbdWarning: "Ubicación todavía sin definir",
    bookingQuoteButton: "Marcar como cotizada",
    bookingConfirmButton: "Confirmar reserva",
    bookingConfirmBlockedTbd: "Definí una ubicación real antes de confirmar",
    bookingCancelButton: "Cancelar reserva",
    bookingCompleteButton: "Marcar completada",
    bookingAddItemTitle: "Items de la cotización",
    bookingItemDescription: "Descripción",
    bookingItemQuantity: "Cantidad",
    bookingItemPrice: "Precio unitario (centavos)",
    bookingAddItemButton: "Agregar item",
    calendarTitle: "Calendario",
    calendarLegendStop: "Parada del trailer",
    calendarLegendBooking: "Evento confirmado",
```

- [ ] **Step 4: Correr el test de paridad y typecheck**

Run: `pnpm --filter @workspace/i18n run test && pnpm run typecheck`
Expected: ambos PASS

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/src/types.ts packages/i18n/src/dictionaries/en.ts packages/i18n/src/dictionaries/es.ts
```

Comando sugerido: `git commit -m "Agrega las claves de trailer stops, stock, event bookings y calendario a los diccionarios de i18n"`

---

### Tarea 9: `LocationPicker` — mapa interactivo para fijar ubicación

**Files:**
- Create: `apps/web/src/components/admin/location-picker.tsx`

**Interfaces:**
- Consumes: `ensureGoogleMapsOptionsSet` de `@/lib/google-maps` (ya existe), `importLibrary` de `@googlemaps/js-api-loader` (ya instalado).
- Produces: `LocationPicker({ lat, lng, onChange, className })` — Client Component. `onChange(lat: number, lng: number)` se llama tanto al hacer click en el mapa como al arrastrar el marker.

Variante editable de `LocationMap` (Fase 2, solo lectura) — mismo patrón de carga del mapa, pero con marker `draggable` y un listener de `click` en el mapa. `onChange` se guarda en un `ref` (no en las deps del efecto de montaje) para no recrear el mapa cada vez que el componente padre re-renderiza.

- [ ] **Step 1: Implementar el componente**

```tsx
// apps/web/src/components/admin/location-picker.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary } from "@googlemaps/js-api-loader";
import { ensureGoogleMapsOptionsSet } from "@/lib/google-maps";

interface LocationPickerProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  className?: string;
}

export function LocationPicker({ lat, lng, onChange, className }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || !ensureGoogleMapsOptionsSet()) return;
    let cancelled = false;

    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(([{ Map }, { Marker }]) => {
        if (cancelled || !containerRef.current) return;

        const map = new Map(containerRef.current, {
          center: { lat, lng },
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
        });

        const marker = new Marker({ position: { lat, lng }, map, draggable: true });

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (pos) onChangeRef.current(pos.lat(), pos.lng());
        });

        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          marker.setPosition(e.latLng);
          onChangeRef.current(e.latLng.lat(), e.latLng.lng());
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
    // Intencionalmente mount-only, mismo patrón que LocationMap (Fase 2): el
    // mapa se crea una sola vez. lat/lng iniciales solo definen el centro y
    // la posición de arranque del marker — los cambios posteriores vienen
    // del propio usuario clickeando/arrastrando, no de props entrantes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || failed) {
    return (
      <div className={className}>
        <div className="w-full h-full flex items-center justify-center text-navy/40 text-sm font-mono uppercase tracking-widest border border-navy/12 rounded-2xl">
          Map unavailable
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/admin/location-picker.tsx
```

Comando sugerido: `git commit -m "Agrega LocationPicker, un mapa interactivo para fijar la ubicacion de una parada"`

---

### Tarea 10: Server Actions de `trailer_stops` — listar, crear, chequear solapamiento, cambiar estado

**Files:**
- Create: `apps/web/src/app/actions/admin-trailer-stops.ts`

**Interfaces:**
- Consumes: `listActiveTrailerStops`, `createTrailerStop`, `completeTrailerStop`, `cancelTrailerStop` de `@workspace/domain/trailer-stops`; `initializeStopStock` de `@workspace/domain/stock`; `EventBookingRepository.findOverlapping` de `@workspace/domain/event-bookings`; `requireAdmin` de `@/lib/require-admin` (Tarea 7).
- Produces: `listTrailerStopsAction(): Promise<TrailerStop[]>`, `checkStopOverlapAction(startTime: string, endTime: string): Promise<{ clientName: string; eventDate: string }[]>`, `createTrailerStopAction(input): Promise<TrailerStop>`, `completeTrailerStopAction(id): Promise<void>`, `cancelTrailerStopAction(id): Promise<void>`.

`listTrailerStopsAction` usa `listActive()` directo (no hay filtros en Fase 5 — YAGNI, se puede agregar si hace falta más adelante) pero para el admin conviene ver *todas* las paradas, no solo las activas; se agrega un método de listado propio en el repo en vez de reusar `listActive`.

- [ ] **Step 1: Agregar `listAll` al puerto y al repo (falta en Tarea 1 — se completa acá porque recién ahora se necesita desde la UI)**

En `packages/domain/src/trailer-stops/ports.ts`, agregar a la interfaz:

```ts
  listAll(): Promise<TrailerStop[]>;
```

En `packages/domain/src/trailer-stops/use-cases.ts`, agregar:

```ts
export function listAllTrailerStops(repo: TrailerStopRepository): Promise<TrailerStop[]> {
  return repo.listAll();
}
```

En `packages/db/src/repositories/trailer-stop-repository.ts`, agregar dentro de la clase:

```ts
  async listAll(): Promise<TrailerStop[]> {
    return db.select().from(trailerStopsTable).orderBy(asc(trailerStopsTable.startTime));
  }
```

Actualizar también el fake de `packages/domain/src/trailer-stops/use-cases.test.ts` agregando `async listAll() { return stops; },` dentro de `fakeRepo`, y agregar un test:

```ts
describe("listAllTrailerStops", () => {
  it("returns every stop regardless of status", async () => {
    const repo = fakeRepo([fakeStop({ id: "stop1", status: "completed" }), fakeStop({ id: "stop2" })]);

    const result = await listAllTrailerStops(repo);
    expect(result.map((s) => s.id)).toEqual(["stop1", "stop2"]);
  });
});
```

Agregar el import de `listAllTrailerStops` al inicio del test junto a los demás.

- [ ] **Step 2: Correr los tests de trailer-stops y confirmar que pasan**

Run: `pnpm --filter @workspace/domain run test -- trailer-stops`
Expected: PASS

- [ ] **Step 3: Implementar las Server Actions**

```ts
// apps/web/src/app/actions/admin-trailer-stops.ts
"use server";

import { listAllTrailerStops, createTrailerStop, completeTrailerStop, cancelTrailerStop } from "@workspace/domain/trailer-stops";
import type { TrailerStop } from "@workspace/domain/trailer-stops";
import { initializeStopStock } from "@workspace/domain/stock";
import { DrizzleTrailerStopRepository, DrizzleStockRepository, DrizzleEventBookingRepository } from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";

export async function listTrailerStopsAction(): Promise<TrailerStop[]> {
  await requireAdmin();
  return listAllTrailerStops(new DrizzleTrailerStopRepository());
}

export async function checkStopOverlapAction(
  startTime: string,
  endTime: string,
): Promise<{ clientName: string; eventDate: string }[]> {
  await requireAdmin();
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const overlapping = await new DrizzleEventBookingRepository().findOverlapping(start, start, end);
  return overlapping.map((b) => ({ clientName: b.clientName, eventDate: b.eventDate.toISOString() }));
}

export interface CreateTrailerStopInput {
  location: string;
  lat: number;
  lng: number;
  startTime: string;
  endTime: string;
  products: { productId: string; maxStock: number }[];
}

export async function createTrailerStopAction(input: CreateTrailerStopInput): Promise<TrailerStop> {
  await requireAdmin();
  const stop = await createTrailerStop(new DrizzleTrailerStopRepository(), {
    location: input.location,
    lat: input.lat,
    lng: input.lng,
    startTime: new Date(input.startTime),
    endTime: new Date(input.endTime),
  });

  if (input.products.length > 0) {
    await initializeStopStock(new DrizzleStockRepository(), stop.id, input.products);
  }

  return stop;
}

export async function completeTrailerStopAction(id: string): Promise<void> {
  await requireAdmin();
  await completeTrailerStop(new DrizzleTrailerStopRepository(), id);
}

export async function cancelTrailerStopAction(id: string): Promise<void> {
  await requireAdmin();
  await cancelTrailerStop(new DrizzleTrailerStopRepository(), id);
}
```

`checkStopOverlapAction` llama `findOverlapping(start, start, end)` — el primer argumento (`eventDate`) no se usa en la implementación real de Drizzle (ver Tarea 6, filtra solo por `status`/`startTime`/`endTime`), así que pasar `start` ahí es inofensivo y respeta la firma del puerto tal cual está definida desde Fase 1.

- [ ] **Step 4: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/trailer-stops packages/db/src/repositories/trailer-stop-repository.ts apps/web/src/app/actions/admin-trailer-stops.ts
```

Comando sugerido: `git commit -m "Agrega las Server Actions de trailer stops: listar, crear, chequear solapamiento y cambiar estado"`

---

### Tarea 11: Página de listado `/admin/trailer-stops`

**Files:**
- Create: `apps/web/src/app/[locale]/admin/trailer-stops/page.tsx`

**Interfaces:**
- Consumes: `listTrailerStopsAction`, `completeTrailerStopAction`, `cancelTrailerStopAction` de `@/app/actions/admin-trailer-stops` (Tarea 10).

- [ ] **Step 1: Implementar el componente cliente de acciones por fila**

```tsx
// apps/web/src/components/admin/trailer-stop-row-actions.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { completeTrailerStopAction, cancelTrailerStopAction } from "@/app/actions/admin-trailer-stops";

export function TrailerStopRowActions({ stopId, status }: { stopId: string; status: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handle(action: (id: string) => Promise<void>) {
    setIsPending(true);
    try {
      await action(stopId);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  if (status === "completed" || status === "cancelled") return null;

  return (
    <div className="flex gap-2">
      <button
        disabled={isPending}
        onClick={() => handle(completeTrailerStopAction)}
        className="text-[12px] text-navy/60 hover:text-sin-red disabled:opacity-50"
      >
        {t("stopsCompleteButton")}
      </button>
      <button
        disabled={isPending}
        onClick={() => handle(cancelTrailerStopAction)}
        className="text-[12px] text-navy/60 hover:text-sin-red disabled:opacity-50"
      >
        {t("stopsCancelButton")}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Implementar la página**

```tsx
// apps/web/src/app/[locale]/admin/trailer-stops/page.tsx
import type { Locale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listTrailerStopsAction } from "@/app/actions/admin-trailer-stops";
import { TrailerStopRowActions } from "@/components/admin/trailer-stop-row-actions";

export default async function AdminTrailerStopsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const stops = await listTrailerStopsAction();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif font-bold text-navy text-2xl">{t("stopsTitle")}</h1>
        <Link href="/admin/trailer-stops/new" className="bg-sin-red text-white rounded-lg px-4 py-2 text-sm">
          {t("stopsCreateButton")}
        </Link>
      </div>

      <table className="w-full text-sm bg-white rounded-xl overflow-hidden">
        <thead className="bg-navy/5 text-left">
          <tr>
            <th className="px-4 py-3">{t("stopsColumnLocation")}</th>
            <th className="px-4 py-3">{t("stopsColumnDate")}</th>
            <th className="px-4 py-3">{t("stopsColumnStatus")}</th>
            <th className="px-4 py-3"></th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {stops.map((stop) => (
            <tr key={stop.id} className="border-t border-navy/5">
              <td className="px-4 py-3">{stop.location}</td>
              <td className="px-4 py-3">{stop.startTime.toLocaleDateString()}</td>
              <td className="px-4 py-3">{stop.status}</td>
              <td className="px-4 py-3">
                <Link href={`/admin/trailer-stops/${stop.id}`} className="text-sin-red hover:underline">
                  View
                </Link>
              </td>
              <td className="px-4 py-3">
                <TrailerStopRowActions stopId={stop.id} status={stop.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/[locale]/admin/trailer-stops/page.tsx" apps/web/src/components/admin/trailer-stop-row-actions.tsx
```

Comando sugerido: `git commit -m "Agrega la pagina de listado de paradas del trailer"`

---

### Tarea 12: Formulario de creación de parada — mapa, productos y advertencia de solapamiento en vivo

**Files:**
- Create: `apps/web/src/app/[locale]/admin/trailer-stops/new/page.tsx`
- Create: `apps/web/src/components/admin/trailer-stop-form.tsx`

**Interfaces:**
- Consumes: `createTrailerStopAction`, `checkStopOverlapAction` de `@/app/actions/admin-trailer-stops` (Tarea 10), `LocationPicker` de `@/components/admin/location-picker` (Tarea 9), `listAvailableProducts` de `@workspace/domain/products` (ya existe desde Fase 1).

El chequeo de solapamiento corre en un `useEffect` con debounce de 500ms disparado por cambios en `startTime`/`endTime` — no bloquea el submit, solo muestra un aviso.

- [ ] **Step 1: Implementar el formulario (Client Component)**

```tsx
// apps/web/src/components/admin/trailer-stop-form.tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createTrailerStopAction, checkStopOverlapAction } from "@/app/actions/admin-trailer-stops";
import { LocationPicker } from "@/components/admin/location-picker";

interface ProductOption {
  id: string;
  nameEn: string;
}

const DEFAULT_LAT = -34.9285;
const DEFAULT_LNG = 138.6007;

export function TrailerStopForm({ products }: { products: ProductOption[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState(DEFAULT_LAT);
  const [lng, setLng] = useState(DEFAULT_LNG);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});
  const [overlaps, setOverlaps] = useState<{ clientName: string; eventDate: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!startTime || !endTime) {
      setOverlaps([]);
      return;
    }
    const handle = setTimeout(async () => {
      const result = await checkStopOverlapAction(startTime, endTime);
      setOverlaps(result);
    }, 500);
    return () => clearTimeout(handle);
  }, [startTime, endTime]);

  function toggleProduct(productId: string, checked: boolean) {
    setSelectedProducts((prev) => {
      const next = { ...prev };
      if (checked) next[productId] = next[productId] ?? 10;
      else delete next[productId];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createTrailerStopAction({
        location,
        lat,
        lng,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        products: Object.entries(selectedProducts).map(([productId, maxStock]) => ({ productId, maxStock })),
      });
      router.push("/admin/trailer-stops");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder={t("stopFormLocation")}
        required
        className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm"
      />

      <div>
        <p className="text-[12px] text-navy/50 mb-2">{t("stopFormMapHint")}</p>
        <LocationPicker lat={lat} lng={lng} onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng); }} className="w-full h-64 rounded-xl overflow-hidden" />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("stopFormStartTime")}</label>
          <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("stopFormEndTime")}</label>
          <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {overlaps.length > 0 && (
        <div className="bg-sin-red/10 border border-sin-red/30 rounded-lg p-3 text-[13px] text-sin-red">
          {t("stopFormOverlapWarning")}: {overlaps.map((o) => o.clientName).join(", ")}
        </div>
      )}

      <div>
        <p className="text-[11px] uppercase text-navy/40 mb-2">{t("stopFormProducts")}</p>
        <div className="space-y-2">
          {products.map((product) => (
            <div key={product.id} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={product.id in selectedProducts}
                onChange={(e) => toggleProduct(product.id, e.target.checked)}
              />
              <span className="text-sm flex-1">{product.nameEn}</span>
              {product.id in selectedProducts && (
                <input
                  type="number"
                  min={1}
                  value={selectedProducts[product.id]}
                  onChange={(e) =>
                    setSelectedProducts((prev) => ({ ...prev, [product.id]: Number(e.target.value) }))
                  }
                  placeholder={t("stopFormMaxStock")}
                  className="w-24 border border-navy/15 rounded-lg px-2 py-1 text-sm"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <button type="submit" disabled={isSubmitting} className="bg-sin-red text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">
        {t("stopFormSubmit")}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Implementar la página**

```tsx
// apps/web/src/app/[locale]/admin/trailer-stops/new/page.tsx
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listAvailableProducts } from "@workspace/domain/products";
import { DrizzleProductRepository } from "@workspace/db/repositories";
import { TrailerStopForm } from "@/components/admin/trailer-stop-form";

export default async function NewTrailerStopPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const products = await listAvailableProducts(new DrizzleProductRepository());

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{t("stopsCreateButton")}</h1>
      <TrailerStopForm products={products.map((p) => ({ id: p.id, nameEn: p.nameEn }))} />
    </div>
  );
}
```

- [ ] **Step 3: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/[locale]/admin/trailer-stops/new" apps/web/src/components/admin/trailer-stop-form.tsx
```

Comando sugerido: `git commit -m "Agrega el formulario de creacion de parada con mapa interactivo y aviso de solapamiento"`

---

### Tarea 13: Página de detalle de parada — stock, reposición y merma

**Files:**
- Create: `apps/web/src/app/[locale]/admin/trailer-stops/[id]/page.tsx`
- Create: `apps/web/src/components/admin/stock-row.tsx`
- Modify: `apps/web/src/app/actions/admin-trailer-stops.ts`

**Interfaces:**
- Consumes: `restockProduct`, `reportStockWaste` de `@workspace/domain/stock` (Tarea 3).
- Produces: `restockAction(stopId, productId, quantity): Promise<void>`, `reportWasteAction(stopId, productId, quantity, reason): Promise<void>` (agregados a `admin-trailer-stops.ts`).

- [ ] **Step 1: Agregar las Server Actions de stock**

Agregar al final de `apps/web/src/app/actions/admin-trailer-stops.ts`:

```ts
import { restockProduct, reportStockWaste } from "@workspace/domain/stock";

export async function restockAction(stopId: string, productId: string, quantity: number): Promise<void> {
  await requireAdmin();
  await restockProduct(new DrizzleStockRepository(), stopId, productId, quantity, null);
}

export async function reportWasteAction(
  stopId: string,
  productId: string,
  quantity: number,
  reason: string | null,
): Promise<void> {
  await requireAdmin();
  await reportStockWaste(new DrizzleStockRepository(), stopId, productId, quantity, reason, null);
}
```

- [ ] **Step 2: Implementar el componente de fila de stock (Client Component)**

```tsx
// apps/web/src/components/admin/stock-row.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { restockAction, reportWasteAction } from "@/app/actions/admin-trailer-stops";

export function StockRow({
  stopId,
  productId,
  productName,
  currentStock,
  maxStock,
}: {
  stopId: string;
  productId: string;
  productName: string;
  currentStock: number;
  maxStock: number;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleRestock() {
    setIsPending(true);
    try {
      await restockAction(stopId, productId, quantity);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleWaste() {
    setIsPending(true);
    try {
      await reportWasteAction(stopId, productId, quantity, reason || null);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <tr className="border-t border-navy/5">
      <td className="px-4 py-3">{productName}</td>
      <td className="px-4 py-3">{currentStock}</td>
      <td className="px-4 py-3">{maxStock}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-16 border border-navy/15 rounded-lg px-2 py-1 text-sm"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("stockWasteReasonPlaceholder")}
            className="w-32 border border-navy/15 rounded-lg px-2 py-1 text-sm"
          />
          <button disabled={isPending} onClick={handleRestock} className="text-[12px] text-navy/60 hover:text-sin-red disabled:opacity-50">
            {t("stockRestockButton")}
          </button>
          <button disabled={isPending} onClick={handleWaste} className="text-[12px] text-navy/60 hover:text-sin-red disabled:opacity-50">
            {t("stockWasteButton")}
          </button>
        </div>
      </td>
    </tr>
  );
}
```

- [ ] **Step 3: Implementar la página de detalle**

```tsx
// apps/web/src/app/[locale]/admin/trailer-stops/[id]/page.tsx
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { DrizzleTrailerStopRepository, DrizzleStockRepository, DrizzleProductRepository } from "@workspace/db/repositories";
import { StockRow } from "@/components/admin/stock-row";

export default async function TrailerStopDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const stop = await new DrizzleTrailerStopRepository().findById(id);
  if (!stop) notFound();

  const stock = await new DrizzleStockRepository().listByStop(id);
  const productRepo = new DrizzleProductRepository();
  const stockWithNames = await Promise.all(
    stock.map(async (s) => {
      const product = await productRepo.findById(s.productId);
      return { ...s, productName: product?.nameEn ?? s.productId };
    }),
  );

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-2">{stop.location}</h1>
      <p className="text-[13px] text-navy/50 mb-6">
        {stop.startTime.toLocaleString()} — {stop.endTime.toLocaleString()} · {stop.status}
      </p>

      <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-2">{t("stockTitle")}</h2>
      <table className="w-full text-sm bg-white rounded-xl overflow-hidden">
        <thead className="bg-navy/5 text-left">
          <tr>
            <th className="px-4 py-3">{t("stockColumnProduct")}</th>
            <th className="px-4 py-3">{t("stockColumnCurrent")}</th>
            <th className="px-4 py-3">{t("stockColumnMax")}</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {stockWithNames.map((s) => (
            <StockRow
              key={s.id}
              stopId={stop.id}
              productId={s.productId}
              productName={s.productName}
              currentStock={s.currentStock}
              maxStock={s.maxStock}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/[locale]/admin/trailer-stops/[id]" apps/web/src/components/admin/stock-row.tsx apps/web/src/app/actions/admin-trailer-stops.ts
```

Comando sugerido: `git commit -m "Agrega el detalle de parada con gestion de stock, reposicion y merma"`

---

### Tarea 14: Server Actions de `event_bookings` — listar, cambiar estado, agregar items

**Files:**
- Create: `apps/web/src/app/actions/admin-event-bookings.ts`

**Interfaces:**
- Consumes: `quoteEventBooking`, `confirmEventBooking`, `cancelEventBooking`, `completeEventBooking`, `addEventBookingItem`, `updateEventBookingDetails` de `@workspace/domain/event-bookings` (Tarea 5); `requireAdmin` de `@/lib/require-admin` (Tarea 7).
- Produces: `listEventBookingsAction(status?): Promise<EventBooking[]>`, `quoteEventBookingAction(id): Promise<void>`, `confirmEventBookingAction(id): Promise<{ error: string } | { ok: true }>`, `cancelEventBookingAction(id): Promise<void>`, `completeEventBookingAction(id): Promise<void>`, `addEventBookingItemAction(id, item): Promise<void>`, `updateEventBookingDetailsAction(id, fields: UpdateEventBookingDetailsInput): Promise<void>`.

`confirmEventBookingAction` atrapa el error de dominio ("Cannot confirm a booking with location still TBD") y lo convierte en un resultado tipado — el mismo patrón que `signInAction` de Fase 4 usó para `AuthError`, para no dejar que un `throw` de dominio llegue crudo al cliente.

- [ ] **Step 1: Implementar las Server Actions**

```ts
// apps/web/src/app/actions/admin-event-bookings.ts
"use server";

import {
  quoteEventBooking,
  confirmEventBooking,
  cancelEventBooking,
  completeEventBooking,
  addEventBookingItem,
  updateEventBookingDetails,
} from "@workspace/domain/event-bookings";
import type { EventBooking, EventBookingStatus } from "@workspace/domain/event-bookings";
import { DrizzleEventBookingRepository } from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";

export async function listEventBookingsAction(status?: EventBookingStatus): Promise<EventBooking[]> {
  await requireAdmin();
  return new DrizzleEventBookingRepository().listAll(status ? { status } : undefined);
}

export async function quoteEventBookingAction(id: string): Promise<void> {
  await requireAdmin();
  await quoteEventBooking(new DrizzleEventBookingRepository(), id);
}

export async function confirmEventBookingAction(id: string): Promise<{ error: string } | { ok: true }> {
  await requireAdmin();
  try {
    await confirmEventBooking(new DrizzleEventBookingRepository(), id);
    return { ok: true };
  } catch {
    return { error: "location_tbd" };
  }
}

export async function cancelEventBookingAction(id: string): Promise<void> {
  await requireAdmin();
  await cancelEventBooking(new DrizzleEventBookingRepository(), id);
}

export async function completeEventBookingAction(id: string): Promise<void> {
  await requireAdmin();
  await completeEventBooking(new DrizzleEventBookingRepository(), id);
}

export async function addEventBookingItemAction(
  id: string,
  item: { description: string; quantity: number; agreedUnitPriceCents: number },
): Promise<void> {
  await requireAdmin();
  await addEventBookingItem(new DrizzleEventBookingRepository(), id, item);
}

export interface UpdateEventBookingDetailsInput {
  location?: string;
  startTime?: string;
  endTime?: string;
  estimatedGuests?: number;
  notes?: string | null;
}

export async function updateEventBookingDetailsAction(id: string, fields: UpdateEventBookingDetailsInput): Promise<void> {
  await requireAdmin();
  await updateEventBookingDetails(new DrizzleEventBookingRepository(), id, {
    ...fields,
    startTime: fields.startTime ? new Date(fields.startTime) : undefined,
    endTime: fields.endTime ? new Date(fields.endTime) : undefined,
  });
}
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/actions/admin-event-bookings.ts
```

Comando sugerido: `git commit -m "Agrega las Server Actions de event bookings: listar, cambiar estado y agregar items"`

---

### Tarea 15: Página de listado `/admin/event-bookings` con filtro por status

**Files:**
- Create: `apps/web/src/app/[locale]/admin/event-bookings/page.tsx`

**Interfaces:**
- Consumes: `listEventBookingsAction` de `@/app/actions/admin-event-bookings` (Tarea 14).

Filtro vía `<form method="get">`, mismo patrón que `/admin/orders` (Fase 4). Las filas con `location === "TBD"` se resaltan visualmente — es la pieza que el roadmap pide explícitamente ("el panel admin debe resaltar visualmente las cotizaciones con `location = "TBD"`").

- [ ] **Step 1: Implementar la página**

```tsx
// apps/web/src/app/[locale]/admin/event-bookings/page.tsx
import type { Locale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listEventBookingsAction } from "@/app/actions/admin-event-bookings";
import type { EventBookingStatus } from "@workspace/domain/event-bookings";

type SearchParams = Record<string, string | undefined>;

export default async function AdminEventBookingsPage({
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const t = await getTranslations("admin");

  const bookings = await listEventBookingsAction(sp.status as EventBookingStatus | undefined);

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{t("bookingsTitle")}</h1>

      <form method="get" className="flex flex-wrap gap-3 mb-6">
        <select name="status" defaultValue={sp.status ?? ""} className="border border-navy/15 rounded-lg px-3 py-2 text-sm">
          <option value="">{t("filterAll")}</option>
          {["quote_requested", "quoted", "confirmed", "completed", "cancelled"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="submit" className="bg-navy text-white rounded-lg px-4 py-2 text-sm">{t("applyFilters")}</button>
      </form>

      <table className="w-full text-sm bg-white rounded-xl overflow-hidden">
        <thead className="bg-navy/5 text-left">
          <tr>
            <th className="px-4 py-3">{t("bookingsColumnClient")}</th>
            <th className="px-4 py-3">{t("bookingsColumnEventType")}</th>
            <th className="px-4 py-3">{t("bookingsColumnDate")}</th>
            <th className="px-4 py-3">{t("bookingsColumnLocation")}</th>
            <th className="px-4 py-3">{t("bookingsColumnStatus")}</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id} className={`border-t border-navy/5 ${booking.location === "TBD" ? "bg-sin-red/5" : ""}`}>
              <td className="px-4 py-3">{booking.clientName}</td>
              <td className="px-4 py-3">{booking.eventType}</td>
              <td className="px-4 py-3">{booking.eventDate.toLocaleDateString()}</td>
              <td className="px-4 py-3">
                {booking.location === "TBD" ? (
                  <span className="text-sin-red font-bold">{t("bookingLocationTbdWarning")}</span>
                ) : (
                  booking.location
                )}
              </td>
              <td className="px-4 py-3">{booking.status}</td>
              <td className="px-4 py-3">
                <Link href={`/admin/event-bookings/${booking.id}`} className="text-sin-red hover:underline">
                  {t("viewDetail")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/[locale]/admin/event-bookings/page.tsx"
```

Comando sugerido: `git commit -m "Agrega la tabla de event bookings con filtro por status y resaltado de location TBD"`

---

### Tarea 16: Página de detalle de reserva — cambio de estado e items

**Files:**
- Create: `apps/web/src/app/[locale]/admin/event-bookings/[id]/page.tsx`
- Create: `apps/web/src/components/admin/event-booking-actions.tsx`
- Create: `apps/web/src/components/admin/event-booking-item-form.tsx`
- Create: `apps/web/src/components/admin/event-booking-details-form.tsx`

**Interfaces:**
- Consumes: `quoteEventBookingAction`, `confirmEventBookingAction`, `cancelEventBookingAction`, `completeEventBookingAction`, `addEventBookingItemAction`, `updateEventBookingDetailsAction` de `@/app/actions/admin-event-bookings` (Tarea 14).

El botón "Confirm booking" queda deshabilitado (con tooltip/mensaje) mientras `location === "TBD"` — refuerzo visual de la regla de negocio que ya bloquea `confirmEventBookingAction` del lado del servidor. `EventBookingDetailsForm` es lo que le permite al admin reemplazar `location`/horario/`estimatedGuests` (el placeholder "TBD"/"día completo" que deja el formulario público de Fase 2) por datos reales antes de poder confirmar — sin este formulario, ninguna reserva podría salir nunca del estado "TBD".

- [ ] **Step 1: Implementar los botones de cambio de estado (Client Component)**

```tsx
// apps/web/src/components/admin/event-booking-actions.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  quoteEventBookingAction,
  confirmEventBookingAction,
  cancelEventBookingAction,
  completeEventBookingAction,
} from "@/app/actions/admin-event-bookings";

export function EventBookingActions({ bookingId, location }: { bookingId: string; location: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [confirmError, setConfirmError] = useState(false);
  const locationIsTbd = location === "TBD";

  async function run(fn: () => Promise<void>) {
    setIsPending(true);
    try {
      await fn();
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleConfirm() {
    setIsPending(true);
    setConfirmError(false);
    try {
      const result = await confirmEventBookingAction(bookingId);
      if ("error" in result) {
        setConfirmError(true);
        return;
      }
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <button disabled={isPending} onClick={() => run(() => quoteEventBookingAction(bookingId))} className="bg-navy text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">
          {t("bookingQuoteButton")}
        </button>
        <button
          disabled={isPending || locationIsTbd}
          onClick={handleConfirm}
          title={locationIsTbd ? t("bookingConfirmBlockedTbd") : undefined}
          className="bg-sin-red text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          {t("bookingConfirmButton")}
        </button>
        <button disabled={isPending} onClick={() => run(() => cancelEventBookingAction(bookingId))} className="text-[13px] text-navy/60 hover:text-sin-red disabled:opacity-50">
          {t("bookingCancelButton")}
        </button>
        <button disabled={isPending} onClick={() => run(() => completeEventBookingAction(bookingId))} className="text-[13px] text-navy/60 hover:text-sin-red disabled:opacity-50">
          {t("bookingCompleteButton")}
        </button>
      </div>
      {(confirmError || locationIsTbd) && (
        <p className="text-[12px] text-sin-red">{t("bookingConfirmBlockedTbd")}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implementar el formulario de agregar item (Client Component)**

```tsx
// apps/web/src/components/admin/event-booking-item-form.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { addEventBookingItemAction } from "@/app/actions/admin-event-bookings";

export function EventBookingItemForm({ bookingId }: { bookingId: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [priceCents, setPriceCents] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addEventBookingItemAction(bookingId, { description, quantity, agreedUnitPriceCents: priceCents });
      setDescription("");
      setQuantity(1);
      setPriceCents(0);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <div className="flex-1">
        <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("bookingItemDescription")}</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} required className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("bookingItemQuantity")}</label>
        <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-20 border border-navy/15 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-[11px] uppercase text-navy/40 mb-1">{t("bookingItemPrice")}</label>
        <input type="number" min={0} value={priceCents} onChange={(e) => setPriceCents(Number(e.target.value))} className="w-28 border border-navy/15 rounded-lg px-3 py-2 text-sm" />
      </div>
      <button type="submit" disabled={isSubmitting} className="bg-sin-red text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">
        {t("bookingAddItemButton")}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Implementar el formulario de edición de detalles (Client Component)**

```tsx
// apps/web/src/components/admin/event-booking-details-form.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { updateEventBookingDetailsAction } from "@/app/actions/admin-event-bookings";

function toDatetimeLocal(date: Date): string {
  return date.toISOString().slice(0, 16);
}

export function EventBookingDetailsForm({
  bookingId,
  location,
  startTime,
  endTime,
  estimatedGuests,
}: {
  bookingId: string;
  location: string;
  startTime: Date;
  endTime: Date;
  estimatedGuests: number;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [formLocation, setFormLocation] = useState(location === "TBD" ? "" : location);
  const [formStart, setFormStart] = useState(toDatetimeLocal(startTime));
  const [formEnd, setFormEnd] = useState(toDatetimeLocal(endTime));
  const [guests, setGuests] = useState(estimatedGuests);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateEventBookingDetailsAction(bookingId, {
        location: formLocation,
        startTime: new Date(formStart).toISOString(),
        endTime: new Date(formEnd).toISOString(),
        estimatedGuests: guests,
      });
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        value={formLocation}
        onChange={(e) => setFormLocation(e.target.value)}
        placeholder={t("stopFormLocation")}
        required
        className="w-full border border-navy/15 rounded-lg px-3 py-2 text-sm"
      />
      <div className="flex gap-3">
        <input type="datetime-local" value={formStart} onChange={(e) => setFormStart(e.target.value)} className="flex-1 border border-navy/15 rounded-lg px-3 py-2 text-sm" />
        <input type="datetime-local" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} className="flex-1 border border-navy/15 rounded-lg px-3 py-2 text-sm" />
      </div>
      <input type="number" min={1} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="w-32 border border-navy/15 rounded-lg px-3 py-2 text-sm" />
      <button type="submit" disabled={isSubmitting} className="bg-navy text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">
        {t("saveStatus")}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Implementar la página de detalle**

```tsx
// apps/web/src/app/[locale]/admin/event-bookings/[id]/page.tsx
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { DrizzleEventBookingRepository } from "@workspace/db/repositories";
import { EventBookingActions } from "@/components/admin/event-booking-actions";
import { EventBookingItemForm } from "@/components/admin/event-booking-item-form";
import { EventBookingDetailsForm } from "@/components/admin/event-booking-details-form";

export default async function EventBookingDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const booking = await new DrizzleEventBookingRepository().findById(id);
  if (!booking) notFound();

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{booking.clientName}</h1>

      <div className="bg-white rounded-xl p-5 mb-6">
        <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-2">{t("bookingsColumnClient")}</h2>
        <p className="text-sm">{booking.clientName} — {booking.clientEmail} — {booking.clientPhone}</p>
        <p className="text-sm mt-1">
          {t("bookingsColumnLocation")}: {booking.location === "TBD" ? (
            <span className="text-sin-red font-bold">{t("bookingLocationTbdWarning")}</span>
          ) : booking.location}
        </p>
      </div>

      <div className="bg-white rounded-xl p-5 mb-6">
        <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-3">{t("stopFormLocation")} / {t("bookingsColumnDate")}</h2>
        <EventBookingDetailsForm
          bookingId={booking.id}
          location={booking.location}
          startTime={booking.startTime}
          endTime={booking.endTime}
          estimatedGuests={booking.estimatedGuests}
        />
      </div>

      <div className="bg-white rounded-xl p-5 mb-6">
        <h2 className="font-mono text-[11px] uppercase text-navy/40 mb-3">{t("bookingAddItemTitle")}</h2>
        <ul className="text-sm space-y-1 mb-4">
          {booking.items.map((item, i) => (
            <li key={i}>{item.quantity}x {item.description} — ${(item.agreedUnitPriceCents / 100).toFixed(2)} c/u</li>
          ))}
        </ul>
        <EventBookingItemForm bookingId={booking.id} />
      </div>

      <div className="bg-white rounded-xl p-5">
        <EventBookingActions bookingId={booking.id} location={booking.location} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/[locale]/admin/event-bookings/[id]" apps/web/src/components/admin/event-booking-actions.tsx apps/web/src/components/admin/event-booking-item-form.tsx apps/web/src/components/admin/event-booking-details-form.tsx
```

Comando sugerido: `git commit -m "Agrega el detalle de event booking con edicion de datos, cambio de estado e items"`

---

### Tarea 17: Instalar `react-big-calendar` y `date-fns`

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Instalar los paquetes**

Run: `pnpm --filter @workspace/web add react-big-calendar date-fns`
Expected: ambos agregados a `dependencies` de `apps/web/package.json`. `react-big-calendar` no publica sus propios tipos en versiones recientes — si `tsc` se queja de tipos faltantes, instalar también `pnpm --filter @workspace/web add -D @types/react-big-calendar`.

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores (si falla por tipos faltantes de `react-big-calendar`, aplicar el fallback del Step 1 antes de continuar)

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
```

Comando sugerido: `git commit -m "Instala react-big-calendar y date-fns para la vista de calendario del admin"`

---

### Tarea 18: Server Action que combina paradas y reservas confirmadas en eventos de calendario

**Files:**
- Create: `apps/web/src/app/actions/admin-calendar.ts`

**Interfaces:**
- Consumes: `listAllTrailerStops` de `@workspace/domain/trailer-stops` (Tarea 10), `listAll` de `EventBookingRepository` (Tarea 5).
- Produces: `CalendarEvent { id: string; title: string; start: string; end: string; type: "stop" | "booking" }`, `listCalendarEventsAction(): Promise<CalendarEvent[]>`.

Fechas viajan como ISO strings (no `Date`) porque cruzan el límite de una Server Action — `react-big-calendar` en el cliente las reconstruye con `new Date(...)`.

- [ ] **Step 1: Implementar la Server Action**

```ts
// apps/web/src/app/actions/admin-calendar.ts
"use server";

import { listAllTrailerStops } from "@workspace/domain/trailer-stops";
import { DrizzleTrailerStopRepository, DrizzleEventBookingRepository } from "@workspace/db/repositories";
import { requireAdmin } from "@/lib/require-admin";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: "stop" | "booking";
}

export async function listCalendarEventsAction(): Promise<CalendarEvent[]> {
  await requireAdmin();

  const stops = await listAllTrailerStops(new DrizzleTrailerStopRepository());
  const bookings = await new DrizzleEventBookingRepository().listAll({ status: "confirmed" });

  const stopEvents: CalendarEvent[] = stops
    .filter((s) => s.status !== "cancelled")
    .map((s) => ({
      id: s.id,
      title: s.location,
      start: s.startTime.toISOString(),
      end: s.endTime.toISOString(),
      type: "stop",
    }));

  const bookingEvents: CalendarEvent[] = bookings.map((b) => ({
    id: b.id,
    title: b.clientName,
    start: b.startTime.toISOString(),
    end: b.endTime.toISOString(),
    type: "booking",
  }));

  return [...stopEvents, ...bookingEvents];
}
```

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/actions/admin-calendar.ts
```

Comando sugerido: `git commit -m "Agrega la Server Action que combina paradas y reservas confirmadas para el calendario"`

---

### Tarea 19: Página `/admin/calendar` con `react-big-calendar`

**Files:**
- Create: `apps/web/src/app/[locale]/admin/calendar/page.tsx`
- Create: `apps/web/src/components/admin/admin-calendar-view.tsx`

**Interfaces:**
- Consumes: `listCalendarEventsAction`, `CalendarEvent` de `@/app/actions/admin-calendar` (Tarea 18).

`react-big-calendar` necesita su hoja de estilos importada una sola vez — se importa dentro del Client Component, no en `globals.css`, para no cargarla en el sitio público.

- [ ] **Step 1: Implementar el componente de calendario (Client Component)**

```tsx
// apps/web/src/components/admin/admin-calendar-view.tsx
"use client";

import { useMemo } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import enUS from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useTranslations } from "next-intl";
import type { CalendarEvent } from "@/app/actions/admin-calendar";

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: enUS }),
  getDay,
  locales,
});

export function AdminCalendarView({ events }: { events: CalendarEvent[] }) {
  const t = useTranslations("admin");

  const calendarEvents = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: new Date(e.start),
        end: new Date(e.end),
        resource: e.type,
      })),
    [events],
  );

  return (
    <div>
      <div className="flex gap-4 mb-4 text-[12px] text-navy/60">
        <span><span className="inline-block w-3 h-3 rounded-full bg-sin-red mr-1" /> {t("calendarLegendStop")}</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-navy mr-1" /> {t("calendarLegendBooking")}</span>
      </div>
      <div style={{ height: 700 }} className="bg-white rounded-xl p-4">
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          eventPropGetter={(event) => ({
            style: { backgroundColor: event.resource === "stop" ? "#E63946" : "#0F1B3D" },
          })}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implementar la página**

```tsx
// apps/web/src/app/[locale]/admin/calendar/page.tsx
import type { Locale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { listCalendarEventsAction } from "@/app/actions/admin-calendar";
import { AdminCalendarView } from "@/components/admin/admin-calendar-view";

export default async function AdminCalendarPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const events = await listCalendarEventsAction();

  return (
    <div>
      <h1 className="font-serif font-bold text-navy text-2xl mb-6">{t("calendarTitle")}</h1>
      <AdminCalendarView events={events} />
    </div>
  );
}
```

- [ ] **Step 3: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores. Si `date-fns/format` (import de subruta) da error de tipos con la versión instalada, usar `import { format, parse, startOfWeek, getDay } from "date-fns";` y `import { enUS } from "date-fns/locale";` en su lugar (ambas formas son válidas según la versión mayor de `date-fns` que instale pnpm — confirmar cuál compila con la versión real resuelta en el Step 1 de la Tarea 17).

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/[locale]/admin/calendar" apps/web/src/components/admin/admin-calendar-view.tsx
```

Comando sugerido: `git commit -m "Agrega la vista visual de calendario combinando paradas y reservas confirmadas"`

---

### Tarea 20: Nav del panel admin

**Files:**
- Modify: `apps/web/src/app/[locale]/admin/layout.tsx`

**Interfaces:**
- Consumes: `Link` de `@/i18n/navigation`, `getTranslations` de `next-intl/server`.

Con 4 secciones (`Orders`, `Trailer Stops`, `Event Bookings`, `Calendar`) hace falta navegación cruzada — hasta ahora el layout solo tenía título fijo y logout.

- [ ] **Step 1: Agregar la nav**

En `apps/web/src/app/[locale]/admin/layout.tsx`, agregar el import:

```ts
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
```

Reemplazar el `<header>` completo:

```tsx
  const t = await getTranslations("admin");

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between px-6 py-4 border-b border-navy/10 bg-white">
        <div className="flex items-center gap-6">
          <span className="font-serif font-bold text-navy">Sweet Sin Admin</span>
          <nav className="flex gap-4 text-[13px] text-navy/60">
            <Link href="/admin/orders" className="hover:text-sin-red">{t("navOrders")}</Link>
            <Link href="/admin/trailer-stops" className="hover:text-sin-red">{t("navTrailerStops")}</Link>
            <Link href="/admin/event-bookings" className="hover:text-sin-red">{t("navEventBookings")}</Link>
            <Link href="/admin/calendar" className="hover:text-sin-red">{t("navCalendar")}</Link>
          </nav>
        </div>
        <form action={async () => { "use server"; await signOutAction(); redirect({ href: "/login", locale }); }}>
          <button type="submit" className="text-[13px] text-navy/50 hover:text-sin-red transition-colors">
            Sign out
          </button>
        </form>
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
```

`t` debe declararse después de la validación de sesión existente (`const session = await auth(); if (...) { redirect(...); }`) y antes del `return`.

- [ ] **Step 2: Verificar que tipa limpio**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/[locale]/admin/layout.tsx"
```

Comando sugerido: `git commit -m "Agrega navegacion entre las secciones del panel admin"`

---

### Tarea 21: Verificación manual bloqueante — CRUD de parada + solapamiento + stock

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Crear una parada real**

Con el dev server corriendo: loguearse como admin, ir a `/admin/trailer-stops/new`, crear una parada real con el mapa (mover el pin), elegir 2-3 productos con stock inicial, guardar. Confirmar que aparece en `/admin/trailer-stops` con status `scheduled`.

- [ ] **Step 2: Verificar la advertencia de solapamiento**

Crear (o usar una existente) una `event_booking` con `status: "confirmed"` y un rango horario conocido (vía query directa a la DB si hace falta, ya que no hay UI todavía para forzar ese estado en un dato de prueba sin pasar por el flujo completo). Volver a `/admin/trailer-stops/new` y completar fecha/hora que se solape con esa reserva — confirmar que aparece el aviso en menos de 1 segundo tras dejar de tipear, sin bloquear el submit.

- [ ] **Step 3: Verificar stock**

Entrar al detalle de la parada creada en el Step 1, reponer stock de un producto, reportar merma de otro con un motivo, confirmar que `currentStock` cambia y persiste tras recargar.

- [ ] **Step 4: Limpiar los datos de prueba**

Borrar la parada de prueba (`trailer_stops` + sus `stop_product_stock`/`stock_events` asociados) y cualquier `event_booking` de prueba creada para el Step 2, directo por query a la DB.

Si algo de esto falla, **detenerse y arreglarlo antes de avanzar a la Tarea 22.**

---

### Tarea 22: Verificación manual bloqueante — event bookings y calendario

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Ciclo completo de una reserva**

Crear una cotización real vía el formulario público (`/events`, Fase 2) con un email identificable. Confirmar que aparece en `/admin/event-bookings` con `status: quote_requested` y la fila resaltada por `location = "TBD"`.

- [ ] **Step 2: Intentar confirmar con location TBD**

Entrar al detalle, intentar "Confirm booking" sin haber definido la ubicación — confirmar que el botón está deshabilitado o el intento falla con el mensaje de error esperado, y que el `status` NO cambia a `confirmed`.

- [ ] **Step 3: Editar los datos y confirmar**

Agregar un item de cotización real, marcar como `quoted`. Usar el formulario de edición del detalle para reemplazar `location` (de "TBD" a una dirección real) y ajustar el horario/cantidad de invitados. Con `location` ya definida, confirmar la reserva y verificar que el status pasa a `confirmed` (antes de editar `location`, confirmar que el intento de la Tarea 22 Step 2 seguía bloqueado).

- [ ] **Step 4: Verificar el calendario**

Ir a `/admin/calendar` y confirmar que la parada de prueba (si sigue existiendo) y la reserva recién confirmada aparecen como eventos con colores distintos, en las fechas correctas.

- [ ] **Step 5: Limpiar los datos de prueba**

Borrar la reserva de prueba (`event_bookings` + `event_booking_items`) de la DB.

Si algo de esto falla, **detenerse y arreglarlo antes de avanzar a la Tarea 23.**

---

### Tarea 23: Verificación end-to-end

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Typecheck completo**

Run: `pnpm run typecheck`
Expected: sin errores

- [ ] **Step 2: Suite completa de tests**

Run: `pnpm run test`
Expected: todos los tests de `packages/domain`, `packages/db` e `packages/i18n` en verde, incluyendo los nuevos de `createTrailerStop`/`completeTrailerStop`/`cancelTrailerStop`, `initializeStopStock`/`restockProduct`/`reportStockWaste`, `quoteEventBooking`/`confirmEventBooking`/`cancelEventBooking`/`completeEventBooking`/`addEventBookingItem`, y los métodos nuevos de los tres repositorios Drizzle.

- [ ] **Step 3: Build completo**

Run: `pnpm run build`
Expected: build de `apps/web` exitoso. Revisar `.next/prerender-manifest.json` — ninguna de `/admin/trailer-stops`, `/admin/trailer-stops/new`, `/admin/event-bookings`, `/admin/calendar` debe aparecer en `routes` (todas dependen de `auth()`, que las vuelve dinámicas automáticamente, mismo patrón verificado en Fase 4).

- [ ] **Step 4: Confirmar que Fase 4 sigue funcionando**

Login de admin, `/admin/orders` con filtros, historial de cliente en `/account/orders` — nada de esto debería haber cambiado, pero un smoke rápido confirma que el refactor de `requireAdmin` (Tarea 7) y la nav nueva del layout (Tarea 20) no rompieron nada existente.

- [ ] **Step 5: Commit**

Si esta tarea no modificó ningún archivo de código (solo verificó), no hay nada que commitear — pasar directamente a la Tarea 24.

---

### Tarea 24: Actualizar `CLAUDE.md` y `handoff.md`

**Files:**
- Modify: `CLAUDE.md`
- Modify: `handoff.md`

- [ ] **Step 1: Actualizar `CLAUDE.md`**

En **Architecture decisions**, agregar:

```
- **Inventario y calendario del trailer (Fase 5):** vista de calendario vía `react-big-calendar` + `date-fns` (combina `trailer_stops` activas y `event_bookings` confirmados como eventos coloreados distinto). Ubicación de paradas se fija con un mapa interactivo (`LocationPicker`, variante editable de `LocationMap` de Fase 2). Stock inicial de una parada se carga manualmente (el admin elige productos y `maxStock`, no automático para todo el catálogo). Advertencia de solapamiento contra `event_bookings` confirmados corre en vivo mientras se completa el formulario de nueva parada (`checkStopOverlapAction`, debounce de 500ms), no bloquea el submit. Regla de negocio nueva en el dominio: `confirmEventBooking` rechaza confirmar una reserva con `location === "TBD"` — la UI también deshabilita el botón, pero la validación real vive en `packages/domain`, no solo en la interfaz.
- **`requireAdmin()` centralizado (Fase 5):** vivía duplicado dentro de `admin-orders.ts` desde Fase 4; se extrajo a `apps/web/src/lib/require-admin.ts` al agregar las Server Actions de `trailer-stops`/`event-bookings`/`calendar`, que lo necesitaban también.
```

En **Product**, actualizar la última oración para reflejar que el panel admin ya cubre más que órdenes:

```
Panel admin completo: gestión de órdenes (Fase 4), paradas del trailer con mapa interactivo y control de stock, reservas de eventos con flujo de cotización a confirmación, y una vista de calendario combinando ambas (Fase 5).
```

- [ ] **Step 2: Reescribir `handoff.md`**

Actualizar **Objetivo** y **Estado actual** para reflejar Fase 5, agregar la sección de **Archivos y cambios** de esta fase, sumar los intentos fallidos que hayan surgido durante la ejecución real (numerados a continuación del último de Fase 4), y actualizar **Próximos pasos**: no editar/crear una `trailer_stop` ya existente (solo se soporta crear + cambiar status a `completed`/`cancelled`, ver Global Constraints) — evaluar si hace falta más adelante; y arrancar Fase 6 (Notificaciones nativas) solo cuando el owner lo pida explícitamente.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md handoff.md
```

Comando sugerido: `git commit -m "Documenta la Fase 5 en CLAUDE.md y handoff.md"`

---

### Tarea 25: Deploy a producción

**Files:** ninguno (operación de deploy)

- [ ] **Step 1: Push**

El owner ejecuta `git push` manualmente (Claude no lo hace por su cuenta).

- [ ] **Step 2: Verificar el log de build y el sitio real**

Confirmar en el log de EasyPanel que el build pasa limpio, y verificar en `https://sweetsin.com.au/` que: `/admin/trailer-stops`, `/admin/event-bookings` y `/admin/calendar` cargan para el admin sembrado, y que el resto del panel admin (Orders, login, checkout de invitado) sigue funcionando sin cambios.

---
