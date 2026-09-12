# Fase 2 — Catálogo público bilingüe: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el scaffold vacío de `apps/web` por el sitio público real de Sweet Sin en Next.js 15 — catálogo servido desde Postgres, paradas del trailer reales, formulario de cotización de eventos persistido de verdad, todo bilingüe ES/EN con un selector de idioma — migrando el diseño ya construido en `apps/web-legacy` en vez de rediseñar desde cero.

**Architecture:** Sigue estrictamente Hexagonal: `apps/web` es un adaptador de entrada/salida que inyecta repositorios concretos de `packages/db` en casos de uso puros de `packages/domain` (Server Components para lectura, un Server Action para la única escritura de esta fase). Se agrega un módulo de dominio nuevo, `trailer-stops` (no existía desde Fase 1), y un paquete nuevo, `packages/i18n`, con diccionarios ES/EN framework-free. `apps/web` los consume mediante **`next-intl` con routing por locale** (`/en`, `/es`, middleware de detección/redirect) — decisión del owner (2026-09-12) por SEO bilingüe indexable y compatibilidad con SSR/Server Components de Next 15, ver Global Constraints. Sin carrito ni checkout todavía — eso es Fase 3.

**Tech Stack:** Next.js 15 (App Router, Server Components + un Server Action), `next-intl` (routing por locale + middleware), GSAP 3.15 (ScrollTrigger + SplitText) para las animaciones ya existentes en el diseño legacy, Three.js para el fondo de partículas del Hero, `@googlemaps/js-api-loader` para el mapa de FindUs, Zod (primer uso real, en el borde de `apps/web`), Vitest para `packages/domain`/`packages/db`/`packages/i18n`.

## Global Constraints

