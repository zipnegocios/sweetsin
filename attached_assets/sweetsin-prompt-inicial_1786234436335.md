# Sweet Sin — Prompt Inicial de Planificación

> Pega este prompt completo en Claude Code al inicio de la sesión de kickoff.
> El objetivo de esta sesión es: scaffolding completo + configuración base + plan de sprints.
> No se construye ningún componente completo todavía — se sienta la fundación.

---

## INSTRUCCIÓN PARA CLAUDE CODE

Eres el arquitecto técnico del sitio web de **Sweet Sin**, un negocio colombiano de postres artesanales en Adelaide, Australia. Tu tarea en esta sesión es **planificar y scaffoldear el proyecto completo** — no implementar componentes todavía, sino crear la estructura perfecta para que el desarrollo sea fluido, predecible y sin deuda técnica desde el día uno.

Al finalizar esta sesión, el repositorio debe estar en un estado donde cualquier desarrollador (o tú en una sesión futura) pueda arrancar a construir componentes sin bloqueos de configuración.

---

## CONTEXTO DEL PROYECTO

**Cliente:** Sweet Sin — Oscar (dueño y operador)
**Agencia:** Maistro (Gustavo Amarista)
**Producto:** Sitio web Awwwards-level para negocio de postres colombianos artesanales en Adelaide, SA, Australia
**Objetivos comerciales:**
1. Preorder/pickup online con Stripe (sin delivery)
2. Captación B2B para eventos y catering con formulario de cotización

**Stack decidido:**
- Next.js 14 (App Router) + TypeScript estricto
- Tailwind CSS + CSS custom properties
- GSAP 3 + ScrollTrigger + SplitText (animaciones)
- Three.js (WebGL — hero particles + ambient effect)
- Sanity.io v3 (CMS — Oscar gestiona sin código)
- Stripe Checkout Embedded (pagos, surcharge al cliente)
- Vercel (deploy + Edge Functions + KV cache)
- Resend (emails transaccionales)
- Instagram Basic Display API (feed)

**Idioma del sitio:** Inglés  
**Dominio target:** sweetsincafe.com.au  
**Sin registro obligatorio** — checkout como invitado siempre  

---

## TAREA 1 — INICIALIZAR EL PROYECTO

Ejecuta lo siguiente en el directorio de trabajo:

```bash
npx create-next-app@latest sweet-sin \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack
cd sweet-sin
```

---

## TAREA 2 — INSTALAR DEPENDENCIAS

```bash
# Animaciones
npm install gsap @gsap/react

# 3D / WebGL
npm install three @types/three

# CMS
npm install next-sanity @sanity/image-url @sanity/client

# Pagos
npm install stripe @stripe/stripe-js

# Email
npm install resend

# Utilidades
npm install clsx tailwind-merge lucide-react

# Formularios
npm install react-hook-form @hookform/resolvers zod

# Cache / KV
npm install @vercel/kv

# Dev tools
npm install -D @types/node prettier prettier-plugin-tailwindcss
```

---

## TAREA 3 — CONFIGURAR TYPESCRIPT

Reemplaza `tsconfig.json` con:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## TAREA 4 — CONFIGURAR TAILWIND

Reemplaza `tailwind.config.ts` con:

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'sin-red':     '#E63946',
        'sin-red-d':   '#B82B36',
        'sin-red-l':   '#FF5C6A',
        'navy':        '#0F1B3D',
        'navy-mid':    '#1A2F5F',
        'navy-light':  '#253D78',
        'gold':        '#C9943A',
        'gold-light':  '#F5D06B',
        'cream':       '#F7F3EE',
        'cream-dark':  '#EDE7DC',
        'sweet-white': '#FDFAF7',
        'sweet-dark':  '#080D1A',
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'serif'],
        body:    ['var(--font-dm-sans)', 'sans-serif'],
        mono:    ['var(--font-dm-mono)', 'monospace'],
      },
      fontSize: {
        'hero':    ['clamp(52px,10vw,110px)', { lineHeight: '0.9' }],
        'display': ['clamp(28px,4vw,48px)',   { lineHeight: '1.05' }],
        'subhead': ['clamp(16px,2vw,22px)',   { lineHeight: '1.4' }],
      },
      spacing: {
        'section': 'clamp(80px, 10vw, 120px)',
      },
      transitionTimingFunction: {
        'out-expo':  'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring':    'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      backgroundImage: {
        'hero-glow':     'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(230,57,70,0.18) 0%, transparent 70%)',
        'red-glow':      'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(255,255,255,0.1) 0%, transparent 60%)',
        'spotlight-glow':'radial-gradient(ellipse 80% 60% at 50% 60%, rgba(201,148,58,0.25) 0%, transparent 65%)',
      },
      screens: {
        xs: '375px',
      },
    },
  },
  plugins: [],
}

