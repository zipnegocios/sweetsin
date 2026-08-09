# Sweet Sin — Master Development Prompt

> Usa este documento como contexto completo para construir el sitio web de Sweet Sin.
> Cópialo íntegro como system prompt o contexto inicial antes de cualquier sesión de desarrollo.

---

## CONTEXTO DEL PROYECTO

Estás construyendo el sitio web oficial de **Sweet Sin**, un negocio colombiano de postres artesanales ubicado en Adelaide, South Australia. El dueño es **Oscar**. El negocio opera desde un **food trailer** y ofrece obleas con arequipe artesanal, fresas con crema y profiteroles (La Repolla). El sitio tiene dos objetivos comerciales principales: **preorder/pickup online** y **captación de clientes B2B para eventos y catering**.

El sitio debe ser digno de un galardón **Awwwards** — nivel de producción de agencia de primer nivel. Diseño mobile-first, con animaciones GSAP y WebGL, copy impecable, y UX de conversión real.

**Agency:** Maistro (Gustavo Amarista)
**Client:** Sweet Sin — Oscar
**Idioma del sitio:** Inglés
**Pago:** Stripe (surcharge pasado al cliente)
**Sin delivery** — solo preorder para pickup

---

## TECH STACK

| Capa | Tecnología | Decisión |
|---|---|---|
| Framework | Next.js 14 App Router | SSG páginas públicas, SSR checkout |
| Styling | Tailwind CSS + CSS custom properties | Utilidades + tokens de diseño |
| Animaciones | GSAP 3 + ScrollTrigger + SplitText | Todas las animaciones de scroll y entrada |
| 3D / WebGL | Three.js | Hero particles + Repolla ambient effect |
| CMS | Sanity.io | Oscar gestiona menú, schedule, fotos sin código |
| Pagos | Stripe Checkout (Embedded) | Preorder con surcharge passthrough |
| Deploy | Vercel | Edge functions, CDN global, analytics |
| Fuentes | Fraunces + DM Sans + DM Mono | Via next/font (Google Fonts) |
| Mapas | Google Maps Embed API | Find Us section |
| Social | Instagram Basic Display API | Feed últimas 6 fotos |

### Estructura de carpetas

```
/sweet-sin
├── app/
│   ├── layout.tsx            # Root layout, fuentes, cursor, nav
│   ├── page.tsx              # Home (todas las secciones)
│   ├── menu/page.tsx         # Página de menú completo
│   ├── events/page.tsx       # Eventos y catering
│   ├── order/page.tsx        # Preorder flow
│   └── api/
│       ├── checkout/route.ts # Stripe session creation
│       └── instagram/route.ts # IG feed proxy + cache
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx        # Transparente → solid on scroll
│   │   ├── MobileNav.tsx     # Bottom tab bar mobile
│   │   └── Footer.tsx
│   ├── sections/
│   │   ├── Hero.tsx          # WebGL + SplitText
│   │   ├── Marquee.tsx       # Infinite scroll marquee
│   │   ├── BrandStory.tsx    # Clip reveal + counters
│   │   ├── Menu.tsx          # Grid + filtros
│   │   ├── Spotlight.tsx     # La Repolla feature
│   │   ├── Events.tsx        # B2B catering
│   │   ├── Preorder.tsx      # 3-step CTA
│   │   ├── FindUs.tsx        # Schedule + mapa + IG
│   │   └── Footer.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── MenuCard.tsx
│   │   ├── EventCard.tsx
│   │   └── CustomCursor.tsx
│   └── webgl/
│       ├── HeroParticles.tsx  # Three.js hero effect
│       └── RepollParticles.tsx # Ambient gold particles
├── lib/
│   ├── sanity.ts             # Client + queries
│   ├── stripe.ts             # Checkout utils
│   └── animations.ts         # GSAP shared configs
├── styles/
│   └── globals.css           # CSS custom properties + base
└── sanity/
    └── schema/
        ├── product.ts
        ├── event.ts
        └── trailerSchedule.ts
```

---