- Bilingüe ES/EN en todo lo migrado (decisión #1 de `plan-desarrollo.md`), con URLs separadas por idioma. **Decisión del owner (2026-09-12, reemplaza la primera versión de este plan):** se usa `next-intl` con routing por locale, no un Context propio con toggle en `localStorage`. Motivo: un catálogo público comercial necesita que Google indexe por separado las versiones en inglés y español (URLs propias, `hreflang`), y un Context client-side con `localStorage` no le da eso a un crawler ni aprovecha el SSR de los Server Components de Next 15. `packages/i18n` sigue exportando **únicamente diccionarios framework-free** (datos puros, sin lógica) — es la capa que se reutiliza tal cual en Fase 7 (Expo, con su propio adaptador nativo, no con `next-intl`). `apps/web` es el único lugar que conoce `next-intl`: `src/i18n/routing.ts`, `src/i18n/navigation.ts`, `src/i18n/request.ts` (carga `dictionaries[locale]` de `@workspace/i18n` como `messages`), `src/middleware.ts` y `app/[locale]/**`.
- **`localePrefix: "as-needed"`** (decisión del owner, mismo mensaje que fija `defaultLocale: "en"`): el idioma por defecto (inglés) se sirve en la raíz limpia `sweetsin.com/`, sin prefijo ni redirect visible — next-intl lo resuelve con un rewrite interno a `[locale]="en"`, no un 307, así que no se pierde link equity del dominio raíz. Español queda explícito en `sweetsin.com/es/`. `en` como default también es el fallback correcto para un navegador con un idioma no soportado (japonés, alemán, etc.) y lo que Googlebot prioriza al rastrear sin headers de idioma.
- La versión de Next.js está pinneada a `^15.5.0` (Fase 1, por compatibilidad exacta de React con Expo) — Next 16 renombró `middleware.ts` a `proxy.ts`, pero en 15.x el archivo correcto sigue siendo `middleware.ts` con `export default createMiddleware(routing)`. No confundir con ejemplos de `next-intl` para Next 16 (`next/root-params`, `proxy.ts`) si se busca documentación — esta fase usa el patrón `[locale]` + `generateStaticParams` + `setRequestLocale`, que es el correcto para Next 15.
- Secciones migradas de `apps/web-legacy`: `Hero`, `Menu` (solo catálogo — **sin carrito, cantidad ni descuento por volumen**, eso es Fase 3), `BrandStory`, `FindUs`, `Events` (con Server Action real), `Footer`, más `Navbar` y `MobileNav` (chrome de navegación necesario — ninguno listado explícitamente en `plan-desarrollo.md`, pero indispensables para que el sitio sea usable en desktop y mobile; **decisión del owner, 2026-09-12**: `MobileNav` no es un flourish descartable, es UX crítica para un catálogo público).
- **Explícitamente fuera de alcance** (no aparecen en la sección "Fase 2" de `plan-desarrollo.md`, y no son UX crítica): `Marquee`, `Spotlight`, `CustomCursor`, `Preorder`, `CartBar`, `CheckoutModal`. Las últimas tres son carrito/checkout (Fase 3); las primeras tres son flourish visual que queda en el backlog de una fase de pulido — no se migran en silencio, quedan documentadas como pendientes.
- Nuevo módulo de dominio `packages/domain/src/trailer-stops` — Fase 1 solo modeló `stop_product_stock`/`stock_events` bajo `stock`, nunca un puerto para `trailer_stops` en sí. Sigue el mismo patrón hexagonal exacto que `products` (entities/ports/use-cases/tests).
- `products` y `trailer_stops` están **vacíos** en el Postgres compartido dev=prod — esta fase agrega un script de seed idempotente con los 16 productos y 3 paradas que ya existían como datos hardcodeados en `apps/web-legacy`. **Las traducciones al español son un primer borrador de Claude, no revisadas por Oscar** — señalar explícitamente que ese copy debe revisarse antes de darlo por definitivo.
- Los horarios de las paradas sembradas se calculan con un offset fijo de Adelaide (ACST, UTC+9:30), sin manejo de horario de verano — simplificación de primer borrador; la gestión real de paradas (con fechas/horas exactas elegidas a mano) llega con el panel admin en Fase 5.
- Zod se usa por primera vez de verdad, en el borde de `apps/web` (Server Action de `Events`) — tal como preveía Fase 0 ("la validación de input crudo con Zod llega en Fase 2/3, en el borde de Next.js"). `packages/domain` sigue sin ninguna dependencia de framework.
- El formulario de cotización de evento no pide ubicación ni horario exacto (decisión del owner, 2026-09-12: prioriza baja fricción/conversión sobre datos logísticos en el primer contacto — igual que el formulario legacy, que solo pide una fecha). `location` se guarda como `"TBD"` y `startTime`/`endTime` como el mismo día completo (00:00–23:59) hasta que Oscar cierre esos detalles al cotizar (Fase 5, cambio de status a `quoted`/`confirmed`). Esto no rompe la detección de solapamiento de `plan-desarrollo.md`: `findOverlapping` (`packages/db`, ya existe) solo mira reservas con `status = 'confirmed'`, y una cotización recién creada entra como `quote_requested`. Ya quedó anotado en `plan-desarrollo.md` (sección Fase 5) que el panel admin debe resaltar visualmente las filas con `location = "TBD"`.
- GSAP `SplitText` en `Hero`/`BrandStory` mete sus propios `<span>` en el DOM del título de forma imperativa. Cambiar de idioma vuelve a renderizar ese texto vía React — si no se avisa, React reconcilia contra un DOM que GSAP ya mutó por su cuenta. Fix: `key={locale}` en el elemento afectado por `SplitText`, para forzar un remount limpio en vez de una reconciliación parcial.
- Los GIFs animados (`videologo.gif`, `isotipo.gif`) se sirven con `<img>` plano, no `next/image` — `next/image` optimiza GIFs a un frame estático salvo que se pase `unoptimized`, y estos dos llevan además una animación GSAP propia sobre su `ref`.
- No se toca carrito, checkout ni Stripe — eso es Fase 3.
- Dev y prod comparten la misma instancia de Postgres — cualquier escritura (seed incluido) hay que revisarla antes de confirmar, aunque el seed sea idempotente.
- Claude nunca ejecuta `git commit` — solo `git add` y sugiere el comando exacto en el chat, en español, una sola línea, sin firmas.

---

## File Structure

```
packages/
  i18n/                              # nuevo
    package.json
    tsconfig.json
    vitest.config.ts
    src/
      types.ts                       # Locale, Dictionary
      dictionaries/
        en.ts
        es.ts
        parity.test.ts               # en/es exponen exactamente las mismas claves
      index.ts                       # dictionaries, DEFAULT_LOCALE
  domain/
    src/
      trailer-stops/                 # nuevo
        entities.ts                  # TrailerStop, TrailerStopStatus
        ports.ts                     # TrailerStopRepository.listActive()
        use-cases.ts                 # listActiveTrailerStops
        use-cases.test.ts
        index.ts
    package.json                     # + export "./trailer-stops"
  db/
    src/
      repositories/
        trailer-stop-repository.ts       # nuevo
        trailer-stop-repository.test.ts  # nuevo, integración DB real
        index.ts                         # + export
      seed.ts                         # nuevo — carga products + trailer_stops
    package.json                      # + export "./repositories", script "seed", devDep tsx
apps/
  web/
    .env.local                        # nuevo, gitignored — NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    next.config.ts                    # + createNextIntlPlugin
    package.json                      # + @workspace/domain, @workspace/db, @workspace/i18n, next-intl, gsap, three, @googlemaps/js-api-loader, zod
    public/
      products/*.jpg, cafe.png        # copiados de apps/web-legacy
      videologo.gif, isotipo.gif, logo-flat.png, devil-icon.png
    src/
      global.d.ts                     # nuevo — augmentation de next-intl (Locale, Messages tipados)
      middleware.ts                   # nuevo — createMiddleware(routing), detecta/redirige por locale
      i18n/
        routing.ts                    # nuevo — defineRouting: locales, defaultLocale, localePrefix
        navigation.ts                 # nuevo — Link/redirect/usePathname/useRouter locale-aware
        request.ts                    # nuevo — getRequestConfig: messages = dictionaries[locale]
      app/
        globals.css                   # tema Sweet Sin (colores/fuentes) portado de web-legacy
        [locale]/
          layout.tsx                  # fuentes (next/font/google) + NextIntlClientProvider + generateStaticParams
          page.tsx                    # ensambla la home real
        actions/
          event-bookings.ts           # Server Action requestEventQuoteAction
      lib/
        animations.ts                 # isMotionOk + registro de plugins GSAP
        google-maps.ts                # ensureGoogleMapsOptionsSet
      components/
        layout/
          navbar.tsx
          mobile-nav.tsx
        webgl/
          hero-particles.tsx
        ui/
          location-map.tsx
        sections/
          hero.tsx
          brand-story.tsx
          menu.tsx                    # Server Component — fetch de productos
          menu-grid.tsx                # Client — filtro + grid
          find-us.tsx                 # Server Component — fetch de paradas
          find-us-client.tsx           # Client — selector + mapa + newsletter
          events.tsx                   # Client — cards + modal + form
          footer.tsx
```

---

### Task 1: `packages/i18n` — diccionarios ES/EN framework-free

**Files:**
- Create: `packages/i18n/package.json`, `packages/i18n/tsconfig.json`, `packages/i18n/vitest.config.ts`
- Create: `packages/i18n/src/types.ts`, `packages/i18n/src/dictionaries/en.ts`, `packages/i18n/src/dictionaries/es.ts`, `packages/i18n/src/dictionaries/parity.test.ts`, `packages/i18n/src/index.ts`
- Modify: root `tsconfig.json`, root `package.json` (ya tiene el script `test`, no cambia), `pnpm-workspace.yaml` (no cambia — `vitest` ya está en el catálogo desde Fase 1)

**Interfaces:**
- Produces: `Locale` (`"en" | "es"`), `Dictionary` (interfaz completa de copy), `dictionaries: Record<Locale, Dictionary>`, `DEFAULT_LOCALE` — consumidos desde la Tarea 6 (`apps/web/src/i18n/request.ts`, como `messages` de `next-intl`). El shape de `Dictionary` (un objeto por sección: `hero`, `menu`, `events`, etc.) mapea 1:1 a namespaces de `next-intl` — cada sección usa `useTranslations("hero")` y accede a `t("headlinePrefix")` en vez de `t.hero.headlinePrefix`.

- [ ] **Step 1: Crear el paquete**

`packages/i18n/package.json`:

```json
{
  "name": "@workspace/i18n",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "catalog:"
  }
}
```

`packages/i18n/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

`packages/i18n/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 2: Tipos**

`packages/i18n/src/types.ts`:

```ts
export type Locale = "en" | "es";

export interface Dictionary {
  common: {
    switchToLanguage: string;
  };
  nav: {
    menu: string;
    events: string;
    findUs: string;
    orderNow: string;
    order: string;
  };
  hero: {
    headlinePrefix: string;
    headlineHighlight: string;
    headlineSuffix: string;
    subhead: string;
    ctaMenu: string;
    ctaStory: string;
    scrollHint: string;
  };
  brandStory: {
    eyebrow: string;
    headlineLine1: string;
    headlineLine2: string;
    headlineLine3Prefix: string;
    headlineLine3Highlight: string;
    headlineLine3Suffix: string;
    body: string;
    imageCaption: string;
  };
  menu: {
    eyebrow: string;
    headlinePrefix: string;
    headlineHighlight: string;
    filterAll: string;
    filterSin: string;
    filterVirtue: string;
    filterCoffee: string;
    emptyState: string;
  };
  events: {
    eyebrow: string;
    headlinePrefix: string;
    headlineHighlight: string;
    headlineSuffix: string;
    subhead: string;
    cardCorporateTitle: string;
    cardCorporateDesc: string;
    cardWeddingsTitle: string;
    cardWeddingsDesc: string;
    cardFestivalsTitle: string;
    cardFestivalsDesc: string;
    ctaGetQuote: string;
    ctaWhatsApp: string;
    formTitle: string;
    formSubtitle: string;
    formName: string;
    formCompany: string;
    formEventType: string;
    formEventTypeSelect: string;
    formEventTypeCorporate: string;
    formEventTypeWedding: string;
    formEventTypeFestival: string;
    formEventTypeOther: string;
    formDate: string;
    formGuests: string;
    formGuestsPlaceholder: string;
    formMessage: string;
    formMessagePlaceholder: string;
    formSubmit: string;
    formSubmitting: string;
    formSuccessTitle: string;
    formSuccessBody: string;
    formClose: string;
    formError: string;
  };
  findUs: {
    eyebrow: string;
    headline: string;
    subhead: string;
    newsletterPlaceholder: string;
    newsletterSuccess: string;
    mapUnavailable: string;
    noStops: string;
  };
  footer: {
    tagline: string;
    menuHeading: string;
    servicesHeading: string;
    findUsHeading: string;
    sevenSins: string;
    sevenVirtues: string;
    laRepolla: string;
    eventsLink: string;
    weddingsLink: string;
    ourStory: string;
    schedule: string;
    whatsapp: string;
    copyright: string;
  };
}
```

- [ ] **Step 3: Diccionario en inglés (copy actual del sitio, sin cambios)**

`packages/i18n/src/dictionaries/en.ts`:

```ts
import type { Dictionary } from "../types";

export const en: Dictionary = {
  common: {
    switchToLanguage: "Español",
  },
  nav: {
    menu: "Menu",
    events: "Events",
    findUs: "Find Us",
    orderNow: "Order Now",
    order: "Order",
  },
  hero: {
    headlinePrefix: "Your ",
    headlineHighlight: "sins",
    headlineSuffix: " were always worth it.",
    subhead:
      "Colombian desserts crafted with memory, made with love, served from a trailer that knows no shame.",
    ctaMenu: "Explore the menu",
    ctaStory: "Our story",
    scrollHint: "scroll to discover",
  },
  brandStory: {
    eyebrow: "Our Origin",
    headlineLine1: "Born in Colombia.",
    headlineLine2: "Raised in memory.",
    headlineLine3Prefix: "Made for ",
    headlineLine3Highlight: "Adelaide",
    headlineLine3Suffix: ".",
    body: "Sweet Sin began with a family recipe and a refusal to forget where it came from. Every dessert carries the warmth of a Colombian kitchen — arequipe made from scratch, obleas pressed by hand, and profiteroles filled with something that doesn't exist anywhere else in Adelaide. We didn't adapt the recipes for Australia. We brought them exactly as they were.",
    imageCaption: "Trailer Photo",
  },
  menu: {
    eyebrow: "Indulgence, classified",
    headlinePrefix: "The ",
    headlineHighlight: "Menu",
    filterAll: "All",
    filterSin: "Sins",
    filterVirtue: "Virtues",
    filterCoffee: "Coffee",
    emptyState: "No products in this category yet.",
  },
  events: {
    eyebrow: "For businesses & celebrations",
    headlinePrefix: "Make it ",
    headlineHighlight: "sinful",
    headlineSuffix: ".",
    subhead: "Your event deserves a temptation people won't stop talking about.",
    cardCorporateTitle: "Corporate Events",
    cardCorporateDesc: "Branded catering packages for offices, launches & team days. Minimum 20 pax.",
    cardWeddingsTitle: "Weddings",
    cardWeddingsDesc: "Dessert stations & custom obleas towers. Unforgettable, guaranteed.",
    cardFestivalsTitle: "Festivals & Markets",
    cardFestivalsDesc: "Full trailer setup for outdoor events across SA. Subject to availability.",
    ctaGetQuote: "Get a quote",
    ctaWhatsApp: "WhatsApp: +61 433 508 831",
    formTitle: "Event Quote",
    formSubtitle: "Fill out the details and we'll get back to you with a custom quote.",
    formName: "Name",
    formCompany: "Company (Optional)",
    formEventType: "Event Type",
    formEventTypeSelect: "Select...",
    formEventTypeCorporate: "Corporate Event",
    formEventTypeWedding: "Wedding",
    formEventTypeFestival: "Festival / Market",
    formEventTypeOther: "Other",
    formDate: "Date",
    formGuests: "Estimated Guests",
    formGuestsPlaceholder: "Min 20 pax",
    formMessage: "Message",
    formMessagePlaceholder: "Tell us a bit about the event...",
    formSubmit: "Send Request",
    formSubmitting: "Sending...",
    formSuccessTitle: "Request Sent",
    formSuccessBody: "We'll be in touch with your custom quote soon.",
    formClose: "Close",
    formError: "Something went wrong. Please try again or message us on WhatsApp.",
  },
  findUs: {
    eyebrow: "This week's schedule",
    headline: "We show up where the cravings are.",
    subhead:
      "The trailer moves. Follow us on Instagram or sign up for weekly location drops straight to your inbox.",
    newsletterPlaceholder: "your@email.com",
    newsletterSuccess: "You're in. We'll see you soon.",
    mapUnavailable: "Map unavailable",
    noStops: "No upcoming stops scheduled — check back soon.",
  },
  footer: {
    tagline: "Born in Colombia. Made for Adelaide.\nForgive yourself.",
    menuHeading: "Menu",
    servicesHeading: "Services",
    findUsHeading: "Find Us",
    sevenSins: "The Seven Sins",
    sevenVirtues: "The Seven Virtues",
    laRepolla: "La Repolla",
    eventsLink: "Event Catering",
    weddingsLink: "Weddings",
    ourStory: "Our Story",
    schedule: "Markets & Schedule",
    whatsapp: "WhatsApp",
    copyright: "Sweet Sin · Adelaide SA",
  },
};
```

- [ ] **Step 4: Diccionario en español (primer borrador, pendiente de revisión de copy)**

`packages/i18n/src/dictionaries/es.ts`:

```ts
import type { Dictionary } from "../types";

export const es: Dictionary = {
  common: {
    switchToLanguage: "English",
  },
  nav: {
    menu: "Menú",
    events: "Eventos",
    findUs: "Encuéntranos",
    orderNow: "Ordena ya",
    order: "Pedido",
  },
  hero: {
    headlinePrefix: "Tus ",
    headlineHighlight: "pecados",
    headlineSuffix: " siempre valieron la pena.",
    subhead:
      "Postres colombianos hechos con memoria, con amor, servidos desde un trailer que no conoce la vergüenza.",
    ctaMenu: "Explora el menú",
    ctaStory: "Nuestra historia",
    scrollHint: "desliza para descubrir",
  },
  brandStory: {
    eyebrow: "Nuestro Origen",
    headlineLine1: "Nacimos en Colombia.",
    headlineLine2: "Crecimos en la memoria.",
    headlineLine3Prefix: "Hechos para ",
    headlineLine3Highlight: "Adelaide",
    headlineLine3Suffix: ".",
    body: "Sweet Sin nació de una receta familiar y de la negativa a olvidar de dónde viene. Cada postre lleva la calidez de una cocina colombiana — arequipe hecho desde cero, obleas prensadas a mano, y profiteroles rellenos de algo que no existe en ningún otro lugar de Adelaide. No adaptamos las recetas para Australia. Las trajimos exactamente como eran.",
    imageCaption: "Foto del Trailer",
  },
  menu: {
    eyebrow: "Indulgencia, clasificada",
    headlinePrefix: "El ",
    headlineHighlight: "Menú",
    filterAll: "Todos",
    filterSin: "Pecados",
    filterVirtue: "Virtudes",
    filterCoffee: "Café",
    emptyState: "Todavía no hay productos en esta categoría.",
  },
  events: {
    eyebrow: "Para empresas y celebraciones",
    headlinePrefix: "Hazlo ",
    headlineHighlight: "pecaminoso",
    headlineSuffix: ".",
    subhead: "Tu evento merece una tentación de la que la gente no deje de hablar.",
    cardCorporateTitle: "Eventos Corporativos",
    cardCorporateDesc:
      "Paquetes de catering personalizados para oficinas, lanzamientos y team days. Mínimo 20 personas.",
    cardWeddingsTitle: "Bodas",
    cardWeddingsDesc: "Estaciones de postres y torres de obleas personalizadas. Inolvidable, garantizado.",
    cardFestivalsTitle: "Festivales y Mercados",
    cardFestivalsDesc: "Instalación completa del trailer para eventos al aire libre en SA. Sujeto a disponibilidad.",
    ctaGetQuote: "Pide una cotización",
    ctaWhatsApp: "WhatsApp: +61 433 508 831",
    formTitle: "Cotización de Evento",
    formSubtitle: "Completa los detalles y te responderemos con una cotización personalizada.",
    formName: "Nombre",
    formCompany: "Empresa (Opcional)",
    formEventType: "Tipo de Evento",
    formEventTypeSelect: "Selecciona...",
    formEventTypeCorporate: "Evento Corporativo",
    formEventTypeWedding: "Boda",
    formEventTypeFestival: "Festival / Mercado",
    formEventTypeOther: "Otro",
    formDate: "Fecha",
    formGuests: "Invitados Estimados",
    formGuestsPlaceholder: "Mínimo 20 personas",
    formMessage: "Mensaje",
    formMessagePlaceholder: "Cuéntanos un poco sobre el evento...",
    formSubmit: "Enviar Solicitud",
    formSubmitting: "Enviando...",
    formSuccessTitle: "Solicitud Enviada",
    formSuccessBody: "Nos pondremos en contacto pronto con tu cotización personalizada.",
    formClose: "Cerrar",
    formError: "Algo salió mal. Intenta de nuevo o escríbenos por WhatsApp.",
  },
  findUs: {
    eyebrow: "El horario de esta semana",
    headline: "Aparecemos donde están los antojos.",
    subhead:
      "El trailer se mueve. Síguenos en Instagram o suscríbete para recibir las ubicaciones semanales directo a tu correo.",
    newsletterPlaceholder: "tu@email.com",
    newsletterSuccess: "Listo. Nos vemos pronto.",
    mapUnavailable: "Mapa no disponible",
    noStops: "No hay paradas próximas programadas — vuelve pronto.",
  },
  footer: {
    tagline: "Nacidos en Colombia. Hechos para Adelaide.\nPerdónate.",
    menuHeading: "Menú",
    servicesHeading: "Servicios",
    findUsHeading: "Encuéntranos",
    sevenSins: "Los Siete Pecados",
    sevenVirtues: "Las Siete Virtudes",
    laRepolla: "La Repolla",
    eventsLink: "Catering para Eventos",
    weddingsLink: "Bodas",
    ourStory: "Nuestra Historia",
    schedule: "Mercados y Horarios",
    whatsapp: "WhatsApp",
    copyright: "Sweet Sin · Adelaide SA",
  },
};
```

- [ ] **Step 5: Escribir el test que falla**

`packages/i18n/src/dictionaries/parity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { en } from "./en";
import { es } from "./es";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, nested]) =>
    keyPaths(nested, prefix ? `${prefix}.${key}` : key),
  );
}

describe("i18n dictionary parity", () => {
  it("en and es expose exactly the same keys", () => {
    expect(keyPaths(es).sort()).toEqual(keyPaths(en).sort());
  });
});
```

- [ ] **Step 6: Correr el test**

```bash
pnpm install
pnpm --filter @workspace/i18n run test
```

Expected: PASS (las dos tareas anteriores ya dejaron las claves alineadas a mano; este test las protege de un futuro drift).

- [ ] **Step 7: Barrel del paquete**

`packages/i18n/src/index.ts`:

```ts
import type { Locale, Dictionary } from "./types";
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";

export type { Locale, Dictionary };
export const dictionaries: Record<Locale, Dictionary> = { en, es };
export const DEFAULT_LOCALE: Locale = "en";
```

- [ ] **Step 8: Agregar el paquete al grafo de project references**

En [tsconfig.json](../../../tsconfig.json) (raíz), agregar `packages/i18n` a `references`:

```json
{
  "extends": "./tsconfig.base.json",
  "compileOnSave": false,
  "files": [],
  "references": [
    { "path": "./packages/db" },
    { "path": "./packages/domain" },
    { "path": "./packages/i18n" },
    { "path": "./packages/notifications" }
  ]
}
```

- [ ] **Step 9: Typecheck + test completo**

```bash
pnpm run typecheck
pnpm run test
```

Expected: ambos limpios.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Agrega packages/i18n con diccionarios ES/EN y test de paridad de claves"
```

---

### Task 2: `packages/domain` — dominio `trailer-stops`

**Files:**
- Create: `packages/domain/src/trailer-stops/entities.ts`, `packages/domain/src/trailer-stops/ports.ts`, `packages/domain/src/trailer-stops/use-cases.ts`, `packages/domain/src/trailer-stops/use-cases.test.ts`, `packages/domain/src/trailer-stops/index.ts`
- Modify: `packages/domain/package.json` (agregar export)

**Interfaces:**
- Consumes: nada (no depende de otro subdominio).
- Produces: `TrailerStop`, `TrailerStopStatus`, `TrailerStopRepository.listActive()`, `listActiveTrailerStops(repo)` — la Tarea 3 implementa el puerto con Drizzle; la Tarea 12 (`FindUs`) es quien finalmente lo consume desde `apps/web`.

- [ ] **Step 1: Entidades y puerto**

`packages/domain/src/trailer-stops/entities.ts`:

```ts
export type TrailerStopStatus = "scheduled" | "active" | "completed" | "cancelled";

export interface TrailerStop {
  id: string;
  location: string;
  lat: number;
  lng: number;
  startTime: Date;
  endTime: Date;
  status: TrailerStopStatus;
}
```

`packages/domain/src/trailer-stops/ports.ts`:

```ts
import type { TrailerStop } from "./entities";

export interface TrailerStopRepository {
  listActive(): Promise<TrailerStop[]>;
}
```

- [ ] **Step 2: Escribir el test que falla**

`packages/domain/src/trailer-stops/use-cases.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { listActiveTrailerStops } from "./use-cases";
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

function fakeRepo(stops: TrailerStop[]): TrailerStopRepository {
  return {
    async listActive() {
      return stops.filter((s) => s.status !== "completed" && s.status !== "cancelled");
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
```

- [ ] **Step 3: Correr y confirmar que falla**

```bash
pnpm --filter @workspace/domain run test
```

Expected: FAIL — `use-cases.ts` no existe todavía.

- [ ] **Step 4: Implementación**

`packages/domain/src/trailer-stops/use-cases.ts`:

```ts
import type { TrailerStopRepository } from "./ports";
import type { TrailerStop } from "./entities";

export function listActiveTrailerStops(repo: TrailerStopRepository): Promise<TrailerStop[]> {
  return repo.listActive();
}
```

`packages/domain/src/trailer-stops/index.ts`:

```ts
export * from "./entities";
export * from "./ports";
export * from "./use-cases";
```

- [ ] **Step 5: Exportar el subdominio desde el paquete**

En `packages/domain/package.json`, agregar a `"exports"`:

```json
"./trailer-stops": "./src/trailer-stops/index.ts"
```

- [ ] **Step 6: Correr y confirmar que pasa**

```bash
pnpm --filter @workspace/domain run test
```

Expected: PASS (todos los tests del paquete, incluidos los de Fase 1).

- [ ] **Step 7: Typecheck + commit**

```bash
pnpm run typecheck
git add -A
git commit -m "Agrega dominio TrailerStops en packages/domain"
```

---

### Task 3: `packages/db` — `DrizzleTrailerStopRepository`

**Files:**
- Create: `packages/db/src/repositories/trailer-stop-repository.ts`, `packages/db/src/repositories/trailer-stop-repository.test.ts`
- Modify: `packages/db/src/repositories/index.ts`, `packages/db/package.json`

**Interfaces:**
- Consumes: `TrailerStop`/`TrailerStopRepository` (`@workspace/domain/trailer-stops`), `trailerStopsTable` (`../schema`).
- Produces: `DrizzleTrailerStopRepository` — la Tarea 12 lo instancia desde `apps/web`. Se agrega el export `"./repositories"` al `package.json` de `packages/db`: es la primera vez que un código fuera de `packages/db` necesita instanciar un repositorio concreto directamente (hasta ahora solo lo hacían los propios tests de integración, con imports relativos). `listActive()` implementa "activa" como *no completed/cancelled y todavía no venció* (`endTime >= ahora`) — decisión del owner (2026-09-12): depender solo del `status` es frágil porque nada lo actualiza automáticamente hasta Fase 5.

- [ ] **Step 1: Exponer `./repositories` desde el paquete**

En `packages/db/package.json`, agregar a `"exports"`:

```json
"./repositories": "./src/repositories/index.ts"
```

- [ ] **Step 2: Implementación**

`packages/db/src/repositories/trailer-stop-repository.ts`:

```ts
import { and, asc, gte, ne } from "drizzle-orm";
import type { TrailerStop, TrailerStopRepository } from "@workspace/domain/trailer-stops";
import { db } from "../index";
import { trailerStopsTable } from "../schema";

export class DrizzleTrailerStopRepository implements TrailerStopRepository {
  async listActive(): Promise<TrailerStop[]> {
    // Filtrar solo por status no alcanza: nada marca una parada como
    // "completed" automáticamente (ese wiring llega recién con el panel
    // admin de Fase 5), así que una parada vencida seguiría con status
    // "scheduled" para siempre. Excluir por endTime evita mostrar en
    // FindUs una ubicación donde el trailer ya no está.
    const now = new Date();
    return db
      .select()
      .from(trailerStopsTable)
      .where(
        and(
          ne(trailerStopsTable.status, "completed"),
          ne(trailerStopsTable.status, "cancelled"),
          gte(trailerStopsTable.endTime, now),
        ),
      )
      .orderBy(asc(trailerStopsTable.startTime));
  }
}
```

- [ ] **Step 3: Test de integración contra la DB real**

`packages/db/src/repositories/trailer-stop-repository.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { DrizzleTrailerStopRepository } from "./trailer-stop-repository";
import { db } from "../index";
import { trailerStopsTable } from "../schema";

describe("DrizzleTrailerStopRepository", () => {
  const label = `Test Stop ${Date.now()}`;

  beforeAll(async () => {
    await db.insert(trailerStopsTable).values([
      {
        location: label,
        lat: -34.9289,
        lng: 138.5999,
        startTime: new Date(Date.now() + 86_400_000),
        endTime: new Date(Date.now() + 90_000_000),
        status: "scheduled",
      },
      {
        location: label,
        lat: -34.9289,
        lng: 138.5999,
        startTime: new Date(Date.now() - 172_800_000),
        endTime: new Date(Date.now() - 169_200_000),
        status: "completed",
      },
      {
        // status sigue en "scheduled" pero ya venció — nadie lo marca
        // "completed" automáticamente hasta el panel admin de Fase 5.
        // Este caso es el que justifica el filtro por endTime en
        // listActive(): sin él, esta fila se colaría igual.
        location: label,
        lat: -34.9289,
        lng: 138.5999,
        startTime: new Date(Date.now() - 259_200_000),
        endTime: new Date(Date.now() - 255_600_000),
        status: "scheduled",
      },
    ]);
  });

  it("lists only stops that are not completed/cancelled and have not ended yet", async () => {
    const repo = new DrizzleTrailerStopRepository();
    const result = await repo.listActive();
    const matching = result.filter((s) => s.location === label);

    expect(matching).toHaveLength(1);
    expect(matching[0].status).toBe("scheduled");
    expect(matching[0].endTime.getTime()).toBeGreaterThan(Date.now());
  });
});
```

- [ ] **Step 4: Exportar desde el barrel de repositorios**

En `packages/db/src/repositories/index.ts`, agregar:

```ts
export * from "./trailer-stop-repository";
```

- [ ] **Step 5: Correr el test**

```bash
pnpm --filter @workspace/db run test
```

Expected: PASS (incluidos los tests existentes de Fase 1).

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm run typecheck
git add -A
git commit -m "Agrega DrizzleTrailerStopRepository con test de integracion"
```

---

### Task 4: `packages/db` — seed de productos y paradas reales

**Files:**
- Create: `packages/db/src/seed.ts`
- Modify: `packages/db/package.json` (script `seed`, devDependency `tsx`)

**Interfaces:** N/A — script standalone, no expone nada a otras tareas. Escribe directamente contra `productsTable`/`trailerStopsTable` (`../schema`).

> ⚠️ Este script escribe contenido real en el Postgres compartido dev=prod (16 productos, 3 paradas). Es idempotente — correrlo de nuevo actualiza los productos existentes por `slug` y no duplica paradas ya sembradas — pero las traducciones al español son un primer borrador de Claude, no revisadas por Oscar. Señalarlo explícitamente al terminar la tarea.

- [ ] **Step 1: Agregar `tsx` como devDependency y el script `seed`**

En `packages/db/package.json`, agregar a `"scripts"`:

```json
"seed": "tsx src/seed.ts"
```

y a `"devDependencies"`:

```json
"tsx": "catalog:"
```

- [ ] **Step 2: Escribir el script de seed**

`packages/db/src/seed.ts`:

```ts
// Carga inicial de contenido real para products y trailer_stops (ambas
// tablas están vacías en el Postgres compartido dev=prod). Idempotente:
// products usa upsert por slug; trailer_stops verifica existencia por
// location+startTime antes de insertar (no tiene una unique key natural).
//
// tsx no carga .env automáticamente (mismo gotcha que Vitest, ver
// vitest.config.ts) — y como los imports estáticos de un módulo ES se
// hoistean por encima de cualquier otra sentencia, poner
// `process.loadEnvFile()` arriba de un `import { db } from "./index"`
// estático no alcanza a correr antes de que ese import se evalúe (y
// reviente por falta de DATABASE_URL). Por eso "./index" y "./schema" se
// importan de forma dinámica, dentro de main().
process.loadEnvFile();

const ADELAIDE_UTC_OFFSET_HOURS = 9.5; // ACST — sin horario de verano, primer borrador

function adelaideTime(daysFromNow: number, hour: number, minute: number): Date {
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  base.setUTCDate(base.getUTCDate() + daysFromNow);
  return new Date(base.getTime() + (hour + minute / 60 - ADELAIDE_UTC_OFFSET_HOURS) * 60 * 60 * 1000);
}

function daysUntilWeekday(targetDay: number): number {
  const today = new Date().getUTCDay();
  return (targetDay - today + 7) % 7 || 7;
}

const PRODUCTS = [
  { slug: "gluttony", category: "sin" as const, nameEn: "Gluttony", nameEs: "Gula", descriptionEn: "More than you should. Exactly as much as you want.", descriptionEs: "Más de lo que deberías. Exactamente lo que quieres.", priceCents: 1300, imageUrl: "/products/p1.jpg", featured: false },
  { slug: "lust", category: "sin" as const, nameEn: "Lust", nameEs: "Lujuria", descriptionEn: "Impossible to resist. Impossible to have just one.", descriptionEs: "Imposible resistirse. Imposible comer solo uno.", priceCents: 1300, imageUrl: "/products/p2.jpg", featured: false },
  { slug: "wrath", category: "sin" as const, nameEn: "Wrath", nameEs: "Ira", descriptionEn: "Bold, aggressive, uncompromising in every bite.", descriptionEs: "Audaz, intenso, sin concesiones en cada bocado.", priceCents: 1300, imageUrl: "/products/p3.jpg", featured: false },
  { slug: "envy", category: "sin" as const, nameEn: "Envy", nameEs: "Envidia", descriptionEn: "The one everyone wishes was on their plate.", descriptionEs: "El que todos desean tener en su plato.", priceCents: 1300, imageUrl: "/products/p4.jpg", featured: false },
  { slug: "pride", category: "sin" as const, nameEn: "Pride", nameEs: "Soberbia", descriptionEn: "Our finest. No apologies necessary.", descriptionEs: "Nuestro mejor postre. Sin pedir disculpas.", priceCents: 1300, imageUrl: "/products/p5.jpg", featured: false },
  { slug: "greed", category: "sin" as const, nameEn: "Greed", nameEs: "Avaricia", descriptionEn: "Because one was never going to be enough.", descriptionEs: "Porque uno nunca iba a ser suficiente.", priceCents: 1300, imageUrl: "/products/p6.jpg", featured: false },
  { slug: "sloth", category: "sin" as const, nameEn: "Sloth", nameEs: "Pereza", descriptionEn: "The indulgence that demands you slow down.", descriptionEs: "El antojo que te obliga a ir despacio.", priceCents: 1300, imageUrl: "/products/p7.jpg", featured: false },
  { slug: "patience", category: "virtue" as const, nameEn: "Patience", nameEs: "Paciencia", descriptionEn: "Good things come to those who wait. These are worth it.", descriptionEs: "Las cosas buenas llegan para quien espera. Estos lo valen.", priceCents: 1100, imageUrl: "/products/p8.jpg", featured: false },
  { slug: "kindness", category: "virtue" as const, nameEn: "Kindness", nameEs: "Bondad", descriptionEn: "Sweet, gentle, made with care.", descriptionEs: "Dulce, suave, hecho con cariño.", priceCents: 1100, imageUrl: "/products/p9.jpg", featured: false },
  { slug: "humility", category: "virtue" as const, nameEn: "Humility", nameEs: "Humildad", descriptionEn: "Simple ingredients. Extraordinary result.", descriptionEs: "Ingredientes simples. Resultado extraordinario.", priceCents: 1100, imageUrl: "/products/p10.jpg", featured: false },
  { slug: "charity", category: "virtue" as const, nameEn: "Charity", nameEs: "Caridad", descriptionEn: "A little sweetness goes a long way.", descriptionEs: "Un poco de dulzura rinde mucho.", priceCents: 1100, imageUrl: "/products/p11.jpg", featured: false },
  { slug: "diligence", category: "virtue" as const, nameEn: "Diligence", nameEs: "Diligencia", descriptionEn: "Crafted with attention to every detail.", descriptionEs: "Elaborado con atención a cada detalle.", priceCents: 1100, imageUrl: "/products/p12.jpg", featured: false },
  { slug: "temperance", category: "virtue" as const, nameEn: "Temperance", nameEs: "Templanza", descriptionEn: "Balance never tasted this good.", descriptionEs: "El equilibrio nunca supo tan bien.", priceCents: 1100, imageUrl: "/products/p13.jpg", featured: false },
  { slug: "hope", category: "virtue" as const, nameEn: "Hope", nameEs: "Esperanza", descriptionEn: "The first bite of something wonderful.", descriptionEs: "El primer bocado de algo maravilloso.", priceCents: 1100, imageUrl: "/products/p14.jpg", featured: false },
  { slug: "la-repolla", category: "sin" as const, nameEn: "La Repolla", nameEs: "La Repolla", descriptionEn: "Filled with homemade arequipe, dusted with something you didn't know you were missing.", descriptionEs: "Relleno de arequipe casero, espolvoreado con algo que no sabías que te faltaba.", priceCents: 1300, imageUrl: "/products/p15.jpg", featured: true },
  { slug: "sweet-sin-coffee", category: "coffee" as const, nameEn: "Sweet Sin Coffee", nameEs: "Café Sweet Sin", descriptionEn: "Locally roasted, made fresh at the trailer.", descriptionEs: "Tostado localmente, preparado fresco en el trailer.", priceCents: 450, imageUrl: "/products/cafe.png", featured: false },
];

const TRAILER_STOPS = [
  { location: "Central Market, Adelaide CBD", lat: -34.9289, lng: 138.5999, weekday: 5, startHour: 16, endHour: 20 },
  { location: "Rundle Park, Adelaide", lat: -34.9235, lng: 138.6087, weekday: 6, startHour: 10, endHour: 15 },
  { location: "Prospect Farmers Market", lat: -34.8814, lng: 138.5931, weekday: 0, startHour: 9, endHour: 13 },
];

async function main() {
  const { db, pool } = await import("./index");
  const { productsTable, trailerStopsTable } = await import("./schema");
  const { and, eq } = await import("drizzle-orm");

  for (const product of PRODUCTS) {
    await db
      .insert(productsTable)
      .values(product)
      .onConflictDoUpdate({ target: productsTable.slug, set: product });
  }
  console.log(`Seeded ${PRODUCTS.length} products.`);

  let createdStops = 0;
  for (const stop of TRAILER_STOPS) {
    const daysUntil = daysUntilWeekday(stop.weekday);
    const startTime = adelaideTime(daysUntil, stop.startHour, 0);
    const endTime = adelaideTime(daysUntil, stop.endHour, 0);

    const [existing] = await db
      .select({ id: trailerStopsTable.id })
      .from(trailerStopsTable)
      .where(and(eq(trailerStopsTable.location, stop.location), eq(trailerStopsTable.startTime, startTime)));

    if (existing) continue;

    await db.insert(trailerStopsTable).values({
      location: stop.location,
      lat: stop.lat,
      lng: stop.lng,
      startTime,
      endTime,
      status: "scheduled",
    });
    createdStops++;
  }
  console.log(`Seeded ${createdStops} new trailer stop(s) (${TRAILER_STOPS.length - createdStops} already existed).`);

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 3: Instalar y correr el seed contra la DB real**

```bash
pnpm install
pnpm --filter @workspace/db run seed
```

Expected: `Seeded 16 products.` seguido de `Seeded 3 new trailer stop(s) (0 already existed).` (o menos paradas nuevas si ya se corrió antes).

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm run typecheck
git add -A
git commit -m "Agrega script de seed para productos y paradas del trailer"
```

> ⚠️ Las traducciones al español de los 16 productos son un primer borrador de Claude — pendiente de que Oscar las revise y ajuste el copy antes de considerarlo definitivo.

---

### Task 5: `apps/web` — dependencias, tema visual, fuentes y assets estáticos

**Files:**
- Modify: `apps/web/package.json`, `apps/web/src/app/globals.css`
- Create: `apps/web/.env.local` (gitignored)
- Copy: `apps/web-legacy/public/products/*` → `apps/web/public/products/`; `apps/web-legacy/public/{videologo.gif,isotipo.gif,logo-flat.png,devil-icon.png}` → `apps/web/public/`
- Delete: `apps/web/public/{file,globe,next,vercel,window}.svg` (defaults del scaffold, ya sin uso a partir de la Tarea 15)

**Interfaces:** N/A — tarea de configuración, sin código de negocio.

- [ ] **Step 1: Agregar dependencias del monorepo y de UI a `apps/web/package.json`**

Reemplazar los bloques `"dependencies"`/`"devDependencies"` por:

```json
"dependencies": {
  "react": "catalog:",
  "react-dom": "catalog:",
  "next": "^15.5.0",
  "@workspace/domain": "workspace:*",
  "@workspace/db": "workspace:*",
  "@workspace/i18n": "workspace:*",
  "next-intl": "^4.0.0",
  "gsap": "^3.15.0",
  "three": "^0.185.1",
  "@googlemaps/js-api-loader": "^2.1.1",
  "zod": "catalog:"
},
"devDependencies": {
  "typescript": "~5.9.3",
  "@types/node": "catalog:",
  "@types/react": "catalog:",
  "@types/react-dom": "catalog:",
  "@types/three": "^0.185.4",
  "@types/google.maps": "^3.65.5",
  "@tailwindcss/postcss": "^4",
  "tailwindcss": "catalog:",
  "eslint": "^9",
  "eslint-config-next": "15.5.25",
  "@eslint/eslintrc": "^3"
}
```

`next-intl` está pineado como referencia a `^4.0.0` — correr `pnpm --filter @workspace/web add next-intl` en el Step 5 de esta tarea deja instalada la versión real resuelta (que puede ser mayor); ajustar el número en `package.json` al que quede instalado si difiere.

- [ ] **Step 2: Tema visual — reemplazar `apps/web/src/app/globals.css`**

```css
@import "tailwindcss";

@theme inline {
  --color-sin-red: #E63946;
  --color-sin-red-dark: #B82B36;
  --color-sin-red-light: #FF5C6A;
  --color-navy: #0F1B3D;
  --color-navy-mid: #1A2F5F;
  --color-navy-light: #253D78;
  --color-cream: #F7F3EE;
  --color-cream-dark: #EDE7DC;
  --color-sweet-white: #FDFAF7;
  --color-sweet-dark: #080D1A;

  --color-background: var(--color-sweet-white);
  --color-foreground: var(--color-navy);
  --color-border: rgba(15, 27, 61, 0.08);

  --font-sans: var(--font-dm-sans);
  --font-serif: var(--font-fraunces);
  --font-mono: var(--font-dm-mono);
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply font-sans antialiased bg-background text-foreground;
  }
}

/* Overlay del modal de cotización de eventos (Events) */
.modal-overlay {
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  background: rgba(15, 27, 61, 0.35);
}
```

Nota: `tw-animate-css` y el plugin `@tailwindcss/typography` de `apps/web-legacy` no se portan — ninguna de las 7 secciones migradas usa clases `animate-in`/`prose`.

- [ ] **Step 3: Variable de entorno de Google Maps**

`apps/web-legacy/.env` ya tiene `VITE_GOOGLE_MAPS_API_KEY` provisionada y funcionando en producción. Copiar ese mismo valor a `apps/web/.env.local` (Next.js expone al navegador cualquier variable con prefijo `NEXT_PUBLIC_`) sin imprimirlo en la terminal:

```bash
grep '^VITE_GOOGLE_MAPS_API_KEY=' apps/web-legacy/.env | sed 's/^VITE_GOOGLE_MAPS_API_KEY=/NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=/' > apps/web/.env.local
test -s apps/web/.env.local && echo "apps/web/.env.local creado" || echo "FALTA — copiar la key manualmente"
```

`apps/web/.gitignore` ya cubre `.env*`, así que no se commitea.

- [ ] **Step 4: Copiar assets estáticos desde `apps/web-legacy`**

```bash
mkdir -p apps/web/public/products
cp apps/web-legacy/public/products/*.jpg apps/web-legacy/public/products/*.png apps/web/public/products/
cp apps/web-legacy/public/videologo.gif apps/web-legacy/public/isotipo.gif apps/web-legacy/public/logo-flat.png apps/web-legacy/public/devil-icon.png apps/web/public/
rm apps/web/public/file.svg apps/web/public/globe.svg apps/web/public/next.svg apps/web/public/vercel.svg apps/web/public/window.svg
```

- [ ] **Step 5: Instalar y typecheck**

```bash
pnpm install
pnpm --filter @workspace/web run typecheck
```

Expected: falla o pasa dependiendo de si `layout.tsx`/`page.tsx` (todavía sin tocar, Tareas 7 y 15) referencian algo roto — en este punto solo debe fallar si algo de esta tarea está mal, no por código que llega después. Si el scaffold generado por `create-next-app` sigue intacto (Tarea 3 de Fase 1), `typecheck` debe pasar limpio.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Configura apps/web: dependencias del monorepo, tema de Tailwind, fuentes y assets estaticos"
```

---

### Task 6: `apps/web` — `next-intl`: routing, middleware y config de mensajes

**Files:**
- Create: `apps/web/src/i18n/routing.ts`, `apps/web/src/i18n/navigation.ts`, `apps/web/src/i18n/request.ts`, `apps/web/src/middleware.ts`, `apps/web/src/global.d.ts`
- Modify: `apps/web/next.config.ts`

**Interfaces:**
- Consumes: `dictionaries` (`@workspace/i18n`).
- Produces: `routing` (locales, `defaultLocale`, `localePrefix`), `Link`/`redirect`/`usePathname`/`useRouter` locale-aware (`@/i18n/navigation`) — el selector de idioma de la Tarea 8 usa `usePathname`/`useRouter` de acá. La config de `request.ts` deja disponibles `useTranslations()`/`useLocale()` (de `"next-intl"`, en Client Components) y `getTranslations()`/`getLocale()` (de `"next-intl/server"`, en Server Components) en toda `apps/web` a partir de la Tarea 7.

> Nota de versión: Next.js 16 renombró `middleware.ts` a `proxy.ts`. Este proyecto está pineado a Next `^15.5.0` (Fase 1, por compatibilidad de React con Expo) — el archivo correcto acá es `middleware.ts` con `export default createMiddleware(routing)`, no `proxy.ts`. Si se busca documentación de `next-intl`, la sección "routing con `[locale]`" (no la de `next/root-params`, que es Next 16) es la que aplica.

- [ ] **Step 1: Instalar `next-intl`**

```bash
pnpm --filter @workspace/web add next-intl
```

Anotar la versión resuelta (`apps/web/package.json`) si difiere de la referencia `^4.0.0` puesta en la Tarea 5.

- [ ] **Step 2: `i18n/routing.ts`**

`apps/web/src/i18n/routing.ts`:

```ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  // "as-needed": el default (en) se sirve en la raíz limpia "/" sin
  // prefijo ni redirect — preserva el link equity del dominio raíz.
  // Solo "es" queda explícito como "/es". Decisión del owner (2026-09-12).
  localePrefix: "as-needed",
});
```

- [ ] **Step 3: `i18n/navigation.ts`**

`apps/web/src/i18n/navigation.ts`:

```ts
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```

- [ ] **Step 4: `i18n/request.ts` — mensajes desde `packages/i18n`**

`apps/web/src/i18n/request.ts`:

```ts
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { dictionaries } from "@workspace/i18n";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: dictionaries[locale],
  };
});
```

- [ ] **Step 5: `middleware.ts` — detección/redirect por locale**

`apps/web/src/middleware.ts`:

```ts
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Todo menos /api, /trpc, /_next, /_vercel y archivos con extensión (favicon.ico, etc.)
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
```

Con `localePrefix: "as-needed"`, visitar `/` sirve inglés directamente vía un rewrite interno (`[locale]="en"`) — sin redirect, la URL se mantiene en `/`. `/es` sirve español, siempre con el prefijo explícito.

`localeDetection` (default `true`, sin configurar acá — se deja así a propósito) sigue negociando por `Accept-Language` cuando la URL no trae un locale explícito: un navegador configurado en español que visita `/` por primera vez (sin cookie de locale todavía) recibe un redirect 307 a `/es`, no un rewrite silencioso. Esto es intencional, no un bug — Googlebot no manda un `Accept-Language` que dispare esa detección, así que `/` se mantiene consistentemente en inglés para crawling/indexación (el objetivo de SEO del owner), mientras que un visitante real con el navegador en español cae en `/es` automáticamente. Si en algún momento se prefiere que `/` sea inglés para absolutamente todos sin excepción, se agrega `localeDetection: false` a `defineRouting`.

- [ ] **Step 6: Envolver `next.config.ts` con el plugin de `next-intl`**

`apps/web/next.config.ts`:

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

- [ ] **Step 7: Augmentation de TypeScript — `Locale` y `Messages` tipados**

Sin esto, `useLocale()` devuelve `string` genérico (no `"en" | "es"`) y `useTranslations()` no valida las claves contra `Dictionary` — un typo como `t("headlinePrefixx")` no se detectaría hasta runtime.

`apps/web/src/global.d.ts`:

```ts
import type { Dictionary } from "@workspace/i18n";
import { routing } from "@/i18n/routing";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: Dictionary;
  }
}
```

- [ ] **Step 8: Typecheck + commit**

```bash
pnpm run typecheck
git add -A
git commit -m "Agrega next-intl: routing por locale, middleware y config de mensajes"
```

Expected: `typecheck` puede fallar todavía en este punto porque `app/layout.tsx`/`app/page.tsx` (scaffold de Fase 1) no viven bajo `[locale]` — se resuelve en la Tarea 7, el próximo paso. Si falla solo por eso, es esperable.

---

### Task 7: `apps/web` — `lib/animations.ts` + `app/[locale]/layout.tsx`

**Files:**
- Create: `apps/web/src/lib/animations.ts`, `apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/app/[locale]/page.tsx` (placeholder temporal, la Tarea 15 lo reemplaza con la home real)
- Delete: `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx` (scaffold de Fase 1, sin routing por locale)

**Interfaces:**
- Produces: `isMotionOk()` (registra los plugins GSAP como efecto secundario al importarse) — usado desde la Tarea 9 en adelante por todas las secciones animadas. `app/[locale]/layout.tsx` deja andando `next-intl` de punta a punta (routing + middleware de la Tarea 6 + `NextIntlClientProvider`) para que la Tarea 8 en adelante puedan usar `useTranslations()`/`useLocale()` sin configuración adicional.

- [ ] **Step 1: `lib/animations.ts`**

```ts
"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  gsap.defaults({ ease: "power2.out" });
  ScrollTrigger.defaults({ markers: false });
}