export default config
```

---

## TAREA 5 — GLOBALS.CSS

Reemplaza `src/app/globals.css` con:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ─── Brand tokens ─────────────────────────────── */
:root {
  --color-red:        #E63946;
  --color-red-dark:   #B82B36;
  --color-red-light:  #FF5C6A;
  --color-navy:       #0F1B3D;
  --color-navy-mid:   #1A2F5F;
  --color-gold:       #C9943A;
  --color-cream:      #F7F3EE;
  --color-dark:       #080D1A;
  --color-white:      #FDFAF7;

  --font-display: var(--font-fraunces);
  --font-body:    var(--font-dm-sans);
  --font-mono:    var(--font-dm-mono);

  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ─── Base reset ────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }

html {
  scroll-behavior: smooth;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  background-color: var(--color-dark);
  color: var(--color-cream);
  font-family: var(--font-body), sans-serif;
  overflow-x: hidden;
}

/* ─── Typography base ───────────────────────────── */
h1, h2, h3, h4 {
  font-family: var(--font-display), serif;
  font-weight: 700;
  line-height: 1.05;
}

/* ─── Custom scrollbar ──────────────────────────── */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: var(--color-dark); }
::-webkit-scrollbar-thumb { background: var(--color-red); border-radius: 2px; }

/* ─── Selection ─────────────────────────────────── */
::selection {
  background: var(--color-red);
  color: white;
}

/* ─── GSAP will-change helpers ──────────────────── */
.gsap-reveal    { will-change: transform, opacity; }
.gsap-clip      { overflow: hidden; }
.gsap-clip-line { overflow: hidden; display: block; }

/* ─── Custom cursor (desktop) ───────────────────── */
@media (pointer: fine) {
  body { cursor: none; }
  a, button, [role="button"] { cursor: none; }
}

/* ─── Horizontal scroll snap (mobile menu) ─────── */
.snap-x-mandatory {
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}
.snap-x-mandatory > * {
  scroll-snap-align: start;
}
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* ─── Reduce motion ─────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## TAREA 6 — LAYOUT RAÍZ (app/layout.tsx)

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Fraunces, DM_Sans, DM_Mono } from 'next/font/google'
import '@/app/globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { CustomCursor } from '@/components/ui/CustomCursor'
import { PageTransition } from '@/components/ui/PageTransition'

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['300', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-dm-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Sweet Sin — Colombian Desserts in Adelaide',
    template: '%s | Sweet Sin',
  },
  description: 'Artisan Colombian desserts in Adelaide, South Australia. Obleas, fresas con crema, and La Repolla — made with homemade arequipe. Order online for pickup.',
  keywords: ['colombian desserts', 'adelaide', 'obleas', 'arequipe', 'food trailer', 'desserts sa'],
  openGraph: {
    title: 'Sweet Sin — Colombian Desserts in Adelaide',
    description: 'Your sins were always worth it.',
    url: 'https://sweetsincafe.com.au',
    siteName: 'Sweet Sin',
    locale: 'en_AU',
    type: 'website',
    // images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sweet Sin',
    description: 'Your sins were always worth it.',
  },
  robots: { index: true, follow: true },
  metadataBase: new URL('https://sweetsincafe.com.au'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <body>
        <CustomCursor />
        <PageTransition />
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
```

---

## TAREA 7 — ESTRUCTURA DE CARPETAS

Crea todos estos archivos vacíos (con export placeholder) para que las importaciones no fallen:

