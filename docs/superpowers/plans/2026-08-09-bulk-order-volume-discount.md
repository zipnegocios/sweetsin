# Bulk Order Volume Discount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Coffee product and a per-line volume discount engine (20/50/100-unit tiers) so ordering large quantities of one item automatically applies a discount, visible everywhere price is shown (Menu card, cart pill/drawer, checkout), per `docs/superpowers/specs/2026-08-09-bulk-order-volume-discount-design.md`.

**Architecture:** A new pure-function module `apps/web/src/lib/pricing.ts` is the single source of truth for tier thresholds and discounted-price math. `CartContext` (`lib/cart.tsx`) is the only consumer that calls into it to compute `totalPrice`/`totalSavings`; every component that displays a price already reads those from `useCart()`, so most of the UI needs no changes — only the two places that compute a *per-line* price independently (`CartBar`'s line display, and the new quantity input's discount badge on `MenuCard`) need to call `pricing.ts` directly.

**Tech Stack:** React 19 + TypeScript, Tailwind v4. No new dependencies.

## Global Constraints

- No backend/DB changes. `VOLUME_TIERS` is a hardcoded array in `apps/web/src/lib/pricing.ts`.
- Discount tiers (from the spec, adjust only if the human partner says otherwise before you start): 20+ units of the *same product* = 5% off that line, 50+ = 10%, 100+ = 15%. Tiers are per product line, not combined across different products in the cart.
- No automated test runner exists in this repo. Verification is manual: `pnpm --filter @workspace/web run dev`, click through the scenarios listed in each task.
- Run `pnpm run typecheck` after every task, before committing.

---

### Task 1: Add the pricing engine and the Coffee product

**Files:**
- Create: `apps/web/src/lib/pricing.ts`
- Modify: `apps/web/src/lib/data.ts`

**Interfaces:**
- Produces: `export interface VolumeTier { minQty: number; discountPct: number }`, `export const VOLUME_TIERS: VolumeTier[]` (sorted descending by `minQty`), `export function getDiscountForQty(qty: number): VolumeTier | null`, `export function getDiscountedUnitPrice(unitPrice: number, qty: number): number`, `export function getLineTotal(unitPrice: number, qty: number): number`.
- Modifies: `Product['category']` gains `'coffee'` as a valid value; `products` array gains one coffee entry with `id: 'p16'`.

- [ ] **Step 1: Create `apps/web/src/lib/pricing.ts`**

```ts
export interface VolumeTier {
  minQty: number;
  discountPct: number; // e.g. 0.05 = 5%
}

// Sorted descending by minQty — getDiscountForQty relies on this order.
export const VOLUME_TIERS: VolumeTier[] = [
  { minQty: 100, discountPct: 0.15 },
  { minQty: 50, discountPct: 0.10 },
  { minQty: 20, discountPct: 0.05 },
];

export function getDiscountForQty(qty: number): VolumeTier | null {
  return VOLUME_TIERS.find((tier) => qty >= tier.minQty) ?? null;
}

export function getDiscountedUnitPrice(unitPrice: number, qty: number): number {
  const tier = getDiscountForQty(qty);
  if (!tier) return unitPrice;
  return unitPrice * (1 - tier.discountPct);
}

export function getLineTotal(unitPrice: number, qty: number): number {
  return getDiscountedUnitPrice(unitPrice, qty) * qty;
}
```

- [ ] **Step 2: Add the `coffee` category and product to `apps/web/src/lib/data.ts`**

Change:

```ts
export interface Product {
  id: string;
  name: string;
  category: 'sin' | 'virtue';
```

to:

```ts
export interface Product {
  id: string;
  name: string;
  category: 'sin' | 'virtue' | 'coffee';
```

Then, immediately after the `p15` ("La Repolla") entry and before the closing `];` of the `products` array, add:

```ts
  // Coffee
  { id: 'p16', name: 'Sweet Sin Coffee', category: 'coffee', price: 4.5, description: 'Locally roasted, made fresh at the trailer.', available: true, image: '/products/p16.jpg' },
```

No photo exists at `/products/p16.jpg` yet — `MenuCard` already falls back to a gradient placeholder when the image fails to load via its existing `product.image ? <img/> : <gradient div>` branch, so this is expected and fine for the prototype.

- [ ] **Step 3: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS (these two files have no other consumers yet that would break).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/pricing.ts apps/web/src/lib/data.ts
git commit -m "$(cat <<'EOF'
feat: add volume discount pricing engine and Coffee product