## DESIGN TOKENS

Declara estos como CSS custom properties en `globals.css` y como constantes de Tailwind en `tailwind.config.ts`.

```css
:root {
  /* Brand Colors */
  --color-red:        #E63946;
  --color-red-dark:   #B82B36;
  --color-red-light:  #FF5C6A;
  --color-navy:       #0F1B3D;
  --color-navy-mid:   #1A2F5F;
  --color-navy-light: #253D78;
  --color-gold:       #C9943A;
  --color-gold-light: #F5D06B;
  --color-cream:      #F7F3EE;
  --color-cream-dark: #EDE7DC;
  --color-white:      #FDFAF7;
  --color-dark:       #080D1A;

  /* Typography */
  --font-display: 'Fraunces', serif;
  --font-body:    'DM Sans', sans-serif;
  --font-mono:    'DM Mono', monospace;

  /* Spacing */
  --section-v: 120px;
  --section-v-mobile: 80px;
  --section-h: 5vw;
  --section-h-mobile: 6vw;

  /* Motion */
  --ease-out:       cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring:    cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-fast:  0.3s;
  --duration-base:  0.6s;
  --duration-slow:  1.2s;
}
```

```ts
// tailwind.config.ts — extend colors
colors: {
  'sin-red':    '#E63946',
  'navy':       '#0F1B3D',
  'navy-mid':   '#1A2F5F',
  'gold':       '#C9943A',
  'cream':      '#F7F3EE',
  'sweet-dark': '#080D1A',
  'sweet-white':'#FDFAF7',
}
```

---

## TIPOGRAFÍA

Dos familias. Tres usos.

| Rol | Fuente | Peso | Uso |
|---|---|---|---|
| Display / Hero | Fraunces | 900 | Headlines principales |
| Heading | Fraunces | 700 | Titles de sección |
| Subhead | Fraunces | 300 italic | Bajadas y claims |
| Body | DM Sans | 400 | Párrafos y descripciones |
| Label / Eyebrow | DM Mono | 400 | Etiquetas, precios, meta |

**Escala de tamaños (mobile → desktop):**
- Hero: `clamp(52px, 10vw, 110px)` / line-height: 0.9
- Section heading: `clamp(28px, 4vw, 48px)` / line-height: 1.05
- Subhead: `clamp(16px, 2vw, 22px)` / line-height: 1.4
- Body: `15px` / line-height: 1.7
- Label: `10–11px` / letter-spacing: 0.2–0.25em / text-transform: uppercase

---

## SECCIONES — ESPECIFICACIONES COMPLETAS

### 01 · HERO — "The Temptation"

**Copy:**
- Eyebrow: `Artisan Colombian Desserts · Adelaide SA`
- Headline: `Your sins were always worth it.`
- Subhead: `Colombian desserts crafted with memory, made with love, served from a trailer that knows no shame.`
- CTA primario: `Explore the menu`
- CTA secundario: `Our story ↓`
- Scroll label: `scroll to discover`

**Layout:**
- Full viewport height (`100svh`)
- Fondo: `var(--color-navy)` con halo radial rojo centrado al 40% vertical: `radial-gradient(ellipse 70% 60% at 50% 40%, rgba(230,57,70,0.18) 0%, transparent 70%)`
- Contenido centrado, texto centrado
- Nav absoluta encima (transparente)

**WebGL — Hero Particles:**
```ts
// HeroParticles.tsx
// - Canvas full-viewport como background layer (z-index: 0)
// - ~2000 THREE.Points
// - Posición inicial: forman silueta aproximada del devil mascot
// - On mount: dispersión con noise-based displacement, 3s ease-out
// - Loop suave de flotación (sin.cos noise)
// - Color: rgba(230, 57, 70, 0.6) → rgba(230, 57, 70, 0.15)
// - Mouse parallax: lerp(currentPos, mousePos * 0.03, 0.05) cada frame
// - Fallback: si WebGL no disponible o prefers-reduced-motion, mostrar
//   SVG del mascot con CSS fade-in
// - Mobile (<768px): reducir a 800 particles, sin mouse parallax
```