```
src/
├── app/
│   ├── layout.tsx                    ✅ (creado arriba)
│   ├── globals.css                   ✅ (creado arriba)
│   ├── page.tsx                      → Home — importa todas las sections
│   ├── menu/
│   │   └── page.tsx                  → Página de menú completo
│   ├── events/
│   │   └── page.tsx                  → Eventos y catering
│   ├── order/
│   │   ├── page.tsx                  → Preorder flow
│   │   └── success/page.tsx          → Confirmación de pago
│   └── api/
│       ├── checkout/route.ts         → POST: crear Stripe session
│       ├── instagram/route.ts        → GET: feed con cache KV
│       └── contact/route.ts          → POST: formulario eventos → email
│
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── MobileNav.tsx             → Bottom tab bar
│   │   └── Footer.tsx
│   ├── sections/
│   │   ├── Hero.tsx
│   │   ├── Marquee.tsx
│   │   ├── BrandStory.tsx
│   │   ├── Menu.tsx
│   │   ├── MenuCard.tsx
│   │   ├── Spotlight.tsx
│   │   ├── Events.tsx
│   │   ├── Preorder.tsx
│   │   ├── FindUs.tsx
│   │   └── InstagramFeed.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── CustomCursor.tsx
│   │   ├── PageTransition.tsx
│   │   ├── Modal.tsx
│   │   ├── Badge.tsx
│   │   └── SectionLabel.tsx
│   └── webgl/
│       ├── HeroParticles.tsx         → Three.js, dynamic import ssr:false
│       └── RepollaParticles.tsx      → Three.js, dynamic import ssr:false
│
├── lib/
│   ├── sanity/
│   │   ├── client.ts                 → createClient config
│   │   ├── queries.ts                → GROQ queries
│   │   └── image.ts                  → urlFor helper
│   ├── stripe.ts                     → stripe instance + helpers
│   ├── animations.ts                 → GSAP register + shared configs
│   ├── utils.ts                      → cn(), formatPrice(), etc.
│   └── types.ts                      → interfaces compartidas
│
├── hooks/
│   ├── useGSAP.ts                    → wrapper de @gsap/react
│   ├── useReducedMotion.ts           → prefers-reduced-motion
│   ├── useWebGL.ts                   → detecta soporte WebGL
│   └── useScrollDirection.ts         → para bottom nav hide/show
│
└── sanity/
    ├── sanity.config.ts
    └── schemas/
        ├── index.ts
        ├── product.ts
        ├── trailerSchedule.ts
        └── pickupSlot.ts
```

---

## TAREA 8 — ARCHIVOS BASE

### src/lib/utils.ts
```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

export function calculateStripeFee(subtotalAUD: number): number {
  // Stripe AU domestic: 1.75% + $0.30
  return Math.ceil((subtotalAUD * 0.0175 + 0.30) * 100) / 100
}
```

### src/lib/types.ts
```ts
export interface Product {
  _id: string
  name: string
  sinName: string
  category: 'sin' | 'virtue'
  price: number
  description: string
  image: SanityImage
  available: boolean
  featured: boolean
  slug: { current: string }
}

export interface ScheduleEntry {
  day: string
  location: string
  suburb: string
  timeRange: string
  isActive: boolean
  googleMapsUrl?: string
}

export interface TrailerSchedule {
  _id: string
  weekOf: string
  entries: ScheduleEntry[]
}

export interface PickupSlot {
  _id: string
  date: string
  maxOrders: number
  currentOrders: number
  isAvailable: boolean
}

export interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
}

export interface SanityImage {
  _type: 'image'
  asset: { _ref: string; _type: 'reference' }
  hotspot?: { x: number; y: number; height: number; width: number }
}
```

### src/lib/animations.ts
```ts
'use client'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, SplitText)
  gsap.defaults({ ease: 'power2.out' })
  ScrollTrigger.defaults({ markers: false })
}

export { gsap, ScrollTrigger, SplitText }

export const DURATIONS = {
  fast:   0.3,
  base:   0.6,
  slow:   1.1,
  slower: 1.8,
} as const

export const EASINGS = {
  outExpo:  'power4.out',
  outCubic: 'power3.out',
  outQuad:  'power2.out',
  spring:   'back.out(1.7)',
  none:     'none',
} as const

export const STAGGER = {
  chars:  0.025,
  words:  0.06,
  lines:  0.1,
  cards:  0.06,
  items:  0.08,
} as const
```

### src/hooks/useReducedMotion.ts
```ts
'use client'
import { useEffect, useState } from 'react'

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}
```

### src/hooks/useWebGL.ts
```ts
'use client'
import { useEffect, useState } from 'react'

export function useWebGL(): boolean {
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      const lowMemory = (navigator as any).deviceMemory !== undefined && (navigator as any).deviceMemory < 2
      const saveData = (navigator as any).connection?.saveData === true
      setSupported(!!ctx && !lowMemory && !saveData)
    } catch {
      setSupported(false)
    }
  }, [])

  return supported
}
```

### src/hooks/useScrollDirection.ts
```ts
'use client'
import { useEffect, useState } from 'react'

export function useScrollDirection(): 'up' | 'down' {
  const [direction, setDirection] = useState<'up' | 'down'>('up')
  
  useEffect(() => {
    let lastY = window.scrollY
    const handler = () => {
      const currentY = window.scrollY
      setDirection(currentY > lastY ? 'down' : 'up')
      lastY = currentY
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return direction
}
```

---

## TAREA 9 — SANITY CONFIG