export const isMotionOk = () => {
  if (typeof window !== "undefined") {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return true;
};
```

- [ ] **Step 2: Borrar el layout/page del scaffold**

```bash
git rm apps/web/src/app/layout.tsx apps/web/src/app/page.tsx
mkdir -p "apps/web/src/app/[locale]"
```

- [ ] **Step 3: `app/[locale]/layout.tsx` — fuentes + `NextIntlClientProvider` + metadata bilingüe**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Fraunces, DM_Sans, DM_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
import "../globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });
const dmMono = DM_Mono({ variable: "--font-dm-mono", weight: ["400", "500"], subsets: ["latin"] });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return {
    title: "Sweet Sin",
    description:
      "Colombian desserts crafted with memory, made with love, served from a trailer that knows no shame.",
    alternates: {
      // "en" (default) apunta a la raíz limpia "/"; el resto lleva su prefijo.
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, l === routing.defaultLocale ? "/" : `/${l}`]),
      ),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${fraunces.variable} ${dmSans.variable} ${dmMono.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: `app/[locale]/page.tsx` — placeholder temporal (la Tarea 15 lo reemplaza)**

```tsx
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("hero");

  return (
    <main className="w-full min-h-screen flex items-center justify-center bg-sweet-white text-navy">
      <p className="font-mono text-xs uppercase tracking-widest">
        Sweet Sin — {locale} — {t("ctaMenu")}
      </p>
    </main>
  );
}
```

Placeholder solo para confirmar que el routing y los mensajes llegan bien — la Tarea 15 lo reemplaza con la composición real de secciones.

- [ ] **Step 5: Typecheck + build**

```bash
pnpm run typecheck
pnpm --filter @workspace/web run dev
```

Abrir `http://localhost:3000/` y confirmar que sirve directamente "Sweet Sin — en — Explore the menu" **sin redirect** (la URL se mantiene en `/`); abrir `http://localhost:3000/es` y confirmar "Sweet Sin — es — Explora el menú".

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Agrega lib/animations y app/[locale]/layout.tsx con next-intl"
```

---

### Task 8: `apps/web` — `Navbar` + `MobileNav`

**Files:**
- Create: `apps/web/src/components/layout/navbar.tsx`, `apps/web/src/components/layout/mobile-nav.tsx`

**Interfaces:**
- Consumes: `useTranslations`/`useLocale` (`"next-intl"`), `usePathname`/`useRouter` (`@/i18n/navigation`), `isMotionOk`/registro de plugins (`@/lib/animations`, solo por su efecto secundario).
- Produces: `Navbar`, `MobileNav` — usados en la Tarea 15 (`page.tsx`).

`MobileNav` es la barra de tabs fija de mobile del legacy (`apps/web-legacy/src/components/layout/MobileNav.tsx`) — decisión del owner (2026-09-12): sin ella, mobile queda sin ninguna navegación fija más allá del `Navbar` de arriba, lo cual es un problema real de UX para un catálogo público, no un flourish visual descartable como `Marquee`/`Spotlight`/`CustomCursor`. El tab "Order" apunta a `#menu` (mismo ajuste que el CTA del `Navbar`) hasta que Fase 3 tenga un destino real.