**GSAP — SplitText Hero:**
```ts
// En useLayoutEffect, después de 400ms del mount:
const tl = gsap.timeline()
tl.from(splitChars, {
  yPercent: 110,
  clipPath: 'inset(0 0 100% 0)',
  stagger: 0.025,
  duration: 1.1,
  ease: 'power4.out',
})
.from(subhead, { opacity: 0, y: 20, duration: 0.8, ease: 'power2.out' }, '-=0.5')
.from(ctas, { opacity: 0, y: 16, stagger: 0.1, duration: 0.6 }, '-=0.4')
```

**Navbar (transparente → solid):**
```ts
ScrollTrigger.create({
  start: '80px top',
  onEnter: () => nav.classList.add('is-scrolled'),     // backdrop-blur + navy bg
  onLeaveBack: () => nav.classList.remove('is-scrolled'),
})
// Transición CSS: transition: background 0.4s ease, backdrop-filter 0.4s ease
```

---

### 02 · MARQUEE — "The Confession"

**Copy (loop infinito):**
`Obleas con Arequipe · Fresas con Crema · La Repolla · Arequipe Artesanal · Gluttony · Envy · Lust · Wrath · Pride · Greed · Sloth ·`

**Layout:**
- Banda full-width fondo `var(--color-red)`
- Altura: `56px` desktop, `48px` mobile
- Fuente: Fraunces 700 italic, 15px, color `rgba(255,255,255,0.85)`
- Dots separadores: `rgba(255,255,255,0.35)`

**GSAP Marquee:**
```ts
// Duplicar el track para loop perfecto
// gsap.to('.marquee-track', {
//   xPercent: -50,
//   repeat: -1,
//   duration: 25,
//   ease: 'none',
// })
// On hover: reducir duration a 10 (acelera)
// On mouseout: volver a 25
```

---

### 03 · BRAND STORY — "Born in Colombia"

**Copy:**
- Label: `Our Origin`
- Headline: `Born in Colombia. Raised in memory. Made for Adelaide.`
- Body: `Oscar grew up watching his family turn flour, arequipe, and patience into something extraordinary. When he brought that knowledge to Australia, he brought everything with it — the recipes, the care, and the understanding that great food isn't just nourishment. It's permission to enjoy yourself without apology.`
- Stat 1: `7+` / `Products`
- Stat 2: `100%` / `Homemade`
- Stat 3: `0` / `Regrets`

**Layout:**
- Fondo: `var(--color-cream)` — rompe el dark, da respiro
- Desktop: grid 2 columnas (texto izquierda, foto derecha)
- Mobile: foto arriba, texto abajo
- Foto: food trailer de Oscar, object-fit cover, aspect-ratio 4/3

**GSAP Line Reveal:**
```ts
// Split headline en lines con SplitText
// ScrollTrigger por línea:
gsap.from(lines, {
  clipPath: 'inset(0 0 100% 0)',
  y: 24,
  stagger: 0.1,
  duration: 0.9,
  ease: 'power3.out',
  scrollTrigger: { trigger: section, start: 'top 72%' }
})
```

**Counter Animation:**
```ts
// Para cada stat al entrar en viewport:
gsap.to(counter, {
  innerText: targetValue,
  snap: { innerText: 1 },
  duration: 1.8,
  ease: 'power1.inOut',
  scrollTrigger: { trigger: statsRow, start: 'top 80%' }
})
```

---

### 04 · MENÚ — "The Seven Sins & Virtues"

**Copy:**
- Label: `Indulgence, classified`
- Headline: `The Seven Sins` / `The Seven Virtues`
- Link: `View full menu →`

**Estructura de productos (desde Sanity):**
```ts
interface Product {
  name: string         // "Gluttony", "Lust", etc.
  category: 'sin' | 'virtue'
  price: number        // 13 (sin) o 11 (virtue)
  description: string  // max 80 chars
  image: SanityImage
  slug: string
  available: boolean
}
```