pricing.ts is the single source of truth for volume-discount tiers
(20/50/100 units -> 5/10/15% off, per product line). Coffee is a new
product/category, sold alongside the existing pastries.
EOF
)"
```

---

### Task 2: Wire the pricing engine into `CartContext`

**Files:**
- Modify: `apps/web/src/lib/cart.tsx`

**Interfaces:**
- Consumes: `getLineTotal` from `./pricing` (Task 1).
- Produces (added to `useCart()`'s return value): `totalSavings: number`, `setQty: (productId: string, qty: number) => void`.
- `totalPrice` now reflects discounted line totals (was previously full-price sum) — this is a behavior change every existing consumer (`CartBar`, `CheckoutModal`) already displays correctly with no code change, since they just render whatever `totalPrice` is.

- [ ] **Step 1: Replace the full contents of `apps/web/src/lib/cart.tsx`**

```tsx
import { createContext, useContext, useState, ReactNode } from 'react';
import { products, WHATSAPP_URL } from './data';
import { getLineTotal } from './pricing';

export interface CartItem {
  productId: string;
  qty: number;
}

export interface CheckoutDetails {
  fulfillment: 'pickup' | 'self-delivery' | 'courier';
  fulfillmentFee: number;
  address?: { line1: string; suburb: string };
  contact: { name: string; phone: string; email: string };
}