- [ ] **Step 1: Implementación**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import "@/lib/animations";

export function Navbar() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const trigger = ScrollTrigger.create({
      start: "80px top",
      onEnter: () => nav.classList.add("is-scrolled"),
      onLeaveBack: () => nav.classList.remove("is-scrolled"),
    });

    return () => {
      trigger.kill();
    };
  }, []);

  const toggleLocale = () => {
    const next = locale === "en" ? "es" : "en";
    router.replace(pathname, { locale: next });
    router.refresh();
  };

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 md:px-12 py-6 transition-all duration-400 ease-out"
      style={{ backgroundColor: "transparent" }}
    >
      <style>{`
        nav.is-scrolled {
          background-color: rgba(253, 250, 247, 0.96);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 1px 0 rgba(15,27,61,0.07);
          padding-top: 1rem;
          padding-bottom: 1rem;
        }
      `}</style>

      <Link href="/" className="flex items-center">
        <img
          src="/isotipo.gif"
          alt="Sweet Sin"
          className="h-12 w-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
        />
      </Link>

      <ul className="hidden md:flex items-center gap-8 text-xs font-mono tracking-widest text-navy/50 uppercase">
        <li>
          <a href="#menu" className="hover:text-sin-red transition-colors">{t("menu")}</a>
        </li>
        <li>
          <a href="#events" className="hover:text-sin-red transition-colors">{t("events")}</a>
        </li>
        <li>
          <a href="#find-us" className="hover:text-sin-red transition-colors">{t("findUs")}</a>
        </li>
        <li>
          <button
            onClick={toggleLocale}
            className="normal-case tracking-normal font-sans hover:text-sin-red transition-colors"
          >
            {tCommon("switchToLanguage")}
          </button>
        </li>
      </ul>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleLocale}
          className="md:hidden text-navy/50 text-[11px] font-mono uppercase tracking-widest"
        >
          {tCommon("switchToLanguage")}
        </button>
        <a
          href="#menu"
          className="hidden md:inline-flex bg-sin-red text-white text-xs font-medium uppercase tracking-wider px-6 py-3 rounded-full hover:bg-sin-red-light hover:-translate-y-0.5 transition-all shadow-[0_4px_16px_rgba(230,57,70,0.3)]"
        >
          {t("orderNow")}
        </a>
        <a
          href="#menu"
          className="md:hidden bg-sin-red text-white text-[11px] font-medium uppercase tracking-wider px-5 py-2.5 rounded-full hover:bg-sin-red-light transition-colors shadow-[0_4px_12px_rgba(230,57,70,0.30)]"
        >
          {t("orderNow")}
        </a>
      </div>
    </nav>
  );
}
```

Notas: (1) el CTA "Order Now" apunta a `#menu` en vez de `#preorder` — el carrito/checkout es Fase 3 y esa sección todavía no existe. (2) El logo usa el `Link` locale-aware de `@/i18n/navigation`, no un `<a>` plano — con `localePrefix: "as-needed"`, `/` es siempre inglés; un `<a href="/">` desde `/es` probablemente termine de vuelta en `/es` igual (next-intl persiste el locale resuelto en una cookie), pero pasando por un redirect visible de más. El `Link` arma el href correcto (`/` o `/es` según el locale activo) sin ese salto. Los anchors internos (`#menu`, `#events`, `#find-us`) sí siguen siendo `<a>` planos: son scroll dentro de la misma página, no cambian de URL.