**Layout desktop:** grid 4 columnas
**Layout mobile:** scroll horizontal con snap (`scroll-snap-type: x mandatory`)
- Cards móvil: `width: 80vw` para sugerir que hay más → swipe discovery

**MenuCard — estados:**
- Default: fondo `rgba(255,255,255,0.04)`, borde `rgba(255,255,255,0.06)`
- Hover: `transform: translateY(-4px)`, fondo `rgba(230,57,70,0.08)`, borde `rgba(230,57,70,0.25)`, `box-shadow: 0 8px 32px rgba(230,57,70,0.15)`
- Badge SIN: fondo `rgba(230,57,70,0.9)` / Badge VIRTUE: fondo `rgba(201,148,58,0.9)` color navy

**GSAP Stagger entrada:**
```ts
gsap.from('.menu-card', {
  y: 48,
  opacity: 0,
  stagger: 0.06,
  duration: 0.7,
  ease: 'power2.out',
  scrollTrigger: { trigger: '.menu-grid', start: 'top 78%' }
})
```

**Filtros:**
- Tabs: All / Sins / Virtues
- Filtering: GSAP `to` con `opacity: 0, scale: 0.95` en cards que salen, `from` en cards que entran
- Mobile: los filtros van como pills horizontales scrolleables sobre el grid

---

### 05 · SPOTLIGHT — "La Repolla"

**Contexto:** El profiterole con arequipe artesanal es el producto más subutilizado para conversión de nuevos clientes. Esta sección lo convierte en protagonista.

**Copy:**
- Tag: `Featured Product`
- Headline: `Adelaide hasn't tasted anything like it.`
- Body: `La Repolla is our profiterole — filled with homemade arequipe, dusted with something you didn't know you were missing. It converts. Every. Single. Time.`
- Precio: `$13`
- CTA: `Try it first`

**Layout:**
- Desktop: 50/50 — foto izquierda (full-bleed), contenido derecha
- Mobile: foto arriba (aspect-ratio 16/9), contenido abajo
- Fondo: `var(--color-cream)` — continuidad con brand story

**WebGL — Repolla Ambient Particles:**
```ts
// Canvas como overlay sobre la foto, pointer-events: none
// ~400 partículas color #C9943A (arequipe gold) a baja opacidad (0.3–0.6)
// Movimiento: noise orgánico lento, tipo humo/vapor
// Mouse parallax: lerp con factor 0.02 — muy sutil
// Se activa al entrar la sección en viewport (IntersectionObserver)
// Mobile: desactivado, reemplazar por CSS animation de ::before con glow
```

**Parallax foto:**
```ts
gsap.to('.spotlight-image', {
  yPercent: -15,
  ease: 'none',
  scrollTrigger: {
    trigger: '.spotlight-section',
    start: 'top bottom',
    end: 'bottom top',
    scrub: true,
  }
})
```

---

### 06 · EVENTS & CATERING — "Make it sinful"

**Copy:**
- Label: `For businesses & celebrations`
- Headline: `Make it sinful.`
- Subhead: `Your event deserves a temptation people won't stop talking about.`
- CTA: `Get a quote →`
- CTA mobile alternativo: abre WhatsApp con mensaje pre-llenado

**Cards de tipo de evento:**
```
Corporate Events
"Branded catering packages for offices, launches & team days. Minimum 20 pax."

Weddings
"Dessert stations & custom obleas towers. Unforgettable, guaranteed."

Festivals & Markets
"Full trailer setup for outdoor events across SA. Subject to availability."
```

**Layout:**
- Fondo: `var(--color-navy)`
- Desktop: grid 3 columnas para event cards
- Mobile: stack vertical
- CTA color: `var(--color-gold)` con texto `var(--color-navy)` — único uso del gold como CTA para diferenciar B2B de B2C

**Formulario de cotización (modal):**
- Campos: Name, Company, Event type (select), Date, Estimated guests, Message
- No requiere login
- Submit: email a Oscar via Resend/Nodemailer o formulario Formspree
- Modal: overlay con `backdrop-filter: blur(12px)` sobre `rgba(8,13,26,0.8)`
- GSAP enter: `scaleY 0→1` desde centro, `opacity 0→1`, duration 0.4s