interface CartContextValue {
  items: CartItem[];
  add: (productId: string) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  totalQty: number;
  totalPrice: number;
  totalSavings: number;
  sendToWhatsApp: (details: CheckoutDetails) => void;
  checkoutOpen: boolean;
  openCheckout: () => void;
  closeCheckout: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const FULFILLMENT_LABEL: Record<CheckoutDetails['fulfillment'], string> = {
  pickup: 'Pickup at the trailer',
  'self-delivery': 'Delivery by Sweet Sin',
  courier: 'Courier delivery',
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const add = (productId: string) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === productId);
      if (existing) {
        return prev.map(i => i.productId === productId ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { productId, qty: 1 }];
    });
  };

  const remove = (productId: string) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === productId);
      if (!existing) return prev;
      if (existing.qty === 1) return prev.filter(i => i.productId !== productId);
      return prev.map(i => i.productId === productId ? { ...i, qty: i.qty - 1 } : i);
    });
  };

  const setQty = (productId: string, qty: number) => {
    setItems(prev => {
      if (qty <= 0) return prev.filter(i => i.productId !== productId);
      const existing = prev.find(i => i.productId === productId);
      if (existing) {
        return prev.map(i => i.productId === productId ? { ...i, qty } : i);
      }
      return [...prev, { productId, qty }];
    });
  };

  const clear = () => setItems([]);

  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);

  const totalPrice = items.reduce((sum, i) => {
    const product = products.find(p => p.id === i.productId);
    if (!product) return sum;
    return sum + getLineTotal(product.price, i.qty);
  }, 0);

  const totalSavings = items.reduce((sum, i) => {
    const product = products.find(p => p.id === i.productId);
    if (!product) return sum;
    return sum + (product.price * i.qty - getLineTotal(product.price, i.qty));
  }, 0);

  const sendToWhatsApp = (details: CheckoutDetails) => {
    const lines = items.map(i => {
      const product = products.find(p => p.id === i.productId);
      const lineTotal = product ? getLineTotal(product.price, i.qty) : 0;
      return `• ${i.qty}x ${product?.name} — $${lineTotal.toFixed(2)}`;
    });
    const grandTotal = totalPrice + details.fulfillmentFee;
    const fulfillmentLine = `Fulfillment: ${FULFILLMENT_LABEL[details.fulfillment]}${
      details.fulfillmentFee > 0 ? ` (+$${details.fulfillmentFee.toFixed(2)})` : ''
    }`;
    const savingsLine = totalSavings > 0 ? `Volume savings: -$${totalSavings.toFixed(2)}` : null;
    const addressLine = details.address
      ? `Address: ${details.address.line1}, ${details.address.suburb}`
      : null;
    const text = [
      `Hi! I'd like to place an order with Sweet Sin 🍮`,
      '',
      ...lines,
      '',
      fulfillmentLine,
      savingsLine,
      addressLine,
      `Total: $${grandTotal.toFixed(2)}`,
      '',
      `Name: ${details.contact.name}`,
      `Phone: ${details.contact.phone}`,
      `Email: ${details.contact.email}`,
    ]
      .filter((line): line is string => line !== null)
      .join('\n');
    window.open(`${WHATSAPP_URL}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const openCheckout = () => setCheckoutOpen(true);
  const closeCheckout = () => setCheckoutOpen(false);

  return (
    <CartContext.Provider
      value={{
        items,
        add,
        remove,
        setQty,
        clear,
        totalQty,
        totalPrice,
        totalSavings,
        sendToWhatsApp,
        checkoutOpen,
        openCheckout,
        closeCheckout,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm run typecheck`
Expected: FAIL — `CartBar.tsx` still computes its per-line price as `product.price * item.qty` (full price, no discount), which will now visibly disagree with the drawer's discounted bottom-line total once Task 3 is done, but does not itself cause a *type* error. This step should actually PASS at the type level (no new required props break existing call sites — `setQty`/`totalSavings` are additive). If it fails, read the error; it means a call site needs updating that this plan didn't anticipate.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/cart.tsx
git commit -m "$(cat <<'EOF'
feat: apply volume discounts to cart totals and WhatsApp order text

CartContext now computes totalPrice/totalSavings via pricing.ts's
per-line discount math, and exposes setQty for jumping straight to a
large quantity instead of only +1 increments.
EOF
)"
```

---

### Task 3: Show discounted per-line prices and savings in `CartBar`

**Files:**
- Modify: `apps/web/src/components/ui/CartBar.tsx`

**Interfaces:**
- Consumes: `getLineTotal` from `@/lib/pricing` (Task 1), `totalSavings` from `useCart()` (Task 2).

- [ ] **Step 1: Add the import**

At the top of `apps/web/src/components/ui/CartBar.tsx`:

```tsx
import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { useCart } from '@/lib/cart';
import { products } from '@/lib/data';
import { getLineTotal } from '@/lib/pricing';
```

- [ ] **Step 2: Destructure `totalSavings`**

Change:

```tsx
  const { items, add, remove, clear, totalQty, totalPrice, openCheckout } = useCart();
```

to:

```tsx
  const { items, add, remove, clear, totalQty, totalPrice, totalSavings, openCheckout } = useCart();
```

- [ ] **Step 3: Use the discounted line price**

Change:

```tsx
                  <p className="font-mono text-[12px] text-sin-red">${(product.price * item.qty).toFixed(2)}</p>
```

to:

```tsx
                  <p className="font-mono text-[12px] text-sin-red">${getLineTotal(product.price, item.qty).toFixed(2)}</p>
```

- [ ] **Step 4: Show total savings above the total**

Find:

```tsx
          <div className="border-t border-navy/10 pt-4 flex justify-between items-center mb-6">
            <span className="font-mono text-[11px] uppercase tracking-wider text-navy/40">Total</span>
            <span className="font-serif font-bold text-navy text-xl">${totalPrice.toFixed(2)}</span>
          </div>
```

Replace with:

```tsx
          {totalSavings > 0 && (
            <div className="flex justify-between items-center mb-1 text-sin-red">
              <span className="font-mono text-[10px] uppercase tracking-wider">Volume savings</span>
              <span className="font-mono text-[12px] font-semibold">-${totalSavings.toFixed(2)}</span>
            </div>
          )}
          <div className="border-t border-navy/10 pt-4 flex justify-between items-center mb-6">
            <span className="font-mono text-[11px] uppercase tracking-wider text-navy/40">Total</span>
            <span className="font-serif font-bold text-navy text-xl">${totalPrice.toFixed(2)}</span>
          </div>
```

- [ ] **Step 5: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ui/CartBar.tsx
git commit -m "feat: show discounted line prices and total savings in cart drawer"
```

---

### Task 4: Quantity input, Coffee filter, and discount badge on `MenuCard`

**Files:**
- Modify: `apps/web/src/components/sections/Menu.tsx`

**Interfaces:**
- Consumes: `setQty` from `useCart()` (Task 2), `getDiscountForQty` and `VOLUME_TIERS` from `@/lib/pricing` (Task 1).

- [ ] **Step 1: Add the pricing import and the Coffee filter**

Change:

```tsx
import { useState, useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { products, Product } from '@/lib/data';
import { useCart } from '@/lib/cart';
import { isMotionOk } from '@/lib/animations';

export default function Menu() {
  const [filter, setFilter] = useState<'all' | 'sin' | 'virtue'>('all');
```

to:

```tsx
import { useState, useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { products, Product } from '@/lib/data';
import { useCart } from '@/lib/cart';
import { getDiscountForQty, VOLUME_TIERS } from '@/lib/pricing';
import { isMotionOk } from '@/lib/animations';

type Filter = 'all' | 'sin' | 'virtue' | 'coffee';

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  sin: 'Sins',
  virtue: 'Virtues',
  coffee: 'Coffee',
};

export default function Menu() {
  const [filter, setFilter] = useState<Filter>('all');
```

- [ ] **Step 2: Use `FILTER_LABELS` for the filter pills**

Change:

```tsx
          <div className="flex bg-navy/[0.06] p-1 rounded-full w-max">
            {['all', 'sin', 'virtue'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as 'all' | 'sin' | 'virtue')}
                className={`px-5 py-2 rounded-full font-mono text-[10px] uppercase tracking-wider transition-all duration-300 ${
                  filter === f ? 'bg-sin-red text-white shadow-lg' : 'text-navy/40 hover:text-navy'
                }`}
              >
                {f === 'all' ? 'All' : f === 'sin' ? 'Sins' : 'Virtues'}
              </button>
            ))}
          </div>
```

to:

```tsx
          <div className="flex bg-navy/[0.06] p-1 rounded-full w-max">
            {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2 rounded-full font-mono text-[10px] uppercase tracking-wider transition-all duration-300 ${
                  filter === f ? 'bg-sin-red text-white shadow-lg' : 'text-navy/40 hover:text-navy'
                }`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>
```

- [ ] **Step 3: Add the quantity input and discount badge to `MenuCard`**

Change:

```tsx
function MenuCard({ product }: { product: Product }) {
  const { add, items } = useCart();
  const inCart = items.find(i => i.productId === product.id);
```

to:

```tsx
function MenuCard({ product }: { product: Product }) {
  const { add, setQty, items } = useCart();
  const inCart = items.find(i => i.productId === product.id);
  const tier = inCart ? getDiscountForQty(inCart.qty) : null;
  const nextTierIndex = (tier ? VOLUME_TIERS.indexOf(tier) : VOLUME_TIERS.length) - 1;
  const nextTier = nextTierIndex >= 0 ? VOLUME_TIERS[nextTierIndex] : null;
```

Then change the price/add-button row:

```tsx
        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="font-mono text-[13px] md:text-[16px] text-sin-red font-semibold">${product.price}</span>
          <button
            onClick={() => add(product.id)}
            aria-label={`Add ${product.name} to order`}
            className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-sin-red text-white flex items-center justify-center hover:bg-sin-red-light active:scale-95 transition-all shadow-[0_2px_8px_rgba(230,57,70,0.30)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
```

to:

```tsx
        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="font-mono text-[13px] md:text-[16px] text-sin-red font-semibold">${product.price}</span>
          {inCart ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                value={inCart.qty}
                onChange={(e) => setQty(product.id, Math.max(0, Math.floor(Number(e.target.value)) || 0))}
                aria-label={`${product.name} quantity`}
                className="w-12 text-center font-mono text-[12px] text-navy border border-navy/15 rounded-full py-1 focus:border-sin-red outline-none"
              />
              <button
                onClick={() => add(product.id)}
                aria-label={`Add another ${product.name} to order`}
                className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-sin-red text-white flex items-center justify-center hover:bg-sin-red-light active:scale-95 transition-all shadow-[0_2px_8px_rgba(230,57,70,0.30)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => add(product.id)}
              aria-label={`Add ${product.name} to order`}
              className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-sin-red text-white flex items-center justify-center hover:bg-sin-red-light active:scale-95 transition-all shadow-[0_2px_8px_rgba(230,57,70,0.30)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          )}
        </div>
        {inCart && (tier || nextTier) && (
          <p className="text-[10px] font-mono text-sin-red/80 leading-tight">
            {tier
              ? `${Math.round(tier.discountPct * 100)}% off applied${nextTier ? ` — ${Math.round(nextTier.discountPct * 100)}% off at ${nextTier.minQty}+` : ''}`
              : `${Math.round((nextTier as NonNullable<typeof nextTier>).discountPct * 100)}% off at ${(nextTier as NonNullable<typeof nextTier>).minQty}+`}
          </p>
        )}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/sections/Menu.tsx
git commit -m "$(cat <<'EOF'
feat: add quantity input, Coffee filter, and discount badge to Menu

Once an item is in the cart, its card shows a quantity input (so you
can type 50 instead of clicking + fifty times) and a badge showing
the volume discount applied or the next tier's threshold.
EOF
)"
```

---

### Task 5: Show total savings in `CheckoutModal`'s payment step

**Files:**
- Modify: `apps/web/src/components/ui/CheckoutModal.tsx`

**Interfaces:**
- Consumes: `totalSavings` from `useCart()` (Task 2).

- [ ] **Step 1: Destructure `totalSavings`**

Change:

```tsx
  const { totalPrice, clear, checkoutOpen, closeCheckout, sendToWhatsApp } = useCart();
```

to:

```tsx
  const { totalPrice, totalSavings, clear, checkoutOpen, closeCheckout, sendToWhatsApp } = useCart();
```

- [ ] **Step 2: Show the savings line above the total on the payment step**

Change:

```tsx
              <h3 className="font-serif font-bold text-navy text-xl mb-2">Pay</h3>
              <div className="flex justify-between items-center border-t border-b border-navy/10 py-3 mb-6">
                <span className="font-mono text-[11px] uppercase tracking-wider text-navy/40">Total</span>
                <span className="font-serif font-bold text-navy text-xl">${grandTotal.toFixed(2)}</span>
              </div>
```

to:

```tsx
              <h3 className="font-serif font-bold text-navy text-xl mb-2">Pay</h3>
              {totalSavings > 0 && (
                <p className="text-[13px] text-sin-red font-medium mb-2">
                  You're saving ${totalSavings.toFixed(2)} with volume pricing
                </p>
              )}
              <div className="flex justify-between items-center border-t border-b border-navy/10 py-3 mb-6">
                <span className="font-mono text-[11px] uppercase tracking-wider text-navy/40">Total</span>
                <span className="font-serif font-bold text-navy text-xl">${grandTotal.toFixed(2)}</span>
              </div>
```

- [ ] **Step 3: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Run: `pnpm --filter @workspace/web run dev`, open the app, and verify in order:

1. The Menu's filter pills now read All / Sins / Virtues / Coffee, and clicking "Coffee" shows only "Sweet Sin Coffee" ($4.50).
2. Click "+" once on Sweet Sin Coffee. A quantity input (showing `1`) plus a "+" button now sit where the single "+" button used to be. No discount badge yet.
3. Click into the quantity input, clear it, and type `20`, then blur/tab away. The card immediately shows "5% off applied — 10% off at 50+". The cart pill's total reflects $4.50 × 20 × 0.95 = $85.50.
4. Type `50` into the same input. Badge updates to "10% off applied — 15% off at 100+".
5. Type `100`. Badge updates to "15% off applied" (no "next tier" clause — top tier reached).
6. Open the cart drawer: the coffee line's price matches the discounted line total (not `$4.50 × qty`), and a red "Volume savings: -$X" row appears above the "Total" row.
7. Add a second product (e.g. one Gluttony) at qty 1 — confirm it shows no discount and the coffee line's discount is unaffected (tiers are per-line, not combined).
8. Click "Checkout" → proceed through fulfillment (Pickup) → contact → payment step: "You're saving $X with volume pricing" appears above the total, and the total matches the drawer's total.
9. Click "Order via WhatsApp": the generated message includes a `Volume savings: -$X` line between the fulfillment line and the total.
10. Back in the Menu, type `0` into the coffee quantity input → the card reverts to showing a single "+" button (item removed from cart), matching the existing `remove`-to-empty behavior.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/CheckoutModal.tsx
git commit -m "feat: show volume-pricing savings in the checkout payment step"
```

---

## Self-Review Notes

- **Spec coverage:** Coffee product/category (Task 1), discount engine with the exact 20/50/100 tiers (Task 1), cart-wide discounted totals (Task 2), quantity input + badge on Menu (Task 4), savings visible in drawer (Task 3) and checkout (Task 5), WhatsApp message savings line (Task 2). Per-line (not combined) discount logic is enforced by `pricing.ts` operating on a single `(unitPrice, qty)` pair per call, always invoked once per cart line — never on a combined total.
- **Type consistency:** `VolumeTier`, `getDiscountForQty`, `getDiscountedUnitPrice`, and `getLineTotal` are defined once in `pricing.ts` (Task 1) and imported everywhere else (Tasks 2–5) rather than reimplemented.
- **No placeholders:** every step contains complete code, not a description of what to write.