### sanity/sanity.config.ts
```ts
import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './schemas'

export default defineConfig({
  name: 'sweet-sin',
  title: 'Sweet Sin Studio',
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  plugins: [structureTool(), visionTool()],
  schema: { types: schemaTypes },
})
```

### src/lib/sanity/client.ts
```ts
import { createClient } from 'next-sanity'
import imageUrlBuilder from '@sanity/image-url'
import type { SanityImage } from '@/lib/types'

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
})

const builder = imageUrlBuilder(client)

export function urlFor(source: SanityImage) {
  return builder.image(source)
}
```

### src/lib/sanity/queries.ts
```ts
import { groq } from 'next-sanity'

export const PRODUCTS_QUERY = groq`
  *[_type == "product" && available == true] | order(category asc, name asc) {
    _id, name, sinName, category, price, description, image, available, featured,
    "slug": slug.current
  }
`

export const FEATURED_PRODUCT_QUERY = groq`
  *[_type == "product" && featured == true][0] {
    _id, name, sinName, category, price, description, image,
    "slug": slug.current
  }
`

export const SCHEDULE_QUERY = groq`
  *[_type == "trailerSchedule"] | order(weekOf desc)[0] {
    _id, weekOf, entries
  }
`

export const AVAILABLE_SLOTS_QUERY = groq`
  *[_type == "pickupSlot" && isAvailable == true && date > now()] | order(date asc) {
    _id, date, maxOrders, currentOrders
  }
`
```

---

## TAREA 10 — VARIABLES DE ENTORNO

Crea `.env.local.example` (nunca commitear `.env.local`):