**WhatsApp CTA (mobile only):**
```
https://wa.me/[OSCAR_NUMBER]?text=Hi%20Oscar!%20I'm%20interested%20in%20Sweet%20Sin%20catering%20for%20my%20event.
```

---

### 07 · PREORDER — "Ready to sin?"

**Copy:**
- Headline: `Ready to sin?`
- Subhead: `Preorder for pickup. No queue, no waiting — just the good stuff.`
- Step 1: `Choose your sins` / `Pick items from the menu`
- Step 2: `Pay securely` / `Stripe checkout, under 2 min`
- Step 3: `Pick up & enjoy` / `Fresh, ready at the trailer`
- CTA: `Start your order →`
- Fine print: `A small processing fee applies, passed directly from Stripe.`

**Layout:**
- Fondo: `var(--color-red)` full-bleed — sección de conversión más agresiva visualmente
- Halo: `radial-gradient(ellipse 60% 80% at 50% 0%, rgba(255,255,255,0.1) 0%, transparent 60%)`
- Steps: row en desktop, column en mobile con línea conectora vertical
- CTA: botón blanco con texto rojo — máximo contraste

**Lógica de preorder:**
1. Usuario llega a `/order` (o modal desde home)
2. Selecciona productos del menú con cantidades
3. Elige fecha/hora de pickup (desde disponibilidad en Sanity)
4. Stripe Checkout Embedded — no redirige a otra página
5. Confirmación: email automático via Stripe + Resend
6. Order va a dashboard de Sanity para que Oscar lo vea

---

### 08 · FIND US — "We show up where the cravings are"

**Copy:**
- Label: `This week's schedule`
- Headline: `We show up where the cravings are.`
- Body: `The trailer moves. Follow us on Instagram or sign up for weekly location drops straight to your inbox.`
- CTA: `Get location updates`

**Schedule (desde Sanity — `trailerSchedule`):**
```ts
interface ScheduleEntry {
  day: string           // "Friday"
  location: string      // "Central Market, Adelaide CBD"
  timeRange: string     // "4–8 pm"
  isActive: boolean
}
```

**Layout:**
- Fondo: `var(--color-dark)` — regreso al dark para crear contraste antes del footer
- Desktop: 2 columnas — schedule + mapa
- Mobile: stack, mapa primero (visual), schedule debajo

**Instagram Feed:**
- Grid 2×3 (6 fotos) — debajo del schedule
- Via Instagram Basic Display API con cache en Vercel KV (24h TTL)
- Hover: overlay con ❤️ count + caption breve
- Click: abre post en Instagram (nueva pestaña)

**Email signup:**
- Input simple: email → lista en Mailchimp/Brevo via API
- Placeholder: `your@email.com`
- CTA inline: `→`
- Success: animación checkmark GSAP, texto "You're in. We'll see you soon."

---

### 09 · FOOTER

**Copy:**
- Brand: `Sweet Sin`
- Tagline: `Born in Colombia. Made for Adelaide. Forgive yourself.`
- Copyright: `© 2025 Sweet Sin · Adelaide SA`
- Built: `Built by Maistro`

**Columnas:**
- Menu: The Seven Sins, The Seven Virtues, La Repolla, Seasonal Specials
- Services: Online Preorder, Event Catering, Corporate Packages, Weddings
- Info: Our Story, Find Us, Contact, Privacy Policy

**Layout:**
- Fondo: `var(--color-navy)`
- Desktop: 4 columnas (brand 2fr + 3 cols 1fr)
- Mobile: brand full-width arriba, luego 2 columnas para los links
- Social icons: Instagram, TikTok, WhatsApp (36×36, hover: color)

---

## ANIMACIONES — ESPECIFICACIONES TÉCNICAS

### Librería y setup