- [ ] **Step 2: `MobileNav`**

`apps/web/src/components/layout/mobile-nav.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

function TabIcon({ id }: { id: string }) {
  const props = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (id) {
    case "menu":
      return (
        <svg {...props}>
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <path d="M7 2v20" />
          <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
        </svg>
      );
    case "events":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <path d="M9 16l1.5 1.5L14 13" />
        </svg>
      );
    case "order":
      return (
        <svg {...props}>
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case "find-us":
      return (
        <svg {...props}>
          <path d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      );
    default:
      return null;
  }
}

export function MobileNav() {
  const t = useTranslations("nav");
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const [activeTab, setActiveTab] = useState("menu");

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // "order" apunta a #menu (no #preorder) hasta que Fase 3 tenga carrito/checkout real.
  const tabs = [
    { id: "menu", label: t("menu"), href: "#menu" },
    { id: "events", label: t("events"), href: "#events" },
    { id: "order", label: t("order"), href: "#menu" },
    { id: "find-us", label: t("findUs"), href: "#find-us" },
  ];

  return (
    <div
      className={`md:hidden fixed bottom-0 left-0 right-0 z-50 h-14 bg-sweet-dark/90 backdrop-blur-xl border-t border-white/10 transition-transform duration-300 ease-out flex justify-around items-center px-2 ${
        isVisible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      {tabs.map((tab) => (
        <a
          key={tab.id}
          href={tab.href}
          onClick={() => setActiveTab(tab.id)}
          className="flex flex-col items-center justify-center w-full h-full gap-1"
        >
          <span className={`transition-all ${activeTab === tab.id ? "scale-110 text-sin-red" : "opacity-50 text-white"}`}>
            <TabIcon id={tab.id} />
          </span>
          {activeTab === tab.id && (
            <span className="text-[9px] font-mono uppercase tracking-wider text-sin-red">{tab.label}</span>
          )}
        </a>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm run typecheck
git add -A
git commit -m "Migra Navbar y MobileNav a apps/web con selector de idioma"
```

---

### Task 9: `apps/web` — `Hero` + `HeroParticles`

**Files:**
- Create: `apps/web/src/components/webgl/hero-particles.tsx`, `apps/web/src/components/sections/hero.tsx`

**Interfaces:**
- Consumes: `isMotionOk` (`@/lib/animations`), `useLocale`/`useTranslations` (`"next-intl"`).
- Produces: `Hero` — usado en la Tarea 15.

- [ ] **Step 1: `HeroParticles` (idéntico al de `apps/web-legacy`, sin cambios de lógica)**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

export function HeroParticles() {
  const [mounted, setMounted] = useState(false);
  const [useWebGL, setUseWebGL] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      const isGoodConnection = !(navigator as any).connection?.saveData;
      const isGoodMemory = !((navigator as any).deviceMemory < 2);

      if (gl && isGoodConnection && isGoodMemory && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setUseWebGL(true);
      }
    } catch (e) {
      console.warn("WebGL not available or disabled", e);
    }
  }, []);

  if (!mounted || !useWebGL) return null;

  return <ThreeJSImpl />;
}

function ThreeJSImpl() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animationFrameId: number;

    import("three").then((THREE) => {
      if (!canvasRef.current) return;

      const width = window.innerWidth;
      const height = window.innerHeight;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.z = 100;

      const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: false });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const isMobile = width < 768;
      const particleCount = isMobile ? (navigator.hardwareConcurrency <= 4 ? 500 : 800) : 2000;

      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const originalPositions = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const radius = Math.random() * 20;

        const x = Math.cos(theta) * radius;
        const y = Math.sin(theta) * radius + 10;
        const z = (Math.random() - 0.5) * 10;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        originalPositions[i * 3] = x;
        originalPositions[i * 3 + 1] = y;
        originalPositions[i * 3 + 2] = z;
      }

      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const material = new THREE.PointsMaterial({
        color: 0xe63946,
        size: isMobile ? 1.5 : 2,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      const targetPositions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        targetPositions[i * 3] = (Math.random() - 0.5) * 180;
        targetPositions[i * 3 + 1] = (Math.random() - 0.5) * 180;
        targetPositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
      }

      let progress = 0;
      const mouse = new THREE.Vector2(0, 0);
      const targetMouse = new THREE.Vector2(0, 0);

      const handleMouseMove = (e: MouseEvent) => {
        if (isMobile) return;
        targetMouse.x = (e.clientX / width) * 2 - 1;
        targetMouse.y = -(e.clientY / height) * 2 + 1;
      };

      window.addEventListener("mousemove", handleMouseMove);

      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener("resize", handleResize);

      const clock = new THREE.Clock();

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        const time = clock.getElapsedTime();
        const positions = particles.geometry.attributes.position.array as Float32Array;

        if (progress < 1) {
          progress += 0.01;
          const easeProgress = 1 - Math.pow(1 - progress, 3);

          for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = originalPositions[i * 3] + (targetPositions[i * 3] - originalPositions[i * 3]) * easeProgress;
            positions[i * 3 + 1] = originalPositions[i * 3 + 1] + (targetPositions[i * 3 + 1] - originalPositions[i * 3 + 1]) * easeProgress;
            positions[i * 3 + 2] = originalPositions[i * 3 + 2] + (targetPositions[i * 3 + 2] - originalPositions[i * 3 + 2]) * easeProgress;
          }

          material.opacity = 0.6 - 0.45 * easeProgress;
        } else {
          for (let i = 0; i < particleCount; i++) {
            const ix = i * 3;
            const iy = i * 3 + 1;

            positions[ix] += Math.sin(time + targetPositions[iy] * 0.1) * 0.05;
            positions[iy] += Math.cos(time + targetPositions[ix] * 0.1) * 0.05;
          }
        }

        if (!isMobile) {
          mouse.x += (targetMouse.x - mouse.x) * 0.05;
          mouse.y += (targetMouse.y - mouse.y) * 0.05;

          particles.rotation.y = mouse.x * 0.1;
          particles.rotation.x = -mouse.y * 0.1;
        }

        particles.geometry.attributes.position.needsUpdate = true;
        renderer.render(scene, camera);
      };

      animate();

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("resize", handleResize);
        cancelAnimationFrame(animationFrameId);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      };
    });
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
```

- [ ] **Step 2: `Hero`**

```tsx
"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useLocale, useTranslations } from "next-intl";
import { HeroParticles } from "@/components/webgl/hero-particles";
import { isMotionOk } from "@/lib/animations";

export function Hero() {
  const t = useTranslations("hero");
  const locale = useLocale();
  const containerRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subheadRef = useRef<HTMLParagraphElement>(null);
  const ctasRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    if (!isMotionOk()) {
      gsap.set([logoRef.current, headlineRef.current, subheadRef.current, ctasRef.current?.children], {
        opacity: 1,
        y: 0,
        clipPath: "none",
        yPercent: 0,
        scale: 1,
      });
      return;
    }

    const ctx = gsap.context(() => {
      if (!headlineRef.current) return;

      const split = new SplitText(headlineRef.current, { type: "chars,lines" });

      gsap.set(logoRef.current, { opacity: 0, scale: 0.6, y: 20 });
      gsap.set(split.chars, { yPercent: 110, clipPath: "inset(0 0 100% 0)" });
      gsap.set(subheadRef.current, { opacity: 0, y: 20 });
      if (ctasRef.current) gsap.set(ctasRef.current.children, { opacity: 0, y: 16 });

      const tl = gsap.timeline({ delay: 0.2 });

      tl.to(logoRef.current, { opacity: 1, scale: 1, y: 0, duration: 0.9, ease: "back.out(1.7)" })
        .to(
          split.chars,
          { yPercent: 0, clipPath: "inset(0 0 0% 0)", stagger: 0.025, duration: 1.1, ease: "power4.out" },
          "-=0.4",
        )
        .to(subheadRef.current, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, "-=0.5");

      if (ctasRef.current) {
        tl.to(ctasRef.current.children, { opacity: 1, y: 0, stagger: 0.1, duration: 0.6 }, "-=0.4");
      }

      gsap.to(logoRef.current, { y: -12, duration: 2.8, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 1.2 });

      return () => split.revert();
    }, containerRef);

    return () => ctx.revert();
    // Corre solo al montar: el título vuelve a montarse limpio con key={locale}
    // en vez de re-disparar esta animación en cada cambio de idioma.
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative w-full h-[100svh] bg-sweet-white flex flex-col items-center justify-center text-center px-6 overflow-hidden"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 60% at 50% 35%, rgba(230,57,70,0.07) 0%, transparent 70%)" }}
      />

      <HeroParticles />

      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center pt-16">
        <img
          ref={logoRef}
          src="/videologo.gif"
          alt="Sweet Sin mascot"
          className="w-36 h-36 md:w-48 md:h-48 object-contain rounded-full mb-4 drop-shadow-[0_20px_40px_rgba(230,57,70,0.4)]"
        />

        {/* key={locale}: SplitText muta el DOM de este <h1> a mano; sin la
            key, React reconciliaría el nuevo texto contra ese DOM ya
            modificado. Con la key, React lo desmonta y monta uno limpio. */}
        <h1
          key={locale}
          ref={headlineRef}
          className="font-serif font-black text-[clamp(40px,10vw,110px)] leading-[0.9] text-navy mb-6"
          style={{ textWrap: "balance" } as React.CSSProperties}
        >
          {t("headlinePrefix")}
          <span className="text-sin-red italic font-serif">{t("headlineHighlight")}</span>
          {t("headlineSuffix")}
        </h1>

        <p
          ref={subheadRef}
          className="font-serif font-light italic text-[clamp(16px,2vw,22px)] text-navy/55 max-w-xl mx-auto leading-relaxed mb-10 md:mb-14"
        >
          {t("subhead")}
        </p>

        <div ref={ctasRef} className="flex flex-col sm:flex-row items-center gap-4">
          <a
            href="#menu"
            className="bg-sin-red text-white px-8 py-4 rounded-full text-sm font-medium tracking-wide hover:bg-sin-red-light transition-all shadow-[0_8px_32px_rgba(230,57,70,0.22)] hover:shadow-[0_12px_40px_rgba(230,57,70,0.35)] hover:-translate-y-1 w-full sm:w-auto"
          >
            {t("ctaMenu")}
          </a>

          <a
            href="#story"
            className="text-navy/60 px-8 py-4 text-sm tracking-wide hover:text-navy transition-colors flex items-center gap-2 group w-full sm:w-auto justify-center"
          >
            {t("ctaStory")} <span className="group-hover:translate-y-1 transition-transform">↓</span>
          </a>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-[9px] tracking-[0.2em] text-navy/30 uppercase">
        {t("scrollHint")}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm run typecheck
git add -A
git commit -m "Migra Hero y HeroParticles a apps/web"
```

---

### Task 10: `apps/web` — `BrandStory`

**Files:**
- Create: `apps/web/src/components/sections/brand-story.tsx`

**Interfaces:**
- Consumes: `isMotionOk` (`@/lib/animations`), `useLocale`/`useTranslations` (`"next-intl"`).
- Produces: `BrandStory` — usado en la Tarea 15. Sección con `id="story"` (destino del link "Our story" del Hero).

- [ ] **Step 1: Implementación**

```tsx
"use client";

import { useRef, useLayoutEffect } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useLocale, useTranslations } from "next-intl";
import { isMotionOk } from "@/lib/animations";

export function BrandStory() {
  const t = useTranslations("brandStory");
  const locale = useLocale();
  const containerRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    if (!isMotionOk()) return;

    const ctx = gsap.context(() => {
      if (headlineRef.current) {
        const split = new SplitText(headlineRef.current, { type: "lines" });

        gsap.fromTo(
          split.lines,
          { clipPath: "inset(0 0 100% 0)", y: 24, opacity: 0 },
          {
            clipPath: "inset(0 0 0% 0)",
            y: 0,
            opacity: 1,
            stagger: 0.1,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: containerRef.current, start: "top 75%", once: true },
          },
        );
      }

      gsap.to(".story-image", {
        yPercent: 15,
        ease: "none",
        scrollTrigger: { trigger: containerRef.current, start: "top bottom", end: "bottom top", scrub: true },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="story" ref={containerRef} className="bg-cream text-navy py-[80px] md:py-[120px] px-6 md:px-12 w-full overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24 items-center">
        <div className="order-2 md:order-1 flex flex-col justify-center">
          <p className="font-mono text-[10px] tracking-[0.25em] text-sin-red uppercase mb-6">{t("eyebrow")}</p>

          {/* key={locale}: mismo motivo que en Hero — SplitText muta este <h2> a mano. */}
          <h2 key={locale} ref={headlineRef} className="font-serif text-[clamp(28px,4vw,48px)] font-bold leading-[1.05] mb-8">
            {t("headlineLine1")}
            <br />
            {t("headlineLine2")}
            <br />
            {t("headlineLine3Prefix")}
            <span className="text-sin-red italic">{t("headlineLine3Highlight")}</span>
            {t("headlineLine3Suffix")}
          </h2>

          <p className="text-[15px] leading-[1.7] text-navy/70 max-w-md">{t("body")}</p>
        </div>

        <div className="order-1 md:order-2 w-full aspect-[4/3] md:aspect-[3/4] relative rounded-2xl overflow-hidden bg-navy-mid flex items-center justify-center group story-image-wrapper">
          <div className="story-image absolute inset-[-10%] w-[120%] h-[120%] bg-navy-light/50 flex flex-col items-center justify-center">
            <div className="w-full h-full bg-[linear-gradient(45deg,rgba(15,27,61,0.8),rgba(15,27,61,0.2))] absolute inset-0 z-10" />
            <span className="relative z-20 text-white/10 group-hover:scale-110 transition-transform duration-700">
              <svg width="96" height="96" viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="10" width="52" height="22" rx="3" />
                <path d="M54 22 L62 22 L62 28 L54 28 Z" />
                <path d="M54 22 L58 14 L62 14 L62 22" />
                <rect x="8" y="14" width="10" height="8" rx="1.5" />
                <rect x="22" y="14" width="10" height="8" rx="1.5" />
                <rect x="36" y="14" width="10" height="8" rx="1.5" />
                <rect x="57" y="17" width="3" height="4" rx="1" />
                <circle cx="14" cy="32" r="5" />
                <circle cx="14" cy="32" r="2" />
                <circle cx="46" cy="32" r="5" />
                <circle cx="46" cy="32" r="2" />
                <circle cx="58" cy="32" r="4" />
                <circle cx="58" cy="32" r="1.5" />
                <path d="M20 10 L20 5 L44 5 L44 10" />
                <path d="M20 5 L32 2 L44 5" />
              </svg>
            </span>
            <span className="relative z-20 font-mono text-[10px] tracking-[0.15em] text-white/30 uppercase mt-4">
              {t("imageCaption")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm run typecheck
git add -A
git commit -m "Migra BrandStory a apps/web"
```

---

### Task 11: `apps/web` — `Menu` (catálogo real desde Postgres)

**Files:**
- Create: `apps/web/src/components/sections/menu.tsx` (Server Component), `apps/web/src/components/sections/menu-grid.tsx` (Client Component)

**Interfaces:**
- Consumes: `listAvailableProducts` (`@workspace/domain/products`), `DrizzleProductRepository` (`@workspace/db/repositories`), `useLocale`/`useTranslations` (`"next-intl"`), `isMotionOk`.
- Produces: `Menu` — usado en la Tarea 15.

- [ ] **Step 1: Server Component — fetch de productos**

`apps/web/src/components/sections/menu.tsx`:

```tsx
import { listAvailableProducts } from "@workspace/domain/products";
import { DrizzleProductRepository } from "@workspace/db/repositories";
import { MenuGrid } from "./menu-grid";

export async function Menu() {
  const products = await listAvailableProducts(new DrizzleProductRepository());
  return <MenuGrid products={products} />;
}
```

- [ ] **Step 2: Client Component — filtro, grid, animación**

`apps/web/src/components/sections/menu-grid.tsx`:

```tsx
"use client";

import { useState, useRef, useLayoutEffect } from "react";
import gsap from "gsap";
import Image from "next/image";
import type { Product, ProductCategory } from "@workspace/domain/products";
import { useLocale, useTranslations } from "next-intl";
import { isMotionOk } from "@/lib/animations";

type Filter = "all" | ProductCategory;

export function MenuGrid({ products }: { products: Product[] }) {
  const t = useTranslations("menu");
  const locale = useLocale();
  const [filter, setFilter] = useState<Filter>("all");
  const containerRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const filterLabels: Record<Filter, string> = {
    all: t("filterAll"),
    sin: t("filterSin"),
    virtue: t("filterVirtue"),
    coffee: t("filterCoffee"),
  };

  const displayedProducts = products.filter((p) => filter === "all" || p.category === filter);

  useLayoutEffect(() => {
    if (!isMotionOk() || !gridRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".menu-card",
        { y: 48, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.06,
          duration: 0.7,
          ease: "power2.out",
          scrollTrigger: { trigger: containerRef.current, start: "top 78%", once: true },
        },
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  useLayoutEffect(() => {
    if (!isMotionOk() || !gridRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".menu-card",
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 0.35, stagger: 0.04, ease: "power2.out" },
      );
    }, gridRef);
    return () => ctx.revert();
  }, [filter]);

  return (
    <section id="menu" ref={containerRef} className="bg-cream py-[80px] md:py-[120px] px-6 md:px-12 w-full min-h-screen">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-10 md:mb-16 gap-6">
          <div>
            <p className="font-mono text-[10px] tracking-[0.25em] text-sin-red uppercase mb-4">{t("eyebrow")}</p>
            <h2 className="font-serif text-[clamp(28px,4vw,48px)] font-bold text-navy leading-[1.05]">
              {t("headlinePrefix")}
              <span className="text-sin-red italic">{t("headlineHighlight")}</span>
            </h2>
          </div>

          <div className="flex bg-navy/[0.06] p-1 rounded-full w-max">
            {(Object.keys(filterLabels) as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2 rounded-full font-mono text-[10px] uppercase tracking-wider transition-all duration-300 ${
                  filter === f ? "bg-sin-red text-white shadow-lg" : "text-navy/40 hover:text-navy"
                }`}
              >
                {filterLabels[f]}
              </button>
            ))}
          </div>
        </div>

        {displayedProducts.length === 0 ? (
          <p className="text-navy/50 text-sm font-mono">{t("emptyState")}</p>
        ) : (
          <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {displayedProducts.map((product) => (
              <MenuCard key={product.id} product={product} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MenuCard({ product, locale }: { product: Product; locale: "en" | "es" }) {
  const name = locale === "en" ? product.nameEn : product.nameEs;
  const description = locale === "en" ? product.descriptionEn : product.descriptionEs;
  const price = (product.priceCents / 100).toFixed(2);

  return (
    <div className="menu-card bg-white border border-navy/[0.07] rounded-2xl overflow-hidden group transition-all duration-300 hover:border-sin-red/30 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(230,57,70,0.10)] flex flex-col">
      <div className="aspect-square bg-cream-dark relative overflow-hidden">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cream to-cream-dark" />
        )}

        <div
          className={`absolute top-2 left-2 px-2 py-0.5 rounded-full font-mono text-[8px] md:text-[9px] tracking-[0.12em] uppercase z-20 ${
            product.category === "sin" ? "bg-sin-red/90 text-white" : "bg-navy/90 text-cream"
          }`}
        >
          {product.category}
        </div>
      </div>

      <div className="p-3 md:p-5 flex flex-col flex-1 gap-2">
        <div>
          <h3 className="font-serif font-bold text-[14px] md:text-[18px] text-navy leading-tight">{name}</h3>
          <p className="text-[11px] md:text-[13px] text-navy/45 leading-relaxed mt-1 hidden md:block">{description}</p>
        </div>

        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="font-mono text-[13px] md:text-[16px] text-sin-red font-semibold">${price}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar el `next.config.ts` para imágenes locales**

Las imágenes son locales (`/products/*.jpg`, servidas desde `apps/web/public`), no remotas — `next/image` las optimiza sin configuración adicional en `next.config.ts`.

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm run typecheck
git add -A
git commit -m "Migra Menu a apps/web con catalogo real desde Postgres"
```

---

### Task 12: `apps/web` — `FindUs` (paradas reales + mapa)

**Files:**
- Create: `apps/web/src/lib/google-maps.ts`, `apps/web/src/components/ui/location-map.tsx`, `apps/web/src/components/sections/find-us.tsx` (Server Component), `apps/web/src/components/sections/find-us-client.tsx` (Client Component)

**Interfaces:**
- Consumes: `listActiveTrailerStops` (`@workspace/domain/trailer-stops`), `DrizzleTrailerStopRepository` (`@workspace/db/repositories`), `useLocale`/`useTranslations` (`"next-intl"`).
- Produces: `FindUs` — usado en la Tarea 15.

- [ ] **Step 1: `lib/google-maps.ts`**

```ts
import { setOptions } from "@googlemaps/js-api-loader";

let optionsSet = false;

export function ensureGoogleMapsOptionsSet(): boolean {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return false;
  if (!optionsSet) {
    setOptions({ key: apiKey, v: "weekly" });
    optionsSet = true;
  }
  return true;
}
```

- [ ] **Step 2: `LocationMap`**

`apps/web/src/components/ui/location-map.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary } from "@googlemaps/js-api-loader";
import { useTranslations } from "next-intl";
import { ensureGoogleMapsOptionsSet } from "@/lib/google-maps";

interface LocationMapProps {
  lat: number;
  lng: number;
  label: string;
  className?: string;
}

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0F1B3D" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0F1B3D" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8fa3d6" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#253D78" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1A2F5F" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#E63946" }, { weight: 0.4 }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#E63946" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#B82B36" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#080E22" }] },
];

export function LocationMap({ lat, lng, label, className }: LocationMapProps) {
  const t = useTranslations("findUs");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !ensureGoogleMapsOptionsSet()) return;
    let cancelled = false;

    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(([{ Map }, { Marker }]) => {
        if (cancelled || !containerRef.current) return;

        mapRef.current = new Map(containerRef.current, {
          center: { lat, lng },
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          styles: MAP_STYLES,
        });

        markerRef.current = new Marker({
          position: { lat, lng },
          map: mapRef.current,
          title: label,
          icon: {
            url: "/devil-icon.png",
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 38),
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    mapRef.current.panTo({ lat, lng });
    markerRef.current.setPosition({ lat, lng });
    markerRef.current.setTitle(label);
  }, [lat, lng, label]);

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || failed) {
    return (
      <div className={className}>
        <div className="w-full h-full flex items-center justify-center text-navy/40 text-sm font-mono uppercase tracking-widest">
          {t("mapUnavailable")}
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}
```

- [ ] **Step 3: Server Component — fetch de paradas**

`apps/web/src/components/sections/find-us.tsx`:

```tsx
import { listActiveTrailerStops } from "@workspace/domain/trailer-stops";
import { DrizzleTrailerStopRepository } from "@workspace/db/repositories";
import { FindUsClient } from "./find-us-client";

export async function FindUs() {
  const stops = await listActiveTrailerStops(new DrizzleTrailerStopRepository());
  return <FindUsClient stops={stops} />;
}
```

- [ ] **Step 4: Client Component**

`apps/web/src/components/sections/find-us-client.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import type { TrailerStop } from "@workspace/domain/trailer-stops";
import { useLocale, useTranslations } from "next-intl";
import { LocationMap } from "@/components/ui/location-map";

function formatStopSchedule(stop: TrailerStop, locale: "en" | "es"): { day: string; timeRange: string } {
  const day = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "Australia/Adelaide" }).format(
    stop.startTime,
  );
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Adelaide",
  });

  return {
    day: day.charAt(0).toUpperCase() + day.slice(1),
    timeRange: `${timeFormatter.format(stop.startTime)} – ${timeFormatter.format(stop.endTime)}`,
  };
}