```env
# App
NEXT_PUBLIC_URL=http://localhost:3000

# Sanity CMS
NEXT_PUBLIC_SANITY_PROJECT_ID=tu-project-id
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_TOKEN=sk_...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (Resend)
RESEND_API_KEY=re_...
OSCAR_EMAIL=oscar@sweetsin.com.au

# Instagram Basic Display API
INSTAGRAM_ACCESS_TOKEN=...

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_KEY=...

# Vercel KV (para cache Instagram)
KV_URL=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

Agrega a `.gitignore`:
```
.env.local
.env.*.local
```

---

## TAREA 11 — NEXT.CONFIG.JS

```ts
// next.config.ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
      },
      {
        protocol: 'https',
        hostname: 'scontent.cdninstagram.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default config
```

---

## TAREA 12 — HOME PAGE (scaffold)

```tsx
// src/app/page.tsx
import { Hero } from '@/components/sections/Hero'
import { Marquee } from '@/components/sections/Marquee'
import { BrandStory } from '@/components/sections/BrandStory'
import { Menu } from '@/components/sections/Menu'
import { Spotlight } from '@/components/sections/Spotlight'
import { Events } from '@/components/sections/Events'
import { Preorder } from '@/components/sections/Preorder'
import { FindUs } from '@/components/sections/FindUs'
import { client } from '@/lib/sanity/client'
import { PRODUCTS_QUERY, FEATURED_PRODUCT_QUERY, SCHEDULE_QUERY } from '@/lib/sanity/queries'

export const revalidate = 3600 // ISR: revalidar cada hora

export default async function HomePage() {
  const [products, featuredProduct, schedule] = await Promise.all([
    client.fetch(PRODUCTS_QUERY),
    client.fetch(FEATURED_PRODUCT_QUERY),
    client.fetch(SCHEDULE_QUERY),
  ])

  return (
    <>
      <Hero />
      <Marquee />
      <BrandStory />
      <Menu products={products} />
      <Spotlight product={featuredProduct} />
      <Events />
      <Preorder />
      <FindUs schedule={schedule} />
    </>
  )
}
```

---

## TAREA 13 — PRETTIER CONFIG

Crea `prettier.config.js`:

```js
/** @type {import('prettier').Config} */
module.exports = {
  semi: false,
  singleQuote: true,
  trailingComma: 'es5',
  tabWidth: 2,
  printWidth: 100,
  plugins: ['prettier-plugin-tailwindcss'],
}
```

---

## TAREA 14 — CLAUDE.MD (contexto persistente)

Crea `CLAUDE.md` en la raíz del proyecto para que en cada sesión futura de Claude Code ya tenga el contexto sin tener que re-explicar:

```markdown
# Sweet Sin — Project Context

## What this is
Awwwards-level website for Sweet Sin, a Colombian artisan dessert business in Adelaide, SA, Australia.
Owner: Oscar. Agency: Maistro (Gustavo Amarista).

## Business rules
- No delivery. Preorder for pickup only.
- Stripe surcharge passed to the customer.
- English only.
- No user registration required (guest checkout).
- Oscar manages menu, schedule, and photos via Sanity Studio (no code).

## Design system
- Primary: #E63946 (Sin Red) | Secondary: #0F1B3D (Navy) | Accent: #C9943A (Gold)
- Fonts: Fraunces (display) + DM Sans (body) + DM Mono (labels)
- Mobile-first. Desktop breakpoint: md (768px).

## Animation rules
- GSAP + ScrollTrigger + SplitText for all scroll animations
- Three.js WebGL: Hero particles + Repolla ambient effect
- Always check useReducedMotion() before animating
- WebGL components: dynamic import with ssr: false

## Key files
- Master design spec: sweetsin-design-system.html
- Full dev spec: sweetsin-master-prompt.md
- Types: src/lib/types.ts
- GSAP config: src/lib/animations.ts
- Sanity queries: src/lib/sanity/queries.ts

## Current status
[ ] Scaffold complete (this session)
[ ] Component: Navbar
[ ] Component: Hero + WebGL
[ ] Component: Marquee
[ ] Component: BrandStory
[ ] Component: Menu + MenuCard
[ ] Component: Spotlight + WebGL
[ ] Component: Events + Modal
[ ] Component: Preorder + Stripe
[ ] Component: FindUs + IG Feed
[ ] Component: Footer
[ ] Sanity Studio setup
[ ] Stripe webhook + orders flow
[ ] Deploy to Vercel
```

---

## TAREA 15 — VERIFICACIÓN FINAL

Una vez completadas todas las tareas anteriores, ejecuta:

```bash
# Verificar que compila sin errores TypeScript
npx tsc --noEmit

# Verificar que el dev server arranca
npm run dev

# Verificar que no hay warnings de Tailwind
npm run build 2>&1 | grep -i warn
```

El servidor debe levantar en `localhost:3000` con la página home mostrando el layout base (con placeholders de cada sección). Si hay errores de TypeScript en los placeholders, corrígelos antes de continuar.

---

## PLAN DE SPRINTS

Después del scaffold, el desarrollo sigue en este orden:

### Sprint 1 — Foundation (1–2 días)
Navbar + Footer + CustomCursor + PageTransition + MobileNav + home layout

### Sprint 2 — Hero (1–2 días)  
HeroParticles (WebGL) + SplitText animation + scroll indicator + responsive

### Sprint 3 — Contenido superior (2 días)
Marquee + BrandStory (line reveal + counters + parallax foto)

### Sprint 4 — Menú (2 días)
Menu grid + MenuCard + filtros + horizontal scroll mobile + Sanity data

### Sprint 5 — Spotlight + Events (1–2 días)
RepollaParticles + Spotlight section + Events grid + Modal de cotización

### Sprint 6 — Conversión (2 días)
Preorder section + Stripe checkout flow + página success + emails Resend

### Sprint 7 — Find Us + IG (1 día)
Schedule desde Sanity + Google Maps + Instagram feed con cache KV

### Sprint 8 — QA + Launch (2 días)
Lighthouse audit + CLS fixes + cross-browser + Vercel deploy + dominio + webhook

**Total estimado:** 12–15 días de desarrollo

---

## RESULTADO ESPERADO DE ESTA SESIÓN

Al terminar, el repositorio debe tener:

- ✅ `package.json` con todas las dependencias instaladas
- ✅ `tsconfig.json` estricto
- ✅ `tailwind.config.ts` con design tokens completos
- ✅ `next.config.ts` configurado
- ✅ `globals.css` con CSS tokens y base styles
- ✅ `src/app/layout.tsx` con fuentes, metadata y providers
- ✅ `src/app/page.tsx` con imports de todas las sections
- ✅ Todos los archivos de carpetas creados (placeholders que compilan)
- ✅ `src/lib/types.ts` con todas las interfaces
- ✅ `src/lib/utils.ts` con helpers
- ✅ `src/lib/animations.ts` con GSAP configurado
- ✅ `src/lib/sanity/` con client, queries e image helper
- ✅ `src/hooks/` con los 4 hooks base
- ✅ `sanity/` con config y schemas
- ✅ `.env.local.example` documentado
- ✅ `prettier.config.js`
- ✅ `CLAUDE.md` con contexto del proyecto
- ✅ `npm run dev` levanta sin errores
- ✅ `npx tsc --noEmit` pasa sin errores

No avanzar a componentes hasta que todos los checkboxes anteriores estén verdes.

---

*Sweet Sin · Maistro · Prompt Inicial v1.0*