```ts
// lib/animations.ts
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

// Config global
gsap.defaults({ ease: 'power2.out' })
ScrollTrigger.defaults({ markers: false })

// Respetar prefers-reduced-motion
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const MOTION_OK = !prefersReducedMotion
```

### Custom Cursor (desktop only)

```tsx
// components/ui/CustomCursor.tsx
// Renderiza solo si window.matchMedia('(pointer: fine)').matches
// Estructura: dot (8px) + ring (40px, lag 0.3s)
// Estados:
//   default: dot rojo, ring transparente con borde rojo
//   hover (links/btns): dot escala 0, ring escala 1.8 fill rojo 0.15
//   click: ring squeeze scaleX(0.8) scaleY(1.2)
// gsap.to con duration: 0.08 para dot, 0.25 para ring

useEffect(() => {
  const moveCursor = (e: MouseEvent) => {
    gsap.to(dot, { x: e.clientX, y: e.clientY, duration: 0.08 })
    gsap.to(ring, { x: e.clientX, y: e.clientY, duration: 0.25 })
  }
  window.addEventListener('mousemove', moveCursor)
  return () => window.removeEventListener('mousemove', moveCursor)
}, [])
```

### Page Transitions

```ts
// Overlay full-screen rojo en todas las navegaciones internas
// Enter (nueva página cargando):
gsap.to(overlay, { scaleY: 1, transformOrigin: 'top center', duration: 0.45, ease: 'power3.in' })
// Exit (página lista):
gsap.to(overlay, { scaleY: 0, transformOrigin: 'bottom center', duration: 0.45, ease: 'power3.out', delay: 0.1 })
```

### Tabla completa de animaciones

| Componente | Tipo | Trigger | Efecto | Duración |
|---|---|---|---|---|
| Hero headline | GSAP SplitText | page load +400ms | chars clipPath + yPercent | 1.1s stagger 0.025 |
| Hero subhead | GSAP from | +700ms | opacity + y:20 | 0.8s |
| Hero particles | WebGL | page load | disperse from mascot shape | 3s |
| Marquee | GSAP to repeat:-1 | always | xPercent:-50 | 25s ease:none |
| Story lines | GSAP SplitText | scroll top:72% | clipPath + y:24 | 0.9s stagger 0.1 |
| Story counters | GSAP innerText | scroll top:80% | 0 → value | 1.8s |
| Story photo | GSAP parallax | scroll scrub | yPercent:-8 | scrub |
| Menu cards | GSAP from | scroll top:78% | y:48 opacity | 0.7s stagger 0.06 |
| Spotlight photo | GSAP parallax | scroll scrub | yPercent:-15 | scrub |
| Spotlight particles | WebGL | IntersectionObserver | ambient float | continuous |
| Event cards | GSAP from | scroll top:75% | y:32 opacity | 0.6s stagger 0.08 |
| Preorder steps | GSAP from | scroll top:70% | x:±30 opacity | 0.7s stagger 0.12 |
| Navbar transform | ScrollTrigger | 80px scrolled | bg + blur | CSS 0.4s |
| Custom cursor | GSAP to | mousemove | xy follow | 0.08s / 0.25s |
| Page transition | GSAP to | navigation | overlay scaleY | 0.45s |
| Modal open | GSAP from | click | scaleY + opacity | 0.4s |
| Filter switch | GSAP to/from | tab click | opacity + scale | 0.3s |

---

## MOBILE-FIRST — REGLAS ESPECÍFICAS

### Breakpoints

```ts
// Mobile-first — min-width queries
sm:  640px   // phone landscape
md:  768px   // tablet
lg:  1024px  // desktop pequeño
xl:  1280px  // desktop standard
2xl: 1536px  // desktop grande
```

### Bottom Navigation (mobile only, < md)

```tsx
// Sticky bottom, height 56px, z-index 50
// 4 tabs: Menu (🍰) | Events (🎪) | Order (🛒) | Find Us (📍)
// Active tab: color sin-red, label visible
// Inactive: color blanco 40%, sin label
// Desaparece al scrollear DOWN (transform: translateY(100%))
// Reaparece al scrollear UP (transform: translateY(0))
// Transición CSS 0.3s ease
// Background: var(--color-dark) con backdrop-filter: blur(20px)
```