export function FindUsClient({ stops }: { stops: TrailerStop[] }) {
  const t = useTranslations("findUs");
  const locale = useLocale();
  const [selectedStop, setSelectedStop] = useState<TrailerStop | null>(stops[0] ?? null);

  return (
    <section id="find-us" className="bg-sweet-white py-[80px] md:py-[120px] px-6 md:px-12">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
        <div>
          <p className="font-mono text-[10px] tracking-[0.25em] text-sin-red uppercase mb-4">{t("eyebrow")}</p>
          <h2 className="font-serif text-[clamp(32px,4vw,48px)] font-black text-navy leading-[1.0] mb-6">
            {t("headline")}
          </h2>
          <p className="text-[15px] text-navy/50 max-w-md leading-[1.7] mb-10">{t("subhead")}</p>

          {stops.length === 0 ? (
            <p className="text-navy/50 text-sm font-mono mb-12">{t("noStops")}</p>
          ) : (
            <div className="space-y-2 mb-12">
              {stops.map((stop) => {
                const schedule = formatStopSchedule(stop, locale);
                return (
                  <button
                    key={stop.id}
                    onClick={() => setSelectedStop(stop)}
                    className={`w-full flex justify-between items-center py-4 border-b transition-colors text-left ${
                      selectedStop?.id === stop.id ? "border-sin-red/30" : "border-navy/[0.07] hover:border-navy/20"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          stop.status === "active" ? "bg-sin-red animate-pulse" : "bg-navy/20"
                        }`}
                      />
                      <div>
                        <span
                          className={`block text-sm font-medium ${
                            selectedStop?.id === stop.id ? "text-sin-red" : "text-navy"
                          }`}
                        >
                          {schedule.day}
                        </span>
                        <span className="block text-xs text-navy/40 mt-1">{schedule.timeRange}</span>
                      </div>
                    </div>
                    <div className="text-sm text-navy/70 text-right max-w-[150px] md:max-w-none">{stop.location}</div>
                  </button>
                );
              })}
            </div>
          )}

          <NewsletterForm />
        </div>

        <div className="flex flex-col gap-6">
          <div className="w-full h-[300px] md:h-[400px] bg-cream rounded-2xl relative overflow-hidden border border-navy/[0.08]">
            {selectedStop ? (
              <>
                <LocationMap
                  lat={selectedStop.lat}
                  lng={selectedStop.lng}
                  label={selectedStop.location}
                  className="absolute inset-0"
                />
                <div className="absolute bottom-4 left-4 pointer-events-none">
                  <span className="font-mono text-[9px] tracking-widest text-white px-2 py-1 bg-black/50 rounded backdrop-blur-sm uppercase">
                    {selectedStop.location}
                  </span>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-navy/40 text-sm font-mono uppercase tracking-widest">
                {t("mapUnavailable")}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <a
                key={i}
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="aspect-square bg-cream-dark relative rounded-xl overflow-hidden group border border-navy/[0.07] flex items-center justify-center hover:border-sin-red/30 transition-colors"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-navy/25 group-hover:text-sin-red/60 transition-colors"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4.5" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function NewsletterForm() {
  const t = useTranslations("findUs");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const successIconRef = useRef<HTMLSpanElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputRef.current?.value) return;

    setStatus("submitting");
    setTimeout(() => {
      setStatus("success");
      if (successIconRef.current) {
        gsap.fromTo(
          successIconRef.current,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.5)" },
        );
      }
    }, 800);
  };

  return (
    <form onSubmit={handleSubmit} className="relative max-w-sm">
      {status === "success" ? (
        <div className="flex items-center gap-3 text-sin-red bg-sin-red/10 border border-sin-red/20 px-6 py-4 rounded-full">
          <span ref={successIconRef} className="flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="text-sm font-medium">{t("newsletterSuccess")}</span>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="email"
            placeholder={t("newsletterPlaceholder")}
            required
            disabled={status === "submitting"}
            className="w-full bg-white border border-navy/12 rounded-full px-6 py-4 text-sm text-navy placeholder:text-navy/35 focus:border-sin-red outline-none transition-colors pr-16 disabled:opacity-50 shadow-sm"
          />
          <button
            type="submit"
            disabled={status === "submitting"}
            className="absolute right-2 top-2 bottom-2 aspect-square bg-sin-red text-white rounded-full flex items-center justify-center hover:bg-sin-red-light transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      )}
    </form>
  );
}
```

Nota: el newsletter sigue siendo un mock front-end (igual que en `apps/web-legacy` — no hay caso de uso de dominio para suscripciones todavía). No es una regresión: mantiene exactamente el mismo comportamiento que tenía en producción.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm run typecheck
git add -A
git commit -m "Migra FindUs a apps/web con paradas reales y mapa de Google"
```

---

### Task 13: `apps/web` — `Events` (Server Action real)

**Files:**
- Create: `apps/web/src/app/actions/event-bookings.ts`, `apps/web/src/components/sections/events.tsx`

**Interfaces:**
- Consumes: `requestEventQuote` (`@workspace/domain/event-bookings`), `DrizzleEventBookingRepository` (`@workspace/db/repositories`), `useTranslations` (`"next-intl"`), `isMotionOk`.
- Produces: `Events` — usado en la Tarea 15.

- [ ] **Step 1: Server Action**

`apps/web/src/app/actions/event-bookings.ts`:

```ts
"use server";

import { z } from "zod";
import { requestEventQuote } from "@workspace/domain/event-bookings";
import { DrizzleEventBookingRepository } from "@workspace/db/repositories";

const eventQuoteSchema = z.object({
  name: z.string().trim().min(1),
  company: z.string().trim().optional(),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1),
  type: z.enum(["corporate", "wedding", "festival", "other"]),
  date: z.string().trim().min(1),
  guests: z.coerce.number().int().min(20),
  message: z.string().trim().min(1),
});

export interface EventQuoteFormState {
  status: "idle" | "success" | "error";
}

// Ubicación y horario exactos no se piden en este formulario (igual que el
// legacy, que tampoco los pedía) — se guardan como placeholder de "día
// completo, a confirmar" hasta que Oscar cierre esos detalles al cotizar
// (Fase 5). No afecta a `findOverlapping`: solo mira reservas `confirmed`,
// y esto entra como `quote_requested`.
export async function requestEventQuoteAction(
  _prevState: EventQuoteFormState,
  formData: FormData,
): Promise<EventQuoteFormState> {
  const parsed = eventQuoteSchema.safeParse({
    name: formData.get("name"),
    company: formData.get("company") || undefined,
    email: formData.get("email"),
    phone: formData.get("phone"),
    type: formData.get("type"),
    date: formData.get("date"),
    guests: formData.get("guests"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return { status: "error" };
  }

  const eventDate = new Date(`${parsed.data.date}T00:00:00`);
  if (Number.isNaN(eventDate.getTime())) {
    return { status: "error" };
  }

  const endOfDay = new Date(`${parsed.data.date}T23:59:59`);

  try {
    await requestEventQuote(new DrizzleEventBookingRepository(), {
      clientName: parsed.data.name,
      clientCompany: parsed.data.company ?? null,
      clientEmail: parsed.data.email,
      clientPhone: parsed.data.phone,
      eventType: parsed.data.type,
      eventDate,
      startTime: eventDate,
      endTime: endOfDay,
      location: "TBD",
      estimatedGuests: parsed.data.guests,
      notes: parsed.data.message,
    });
    return { status: "success" };
  } catch {
    return { status: "error" };
  }
}
```

- [ ] **Step 2: `Events`**

```tsx
"use client";

import { useState, useRef, useLayoutEffect, useActionState } from "react";
import gsap from "gsap";
import { useTranslations } from "next-intl";
import { isMotionOk } from "@/lib/animations";
import { requestEventQuoteAction, type EventQuoteFormState } from "@/app/actions/event-bookings";

export function Events() {
  const t = useTranslations("events");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!isMotionOk()) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".event-card",
        { y: 32, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.08,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: { trigger: containerRef.current, start: "top 85%", once: true },
        },
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="events" ref={containerRef} className="bg-sweet-white py-[80px] md:py-[120px] px-6 md:px-12">
      <div className="max-w-[1200px] mx-auto">
        <div className="text-center mb-16">
          <p className="font-mono text-[10px] tracking-[0.25em] text-sin-red uppercase mb-4">{t("eyebrow")}</p>
          <h2 className="font-serif text-[clamp(32px,5vw,48px)] font-black text-navy leading-[1.05] mb-4">
            {t("headlinePrefix")}
            <span className="text-sin-red italic">{t("headlineHighlight")}</span>
            {t("headlineSuffix")}
          </h2>
          <p className="text-[15px] text-navy/45 max-w-lg mx-auto">{t("subhead")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <EventCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2.5" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                <line x1="2" y1="12" x2="22" y2="12" />
              </svg>
            }
            title={t("cardCorporateTitle")}
            desc={t("cardCorporateDesc")}
          />
          <EventCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 L6 9 h12 Z" />
                <path d="M6 9 L5 15 C5 18.5 8 21 12 21 C16 21 19 18.5 19 15 L18 9" />
                <path d="M9 9 L7.5 4 M15 9 L16.5 4" />
              </svg>
            }
            title={t("cardWeddingsTitle")}
            desc={t("cardWeddingsDesc")}
          />
          <EventCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9 L12 3 L21 9 V10 H3 V9Z" />
                <line x1="3" y1="10" x2="3" y2="20" />
                <line x1="21" y1="10" x2="21" y2="20" />
                <line x1="3" y1="20" x2="21" y2="20" />
                <line x1="8" y1="20" x2="8" y2="14" />
                <line x1="16" y1="20" x2="16" y2="14" />
                <rect x="8" y="14" width="8" height="6" rx="1" />
              </svg>
            }
            title={t("cardFestivalsTitle")}
            desc={t("cardFestivalsDesc")}
          />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-6">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-sin-red text-white px-8 py-4 rounded-full text-sm font-bold tracking-wide hover:bg-sin-red-light transition-colors w-full md:w-auto shadow-[0_4px_20px_rgba(230,57,70,0.25)] flex items-center justify-center gap-2"
          >
            {t("ctaGetQuote")}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>

          <a
            href="https://wa.me/61433508831?text=Hola%21%20Me%20interesa%20Sweet%20Sin%20para%20un%20evento.%20%C2%BFPodr%C3%ADan%20darme%20m%C3%A1s%20informaci%C3%B3n%3F"
            target="_blank"
            rel="noreferrer"
            className="md:hidden border border-navy/20 text-navy px-8 py-4 rounded-full text-sm tracking-wide flex items-center justify-center gap-2 w-full"
          >
            {t("ctaWhatsApp")}
          </a>
        </div>
      </div>

      <QuoteModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </section>
  );
}

function EventCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="event-card bg-white rounded-[20px] p-8 shadow-[0_2px_20px_rgba(15,27,61,0.07)] hover:shadow-[0_8px_32px_rgba(230,57,70,0.10)] hover:-translate-y-1 transition-all duration-300 border border-navy/[0.05]">
      <div className="mb-6 bg-sin-red/[0.08] w-14 h-14 rounded-xl flex items-center justify-center border border-sin-red/[0.15] text-sin-red">
        {icon}
      </div>
      <h3 className="font-serif font-bold text-[20px] text-navy mb-3">{title}</h3>
      <p className="text-[14px] text-navy/50 leading-[1.7]">{desc}</p>
    </div>
  );
}

function QuoteModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const t = useTranslations("events");
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [state, formAction, isPending] = useActionState<EventQuoteFormState, FormData>(requestEventQuoteAction, {
    status: "idle",
  });

  useLayoutEffect(() => {
    if (!isOpen) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.fromTo(
      modalRef.current,
      { scaleY: 0, opacity: 0, transformOrigin: "center center" },
      { scaleY: 1, opacity: 1, duration: 0.4, ease: "back.out(1.2)" },
    );
  }, [isOpen]);

  const handleClose = () => {
    gsap.to(modalRef.current, { scaleY: 0, opacity: 0, duration: 0.3, ease: "power2.in" });
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.3, onComplete: onClose });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div ref={overlayRef} className="absolute inset-0 modal-overlay" onClick={handleClose} />

      <div ref={modalRef} className="relative bg-white w-full max-w-lg rounded-3xl border border-navy/[0.08] p-6 md:p-10 shadow-[0_24px_80px_rgba(15,27,61,0.18)] overflow-y-auto max-h-[90vh]">
        <button onClick={handleClose} aria-label={t("formClose")} className="absolute top-6 right-6 text-navy/30 hover:text-navy transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {state.status === "success" ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-sin-red/10 text-sin-red rounded-full flex items-center justify-center mx-auto mb-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h3 className="font-serif text-2xl text-navy mb-2">{t("formSuccessTitle")}</h3>
            <p className="text-navy/45 text-sm">{t("formSuccessBody")}</p>
            <button onClick={handleClose} className="mt-8 bg-navy/8 text-navy px-6 py-3 rounded-full text-sm hover:bg-navy/12 transition-colors">
              {t("formClose")}
            </button>
          </div>
        ) : (
          <>
            <h3 className="font-serif text-3xl font-bold text-navy mb-2">{t("formTitle")}</h3>
            <p className="text-navy/45 text-sm mb-8">{t("formSubtitle")}</p>

            <form action={formAction} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="quote-name" className="block text-[10px] font-mono text-navy/40 uppercase tracking-widest">
                    {t("formName")}
                  </label>
                  <input id="quote-name" name="name" required className="w-full bg-cream border border-navy/10 rounded-xl px-4 py-3 text-navy text-sm focus:border-sin-red outline-none transition-colors placeholder:text-navy/30" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="quote-company" className="block text-[10px] font-mono text-navy/40 uppercase tracking-widest">
                    {t("formCompany")}
                  </label>
                  <input id="quote-company" name="company" className="w-full bg-cream border border-navy/10 rounded-xl px-4 py-3 text-navy text-sm focus:border-sin-red outline-none transition-colors placeholder:text-navy/30" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="quote-type" className="block text-[10px] font-mono text-navy/40 uppercase tracking-widest">
                    {t("formEventType")}
                  </label>
                  <select id="quote-type" name="type" required defaultValue="" className="w-full bg-cream border border-navy/10 rounded-xl px-4 py-3 text-navy text-sm focus:border-sin-red outline-none transition-colors appearance-none">
                    <option value="" disabled>{t("formEventTypeSelect")}</option>
                    <option value="corporate">{t("formEventTypeCorporate")}</option>
                    <option value="wedding">{t("formEventTypeWedding")}</option>
                    <option value="festival">{t("formEventTypeFestival")}</option>
                    <option value="other">{t("formEventTypeOther")}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="quote-date" className="block text-[10px] font-mono text-navy/40 uppercase tracking-widest">
                    {t("formDate")}
                  </label>
                  <input id="quote-date" name="date" required type="date" className="w-full bg-cream border border-navy/10 rounded-xl px-4 py-3 text-navy text-sm focus:border-sin-red outline-none transition-colors [color-scheme:light]" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="quote-guests" className="block text-[10px] font-mono text-navy/40 uppercase tracking-widest">
                  {t("formGuests")}
                </label>
                <input id="quote-guests" name="guests" required type="number" min="20" placeholder={t("formGuestsPlaceholder")} className="w-full bg-cream border border-navy/10 rounded-xl px-4 py-3 text-navy text-sm focus:border-sin-red outline-none transition-colors placeholder:text-navy/30" />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="quote-message" className="block text-[10px] font-mono text-navy/40 uppercase tracking-widest">
                  {t("formMessage")}
                </label>
                <textarea id="quote-message" name="message" required rows={3} placeholder={t("formMessagePlaceholder")} className="w-full bg-cream border border-navy/10 rounded-xl px-4 py-3 text-navy text-sm focus:border-sin-red outline-none transition-colors resize-none placeholder:text-navy/30" />
              </div>

              {state.status === "error" && <p className="text-sin-red text-xs font-mono">{t("formError")}</p>}

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-sin-red text-white font-bold text-sm py-4 rounded-xl hover:bg-sin-red-light transition-colors mt-4 disabled:opacity-50 shadow-[0_4px_16px_rgba(230,57,70,0.25)]"
              >
                {isPending ? t("formSubmitting") : t("formSubmit")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm run typecheck
git add -A
git commit -m "Migra Events con Server Action real para cotizaciones de evento"
```

- [ ] **Step 4: Verificación manual de la escritura real (se completa junto con la Tarea 16)**

Queda pendiente confirmar con el sitio corriendo que una cotización enviada aparece como fila real en `event_bookings` — se hace en la Tarea 16 junto con el resto de la verificación end-to-end, para no levantar el dev server dos veces.

---

### Task 14: `apps/web` — `Footer`

**Files:**
- Create: `apps/web/src/components/sections/footer.tsx`

**Interfaces:**
- Consumes: `useTranslations` (`"next-intl"`).
- Produces: `Footer` — usado en la Tarea 15.

- [ ] **Step 1: Implementación**

Se elimina el link "Preorder" (`#preorder`, Fase 3 — la sección no existe todavía); el resto de los links se mantiene.

```tsx
"use client";

import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");

  return (
    <footer className="bg-navy py-12 md:py-20 px-6 md:px-12 border-t border-white/5">
      <div className="max-w-[1200px] mx-auto">
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 pb-12 border-b border-white/10">
          <div className="lg:col-span-2">
            <img src="/logo-flat.png" alt="Sweet Sin" className="h-20 w-auto rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.4)] mb-4" />
            <p className="font-serif text-[14px] italic text-cream/40 mb-6 whitespace-pre-line">{t("tagline")}</p>
            <div className="flex gap-4">
              <SocialIcon icon="Ig" />
              <SocialIcon icon="Tk" />
              <SocialIcon icon="Wa" href="https://wa.me/61433508831" />
            </div>
          </div>

          <div>
            <h3 className="font-mono text-[9px] tracking-[0.2em] uppercase text-cream/30 mb-6">{t("menuHeading")}</h3>
            <ul className="space-y-3">
              <li><a href="#menu" className="text-[13px] text-cream/60 hover:text-sin-red transition-colors">{t("sevenSins")}</a></li>
              <li><a href="#menu" className="text-[13px] text-cream/60 hover:text-sin-red transition-colors">{t("sevenVirtues")}</a></li>
              <li><a href="#menu" className="text-[13px] text-cream/60 hover:text-sin-red transition-colors">{t("laRepolla")}</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-mono text-[9px] tracking-[0.2em] uppercase text-cream/30 mb-6">{t("servicesHeading")}</h3>
            <ul className="space-y-3">
              <li><a href="#events" className="text-[13px] text-cream/60 hover:text-sin-red transition-colors">{t("eventsLink")}</a></li>
              <li><a href="#events" className="text-[13px] text-cream/60 hover:text-sin-red transition-colors">{t("weddingsLink")}</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-mono text-[9px] tracking-[0.2em] uppercase text-cream/30 mb-6">{t("findUsHeading")}</h3>
            <ul className="space-y-3">
              <li><a href="#story" className="text-[13px] text-cream/60 hover:text-sin-red transition-colors">{t("ourStory")}</a></li>
              <li><a href="#find-us" className="text-[13px] text-cream/60 hover:text-sin-red transition-colors">{t("schedule")}</a></li>
              <li><a href="https://wa.me/61433508831" target="_blank" rel="noopener noreferrer" className="text-[13px] text-cream/60 hover:text-sin-red transition-colors">{t("whatsapp")}</a></li>
            </ul>
          </div>
        </div>

        <div className="md:hidden pb-10 border-b border-white/10 flex flex-col items-center text-center gap-6">
          <img src="/logo-flat.png" alt="Sweet Sin" className="h-16 w-auto rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.4)]" />
          <p className="font-serif text-[13px] italic text-cream/40 whitespace-pre-line">{t("tagline")}</p>
          <div className="flex gap-4">
            <SocialIcon icon="Ig" />
            <SocialIcon icon="Tk" />
            <SocialIcon icon="Wa" href="https://wa.me/61433508831" />
          </div>
          <div className="flex gap-6 flex-wrap justify-center">
            <a href="#menu" className="text-[12px] text-cream/50 hover:text-sin-red transition-colors font-mono uppercase tracking-wider">{tNav("menu")}</a>
            <a href="#events" className="text-[12px] text-cream/50 hover:text-sin-red transition-colors font-mono uppercase tracking-wider">{tNav("events")}</a>
            <a href="#find-us" className="text-[12px] text-cream/50 hover:text-sin-red transition-colors font-mono uppercase tracking-wider">{tNav("findUs")}</a>
          </div>
        </div>

        <div className="pt-8 flex justify-center font-mono text-[10px] text-cream/20 tracking-wider">
          <p>© {new Date().getFullYear()} {t("copyright")}</p>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ icon, href = "#" }: { icon: string; href?: string }) {
  return (
    <a href={href} target={href !== "#" ? "_blank" : undefined} rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-cream/60 hover:text-white hover:bg-sin-red hover:border-sin-red transition-all">
      <span className="text-[12px] font-bold font-serif">{icon}</span>
    </a>
  );
}
```

El link "Order"/`#preorder` del footer mobile legacy se quita (mismo motivo que en el Navbar); el bloque mobile reutiliza el namespace `nav`, que ya cubre "Menu"/"Events"/"Find Us" en ambos idiomas.

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm run typecheck
git add -A
git commit -m "Migra Footer a apps/web"
```

---

### Task 15: `apps/web` — ensamblar la home real

**Files:**
- Modify: `apps/web/src/app/[locale]/page.tsx`

**Interfaces:**
- Consumes: `Navbar`, `MobileNav`, `Hero`, `BrandStory`, `Menu`, `Events`, `FindUs`, `Footer`.

- [ ] **Step 1: Reemplazar el placeholder de la Tarea 7**

```tsx
import { setRequestLocale } from "next-intl/server";
import { Navbar } from "@/components/layout/navbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Hero } from "@/components/sections/hero";
import { BrandStory } from "@/components/sections/brand-story";
import { Menu } from "@/components/sections/menu";
import { Events } from "@/components/sections/events";
import { FindUs } from "@/components/sections/find-us";
import { Footer } from "@/components/sections/footer";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="w-full min-h-screen bg-sweet-dark text-cream selection:bg-sin-red selection:text-white pb-14 md:pb-0">
      <Navbar />
      <Hero />
      <BrandStory />
      <Menu />
      <Events />
      <FindUs />
      <Footer />
      <MobileNav />
    </main>
  );
}
```

`Menu` y `FindUs` son Server Components async (Tareas 11 y 12) — usarlos como `<Menu />`/`<FindUs />` dentro de otro Server Component (`page.tsx`, sin `"use client"`) es válido en el App Router. `setRequestLocale(locale)` ya se llamó una vez en `[locale]/layout.tsx` (Tarea 7) — repetirlo acá es la recomendación oficial de `next-intl` para cualquier segmento que use traducciones, por si Next decide optimizar/cachear esta ruta de forma independiente en el futuro. `pb-14 md:pb-0` en el `<main>` reserva el espacio que `MobileNav` (fixed, `h-14`, solo visible bajo `md`) tapa en mobile — sin este padding, el final del `Footer` queda parcialmente oculto detrás de la barra fija al hacer scroll hasta abajo.

- [ ] **Step 2: Typecheck + build**

```bash
pnpm run typecheck
pnpm run build
```

Expected: ambos limpios — `next build` debe compilar las rutas para ambos locales (`generateStaticParams` en el layout devuelve `en` y `es`; `en` se sirve en `/`, `es` en `/es`) con `Menu`/`FindUs` resolviendo datos reales en build/runtime según corresponda (son Server Components dinámicos por depender de la DB, Next los deja como server-rendered on request, no estáticos).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Ensambla la home real de apps/web en app/[locale]/page.tsx"
```

---

### Task 16: Verificación end-to-end de Fase 2 + actualizar `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** N/A.

- [ ] **Step 1: Typecheck, tests y build completos**

```bash
pnpm run typecheck
pnpm run test
pnpm run build
```

Expected: los tres limpios. `pnpm run test` corre ahora `packages/domain`, `packages/db` y `packages/i18n` (los tres tienen script `test`).

- [ ] **Step 2: Levantar el sitio y verificar manualmente**

```bash
pnpm --filter @workspace/web run dev
```

Abrir `http://localhost:3000/` (sin `curl -L` ni seguir redirects, o revisando la pestaña Network) y confirmar que sirve inglés directamente en la URL raíz, **sin redirect** — verificación clave del pedido del owner de no perder link equity en `/`. Luego:
- El catálogo (`#menu`) muestra los 16 productos sembrados, con imagen, nombre y precio.
- El botón de idioma en el Navbar navega a `/es` (URL real, no solo un toggle de estado) y cambia nombre/descripción de productos y todo el copy de chrome (headlines, labels, footer), sin romper las animaciones de `Hero`/`BrandStory` al cambiar. Desde `/es`, el mismo botón vuelve a `/` (no a `/en`).
- Visitar `/es` directamente (sin pasar por el botón) también sirve la versión en español — confirma que el routing por locale funciona independientemente del toggle.
- Si el navegador/perfil usado para probar tiene el idioma configurado en español, visitar `/` en una ventana privada nueva (sin cookie de locale todavía) y confirmar el redirect 307 a `/es` — es el comportamiento esperado de `localeDetection` (default `true`), no un bug.
- `#find-us` muestra las 3 paradas sembradas con horario formateado en el idioma activo, y el mapa carga (o muestra el fallback "Map unavailable"/"Mapa no disponible" si `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` no llegó a `apps/web/.env.local`).
- Enviar el formulario de "Get a quote" en `#events` con datos de prueba y confirmar el mensaje de éxito.
- Con el DevTools en modo mobile (`md` para abajo), confirmar que `MobileNav` queda fija abajo, sus 4 tabs navegan a las secciones correctas (incluido "Order" → `#menu`), se oculta al scrollear hacia abajo y reaparece al scrollear hacia arriba, y el `Footer` no queda tapado por la barra al llegar al final de la página.
- Ver el `<head>` (o el HTML fuente) de `/` y confirmar los `<link rel="alternate" hreflang="...">` apuntando a `/` (en) y `/es`.

- [ ] **Step 3: Confirmar la escritura real de la cotización de evento**

```bash
pnpm --filter @workspace/db exec drizzle-kit studio
```

Abrir la tabla `event_bookings` y confirmar que la fila de prueba del Step 2 aparece con `status = 'quote_requested'`.

- [ ] **Step 4: Actualizar `CLAUDE.md`**

En [CLAUDE.md](../../../CLAUDE.md):

En "Run & Operate", agregar después de la línea de `pnpm --filter @workspace/db run push`:

```
- `pnpm --filter @workspace/db run seed` — carga/actualiza el contenido real de `products` y `trailer_stops` (idempotente; no crea duplicados)
```

En "Run & Operate", en la línea de "Required env", agregar:

```
`apps/web` también necesita `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (`apps/web/.env.local`, gitignored) para el mapa de FindUs — mismo valor que `VITE_GOOGLE_MAPS_API_KEY` en `apps/web-legacy/.env`.
```

En "Where things live", agregar una línea nueva después de `packages/domain`:

```
- `packages/i18n` — diccionarios ES/EN framework-free (sin lógica de UI, sin `next-intl`). Consumidos como `messages` de `next-intl` en `apps/web`; se reutilizan tal cual (los datos, no `next-intl`) en el panel admin (Fase 4) y en `apps/mobile` (Fase 7, con su propio adaptador nativo).
```

En "Architecture decisions", agregar una viñeta nueva:

```
- **i18n:** `packages/i18n` solo expone diccionarios framework-free (datos puros). `apps/web` los consume con `next-intl` y routing por locale: `en` (default) en la raíz limpia `/` sin prefijo ni redirect (`localePrefix: "as-needed"`, preserva el link equity del dominio), `es` explícito en `/es` — decisión del owner (2026-09-12) por SEO bilingüe indexable (URLs y `hreflang` propios por idioma) y por aprovechar el SSR de los Server Components de Next 15, en vez de un Context client-side con `localStorage`. `apps/mobile` (Fase 7) no usa `next-intl` — consume los mismos diccionarios de `packages/i18n` con su propio adaptador nativo.
```

En "Product", reemplazar la línea placeholder por:

```
Sitio público bilingüe de Sweet Sin (inglés en la raíz `/`, español en `/es`): hero, catálogo de 16 postres reales (paradas y precios desde Postgres), historia de marca, ubicaciones activas del trailer con mapa en vivo, y un formulario de cotización de eventos que persiste la solicitud real. Sin cuenta de cliente, carrito ni checkout todavía (Fase 3). Panel admin todavía no existe (Fase 4).
```

En "Gotchas", agregar cuatro líneas nuevas:

```
- `packages/db/src/seed.ts` importa `./index`/`./schema` de forma dinámica (`await import(...)` dentro de `main()`), no estática — los imports de un módulo ES se hoistean por encima de cualquier otra sentencia, así que un `process.loadEnvFile()` puesto arriba de un import estático de `./index` no llega a correr antes de que ese import se evalúe (y reviente por falta de `DATABASE_URL`). Mismo síntoma que el gotcha de Vitest de más arriba, fix distinto porque acá no hay un archivo de config separado donde cargar el `.env` antes.
- GSAP `SplitText` (usado en `Hero`/`BrandStory`) mete sus propios `<span>` en el DOM del título de forma imperativa. El toggle de idioma navega a otra URL de locale y ese texto se re-renderiza — el elemento afectado por `SplitText` lleva `key={locale}` para forzar un remount limpio en vez de dejar que React reconcilie el nuevo texto contra un DOM que GSAP ya mutó por su cuenta.
- `videologo.gif` e `isotipo.gif` se sirven con `<img>` plano, no `next/image` — `next/image` optimiza GIFs a un frame estático salvo que se pase `unoptimized`, y ambos llevan además una animación GSAP propia sobre su `ref`.
- Next.js 16 renombró `middleware.ts` a `proxy.ts` — este proyecto está pineado a Next `^15.5.0` (ver más abajo), así que el archivo correcto sigue siendo `apps/web/src/middleware.ts`. Si se sube la versión de Next en el futuro, revisar la guía de migración de `next-intl` antes de renombrarlo.
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Verifica Fase 2 de punta a punta y actualiza CLAUDE.md"
```

---

### Task 17: Deploy a producción (EasyPanel)

**Files:** ninguno de código — `git push` + verificación en el panel de EasyPanel + actualización de `handoff.md`.

**Interfaces:** N/A.

Decisión del owner (2026-09-12): una fase no está completa hasta que el código está en producción — mismo criterio que cerró Fase 1. El copy en español sigue sin revisión de Oscar (Pregunta 4), pero el riesgo de exponerlo se acepta como marginal porque el idioma por defecto del sitio es inglés.

> ⚠️ **Antes de dar este deploy por exitoso, dos advertencias operativas — deteneme y avisame si alguna no se puede resolver:**
>
> 1. **`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` no viaja sola a producción.** `apps/web/.env.local` (Tarea 5) es un archivo local gitignored — EasyPanel no lo ve. El build en EasyPanel va a pasar igual sin la variable (Next.js no falla el build por una env var pública faltante), pero el mapa de `#find-us` va a fallar en silencio para cualquier visitante real, mostrando el fallback "Map unavailable" sin ningún error visible en los logs de build. **Antes de validar el deploy, el owner tiene que inyectar `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` manualmente en la configuración del servicio `apps/web` en el panel de EasyPanel** (mismo valor que ya está en `apps/web/.env.local`) y redeployar si hace falta.
> 2. **El servicio `apps/api` de EasyPanel sigue roto**, arrastrado del cierre de Fase 1 (build fallando con "Dockerfile no existe" — `apps/api` se eliminó del repo en Fase 1 y ese servicio en EasyPanel nunca se pausó/eliminó). Sigue fuera de mi alcance resolverlo — es infraestructura manual del owner. Se re-documenta acá para que no se pierda entre el resto de cambios de esta fase; el Step 4 de esta tarea lo deja otra vez explícito en `handoff.md`.

- [ ] **Step 1: Push**

```bash
git push
```

Este comando lo corre el owner en su propia terminal (o lo autoriza explícitamente en el momento) — igual que los commits de cada tarea, no es algo que se ejecute por defecto sin confirmación puntual.

- [ ] **Step 2: Confirmar la variable de Google Maps en EasyPanel**

Antes de seguir: confirmar con el owner que ya inyectó `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` en la configuración del servicio `apps/web` en EasyPanel (ver advertencia #1 arriba). Si todavía no lo hizo, esperar acá — no tiene sentido validar el deploy sin esto, porque el síntoma (mapa roto) no aparece en los logs de build, solo se nota probando el sitio real.

- [ ] **Step 3: Verificar el build y el sitio en producción**

Revisar el log de build del servicio `apps/web` en EasyPanel — Expected: build limpio, sin errores de `next-intl`/middleware/`[locale]`. Después, abrir el dominio real y confirmar:
- La raíz (`/`) sirve el catálogo real en inglés, sin redirect visible.
- `/es` sirve la versión en español.
- El mapa de `#find-us` carga de verdad (no el fallback) — confirma que el Step 2 se aplicó bien.
- El formulario de `#events` funciona contra la DB de producción real (es la misma DB que se usó en todas las tareas anteriores, así que ya venía probado — este es solo un smoke test final).

- [ ] **Step 4: Dejar el pendiente de `apps/api` explícito en `handoff.md`**

Al regenerar `handoff.md` al cerrar la sesión (regla de `CLAUDE.md`, ver nota de proceso más abajo), confirmar que la sección "Próximos pasos" sigue mencionando explícitamente: **el servicio `apps/api` en EasyPanel sigue roto y pendiente de que el owner lo pause/elimine manualmente** — no dejar que se pierda entre las entradas nuevas de Fase 2. Es una entrada que arrastra desde el `handoff.md` de Fase 1 (regla del proyecto: nunca se borran entradas previas, solo se agregan) — este step es para confirmar que sigue ahí y no fue reemplazada por accidente.

> Recordatorio de proceso (no es parte de esta lista de tareas): antes de cerrar la sesión de trabajo, `CLAUDE.md` pide regenerar `handoff.md` con las 5 secciones de siempre (Objetivo, Estado actual, Archivos y cambios, Intentos fallidos, Próximos pasos), agregando entradas nuevas sin borrar las de Fase 1.

---

## Notas para quien retome este plan en otra sesión

- El copy en español de productos (Tarea 4) y de todo el chrome del sitio (Tarea 1) es un primer borrador de Claude — decisión señalada explícitamente, no revisada por Oscar. Antes de considerar la Fase 2 "cerrada" en `plan-desarrollo.md`, alguien debe revisar ese texto.
- La decisión de usar `next-intl` con routing por locale (`en` en la raíz `/`, `es` en `/es`, `localePrefix: "as-needed"`) es del owner (2026-09-12, por SEO bilingüe indexable, link equity del dominio raíz y SSR) y reemplaza la primera versión de este plan, que proponía un Context propio con `localStorage`. Queda confirmada — no reabrir sin pedido explícito del owner.
- `Marquee`, `Spotlight` y `CustomCursor` quedaron fuera de esta fase a propósito (ver Global Constraints) — no es un olvido, es una decisión de scope confirmada por el owner (2026-09-12), separando "adorno visual" (backlog de pulido) de "UX crítica" (`MobileNav`, que sí se migra en la Tarea 8).