### Horizontal Scroll — Menú mobile

```tsx
// Wrapper: overflow-x: auto, scroll-snap-type: x mandatory
// Ocultar scrollbar: scrollbar-width: none, &::-webkit-scrollbar { display: none }
// Cada card: scroll-snap-align: start, width: 80vw, flex-shrink: 0
// Gap entre cards: 12px
// Indicador: dots debajo del carousel (posición activa en rojo)
```

### Performance mobile

- WebGL Hero: reducir partículas a 800 si `navigator.hardwareConcurrency <= 4`
- WebGL desactivado completamente si: `connection.saveData === true` || `window.DeviceMemory < 2`
- Imágenes: `next/image` con `sizes="(max-width: 768px) 100vw, 50vw"` en todos los casos
- Lazy load: todas las secciones excepto Hero
- Fonts: `display: swap` siempre

---

## SANITY CMS — SCHEMAS

```ts
// sanity/schema/product.ts
export default {
  name: 'product',
  title: 'Menu Item',
  type: 'document',
  fields: [
    { name: 'name', type: 'string', title: 'Product Name' },            // "Gluttony"
    { name: 'sinName', type: 'string', title: 'Sin/Virtue Name' },      // "Gluttony"
    { name: 'category', type: 'string', options: { list: ['sin','virtue'] } },
    { name: 'price', type: 'number' },
    { name: 'description', type: 'text', rows: 2 },
    { name: 'image', type: 'image', options: { hotspot: true } },
    { name: 'available', type: 'boolean', initialValue: true },
    { name: 'featured', type: 'boolean', initialValue: false },          // La Repolla = true
    { name: 'slug', type: 'slug', options: { source: 'name' } },
  ]
}

// sanity/schema/trailerSchedule.ts
export default {
  name: 'trailerSchedule',
  title: 'Trailer Schedule',
  type: 'document',
  fields: [
    { name: 'weekOf', type: 'date', title: 'Week of' },
    { name: 'entries', type: 'array', of: [{
      type: 'object',
      fields: [
        { name: 'day', type: 'string' },
        { name: 'location', type: 'string' },
        { name: 'suburb', type: 'string' },
        { name: 'timeRange', type: 'string' },
        { name: 'isActive', type: 'boolean', initialValue: true },
        { name: 'googleMapsUrl', type: 'url' },
      ]
    }]}
  ]
}

// sanity/schema/pickupSlot.ts
export default {
  name: 'pickupSlot',
  title: 'Pickup Time Slot',
  type: 'document',
  fields: [
    { name: 'date', type: 'datetime' },
    { name: 'maxOrders', type: 'number', initialValue: 10 },
    { name: 'currentOrders', type: 'number', initialValue: 0 },
    { name: 'isAvailable', type: 'boolean', initialValue: true },
  ]
}
```

---

## STRIPE — CHECKOUT FLOW

```ts
// app/api/checkout/route.ts
import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const { items, pickupSlot, customerEmail } = await req.json()

  // Calcular subtotal
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  
  // Stripe fee: 1.75% + $0.30 (domestic AU) — pasar al cliente
  const stripeFee = Math.ceil((subtotal * 0.0175 + 0.30) * 100) / 100
  const total = subtotal + stripeFee

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: customerEmail,
    line_items: [
      ...items.map(item => ({
        price_data: {
          currency: 'aud',
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      {
        price_data: {
          currency: 'aud',
          product_data: { name: 'Payment processing fee' },
          unit_amount: Math.round(stripeFee * 100),
        },
        quantity: 1,
      }
    ],
    metadata: { pickupSlot, items: JSON.stringify(items) },
    success_url: `${process.env.NEXT_PUBLIC_URL}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/order`,
  })

  return Response.json({ url: session.url })
}
```

---

## PERFORMANCE — TARGETS Y ESTRATEGIA

**Core Web Vitals targets:**
- LCP: < 2.5s (imagen hero con priority + preload)
- CLS: < 0.1 (reservar espacio para imágenes con aspectRatio)
- INP: < 200ms (no bloquear main thread con WebGL)
- FID: < 100ms

**Estrategias:**
1. `next/image` en TODAS las imágenes — nunca `<img>` directo
2. Hero image o video: `priority={true}` + `fetchPriority="high"`
3. WebGL en worker thread con `OffscreenCanvas` si disponible
4. GSAP `lazyRender: true` en todos los ScrollTriggers
5. Sanity imágenes: CDN de Sanity con `?w=800&q=80&auto=format`
6. Fonts: solo pesos usados — Fraunces 300, 700, 900 + italic; DM Sans 400, 500
7. Bundle: `next/dynamic` con `ssr: false` para componentes WebGL
8. Instagram feed: cache 24h en Vercel KV para no golpear API en cada request

---

## VARIABLES DE ENTORNO

```env
# .env.local
NEXT_PUBLIC_URL=https://sweetsincafe.com.au

# Sanity
NEXT_PUBLIC_SANITY_PROJECT_ID=xxxxxx
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_TOKEN=sk...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (Resend)
RESEND_API_KEY=re_...
OSCAR_EMAIL=oscar@sweetsin.com.au

# Instagram
INSTAGRAM_ACCESS_TOKEN=...

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_KEY=...

# KV Cache (Vercel)
KV_URL=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

---

## REGLAS DE DESARROLLO

1. **Mobile-first siempre.** Escribir el CSS base para mobile, luego `md:` para desktop. Nunca al revés.
2. **No `<img>` directo.** Usar `next/image` en 100% de los casos.
3. **GSAP solo en el cliente.** Todos los componentes con animaciones: `'use client'` + `useLayoutEffect`.
4. **WebGL como enhancement.** La página debe ser 100% funcional y bella sin WebGL. El WebGL es la capa de lujo.
5. **Accesibilidad no negociable.** Contraste WCAG AA mínimo en todo texto. `aria-label` en todos los iconos solos. `alt` descriptivo en todas las imágenes.
6. **prefers-reduced-motion.** Si `MOTION_OK === false`, saltear todas las animaciones GSAP y mostrar estado final directamente.
7. **TypeScript estricto.** `strict: true` en tsconfig. Sin `any`.
8. **Error boundaries.** Envolver WebGL en `<Suspense>` + `ErrorBoundary`. Si falla, muestra fallback SVG.
9. **Sanity como única fuente de verdad** para menú, schedule y fotos. Nunca hardcodear productos en el código.
10. **Stripe fee explícito.** El fee de procesamiento siempre visible antes de pagar. Sin sorpresas al checkout.

---

## CHECKLIST PRE-LAUNCH

- [ ] Lighthouse Mobile ≥ 90 en Performance, Accessibility, Best Practices, SEO
- [ ] CLS = 0 verificado en Chrome DevTools
- [ ] Stripe test mode completo (crear orden → pagar → email → dashboard Sanity)
- [ ] Preorder flow testado en iPhone Safari, Chrome Android, Samsung Internet
- [ ] WebGL fallback verificado (DevTools → CPU throttling 6x)
- [ ] prefers-reduced-motion testado
- [ ] Formulario de eventos: email llega a Oscar
- [ ] Instagram feed cargando con cache
- [ ] Google Maps embebido con marcador correcto
- [ ] Meta tags OG: título, descripción, imagen (para compartir en IG/WhatsApp)
- [ ] robots.txt y sitemap.xml generados
- [ ] Google Analytics 4 o Vercel Analytics activado
- [ ] Dominio apuntando a Vercel, SSL activo
- [ ] Stripe webhook registrado para URL de producción
- [ ] Oscar tiene acceso a Sanity Studio y sabe subir fotos y cambiar schedule

---

*Documento generado por Maistro para el proyecto Sweet Sin · 2025*
*Versión 1.0 — Sincronizado con sweetsin-design-system.html*
