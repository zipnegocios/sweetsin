# Checkout Flow Prototype (Frontend-Only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder "Start your order" button and the WhatsApp-only cart checkout with a multi-step wizard (fulfillment choice → address → contact → payment method → confirmation) that runs entirely client-side with hardcoded/mocked fulfillment fees and a mocked card payment, per `docs/superpowers/specs/2026-08-09-checkout-prototype-design.md`.

**Architecture:** One new component, `CheckoutModal`, added to `apps/web/src/components/ui/`. It is mounted once (in `App.tsx`, alongside the existing `CartBar`) and its open/closed state plus the (slightly extended) `sendToWhatsApp` function live in the existing `CartContext` (`lib/cart.tsx`), so both `Preorder.tsx` and `CartBar.tsx` — which are sibling components, not parent/child — can trigger it without prop drilling.

**Tech Stack:** React 19 + TypeScript, Tailwind v4 utility classes (no new dependencies). No backend calls, no new environment variables.

## Global Constraints

- No backend/API changes. No changes to `apps/api` or `lib/db`.
- No new npm dependencies.
- Fulfillment fees are hardcoded constants: self-delivery = $5.00, courier = $8.50 (revealed after an 800ms fake "calculating" delay), pickup = $0.
- Card payment is fully mocked: disabled-looking static inputs, a 1200ms fake loading state, no real Stripe code anywhere.
- WhatsApp payment path is real — it reuses and extends the existing `sendToWhatsApp` — and closes the modal immediately without showing the confirmation step (matches current pre-existing behavior). Only the mocked card path reaches the confirmation step.
- No automated test runner exists in this repo (confirmed: no Jest/Vitest/Playwright in any `package.json`). Per the spec's own Testing section, verification for every task in this plan is **manual**: run `pnpm --filter @workspace/web run dev`, open the app in a browser, and click through the described interaction. Do not invent a test framework for this — that would be scope creep beyond the spec.
- Run `pnpm run typecheck` after every task that touches `.tsx`/`.ts` files, before committing.

---

### Task 1: Extend `CartContext` with checkout wizard state and a richer `sendToWhatsApp`

**Files:**
- Modify: `apps/web/src/lib/cart.tsx`

**Interfaces:**
- Produces: `export interface CheckoutDetails { fulfillment: 'pickup' | 'self-delivery' | 'courier'; fulfillmentFee: number; address?: { line1: string; suburb: string }; contact: { name: string; phone: string; email: string }; }`
- Produces (added to `useCart()` return value): `checkoutOpen: boolean`, `openCheckout: () => void`, `closeCheckout: () => void`
- Changes signature of `sendToWhatsApp` from `() => void` to `(details: CheckoutDetails) => void` — this is a breaking change to the only two current call sites, both of which are fixed in Task 4.

- [ ] **Step 1: Replace the full contents of `apps/web/src/lib/cart.tsx`**

```tsx
import { createContext, useContext, useState, ReactNode } from 'react';
import { products, WHATSAPP_URL } from './data';

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
  clear: () => void;
  totalQty: number;
  totalPrice: number;
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

  const clear = () => setItems([]);

  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);

  const totalPrice = items.reduce((sum, i) => {
    const product = products.find(p => p.id === i.productId);
    return sum + (product?.price ?? 0) * i.qty;
  }, 0);

  const sendToWhatsApp = (details: CheckoutDetails) => {
    const lines = items.map(i => {
      const product = products.find(p => p.id === i.productId);
      return `• ${i.qty}x ${product?.name} — $${((product?.price ?? 0) * i.qty).toFixed(2)}`;
    });
    const grandTotal = totalPrice + details.fulfillmentFee;
    const fulfillmentLine = `Fulfillment: ${FULFILLMENT_LABEL[details.fulfillment]}${
      details.fulfillmentFee > 0 ? ` (+$${details.fulfillmentFee.toFixed(2)})` : ''
    }`;
    const addressLine = details.address
      ? `Address: ${details.address.line1}, ${details.address.suburb}`
      : null;
    const text = [
      `Hi! I'd like to place an order with Sweet Sin 🍮`,
      '',
      ...lines,
      '',
      fulfillmentLine,
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
        clear,
        totalQty,
        totalPrice,
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

- [ ] **Step 2: Typecheck (expected to fail — call sites not fixed yet)**

Run: `pnpm run typecheck`
Expected: FAIL — `apps/web/src/components/ui/CartBar.tsx` still calls `sendToWhatsApp()` with no arguments. This is expected; Task 4 fixes it. Do not commit yet.

---

### Task 2: Create `CheckoutModal`

**Files:**
- Create: `apps/web/src/components/ui/CheckoutModal.tsx`

**Interfaces:**
- Consumes: `useCart()` → `{ totalPrice, clear, checkoutOpen, closeCheckout, sendToWhatsApp }` (from Task 1) and `CheckoutDetails` type.
- Produces: `export default function CheckoutModal(): JSX.Element | null` — a self-contained component with no props, mounted once in Task 3.

- [ ] **Step 1: Create `apps/web/src/components/ui/CheckoutModal.tsx`**

```tsx
import { useState } from 'react';
import { useCart, type CheckoutDetails } from '@/lib/cart';

type Fulfillment = CheckoutDetails['fulfillment'];
type Step = 'fulfillment' | 'address' | 'contact' | 'payment' | 'confirmation';

const SELF_DELIVERY_FEE = 5;
const COURIER_DELIVERY_FEE = 8.5;

const FULFILLMENT_LABEL: Record<Fulfillment, string> = {
  pickup: 'Pickup at the trailer',
  'self-delivery': 'Delivery by Sweet Sin',
  courier: 'Courier delivery',
};

interface ContactInfo {
  name: string;
  phone: string;
  email: string;
}

interface AddressInfo {
  line1: string;
  suburb: string;
}

const inputClass =
  'w-full bg-cream border border-navy/12 rounded-2xl px-5 py-3.5 text-sm text-navy placeholder:text-navy/35 focus:border-sin-red outline-none transition-colors';

export default function CheckoutModal() {
  const { totalPrice, clear, checkoutOpen, closeCheckout, sendToWhatsApp } = useCart();

  const [step, setStep] = useState<Step>('fulfillment');
  const [fulfillment, setFulfillment] = useState<Fulfillment | null>(null);
  const [courierFeeLoading, setCourierFeeLoading] = useState(false);
  const [address, setAddress] = useState<AddressInfo>({ line1: '', suburb: '' });
  const [contact, setContact] = useState<ContactInfo>({ name: '', phone: '', email: '' });
  const [addressError, setAddressError] = useState('');
  const [contactError, setContactError] = useState('');
  const [cardLoading, setCardLoading] = useState(false);

  if (!checkoutOpen) return null;

  const fulfillmentFee =
    fulfillment === 'self-delivery' ? SELF_DELIVERY_FEE : fulfillment === 'courier' ? COURIER_DELIVERY_FEE : 0;
  const grandTotal = totalPrice + fulfillmentFee;

  function reset() {
    setStep('fulfillment');
    setFulfillment(null);
    setAddress({ line1: '', suburb: '' });
    setContact({ name: '', phone: '', email: '' });
    setAddressError('');
    setContactError('');
    setCourierFeeLoading(false);
    setCardLoading(false);
  }

  function handleClose() {
    closeCheckout();
    reset();
  }

  function chooseFulfillment(choice: Fulfillment) {
    setFulfillment(choice);
    if (choice === 'courier') {
      setCourierFeeLoading(true);
      setTimeout(() => setCourierFeeLoading(false), 800);
    }
    setStep(choice === 'pickup' ? 'contact' : 'address');
  }

  function submitAddress() {
    if (!address.line1.trim() || !address.suburb.trim()) {
      setAddressError('Please fill in both fields.');
      return;
    }
    setAddressError('');
    setStep('contact');
  }

  function submitContact() {
    if (!contact.name.trim() || !contact.phone.trim() || !contact.email.trim()) {
      setContactError('Please fill in all fields.');
      return;
    }
    setContactError('');
    setStep('payment');
  }

  function buildDetails(): CheckoutDetails {
    return {
      fulfillment: fulfillment ?? 'pickup',
      fulfillmentFee,
      address: fulfillment === 'pickup' ? undefined : address,
      contact,
    };
  }

  function payWithWhatsApp() {
    sendToWhatsApp(buildDetails());
    handleClose();
  }

  function payWithCard() {
    setCardLoading(true);
    setTimeout(() => {
      setCardLoading(false);
      setStep('confirmation');
    }, 1200);
  }

  function finishConfirmation() {
    clear();
    handleClose();
  }

  function goBack() {
    if (step === 'address') setStep('fulfillment');
    else if (step === 'contact') setStep(fulfillment === 'pickup' ? 'fulfillment' : 'address');
    else if (step === 'payment') setStep('contact');
  }

  return (
    <>
      <div onClick={handleClose} className="fixed inset-0 z-[190] bg-navy/40 backdrop-blur-sm" />
      <div className="fixed inset-x-0 bottom-0 z-[195] bg-white rounded-t-3xl shadow-[0_-8px_48px_rgba(15,27,61,0.18)] max-h-[85vh] flex flex-col">
        <div className="w-12 h-1 bg-navy/15 rounded-full mx-auto mt-3 mb-4 flex-shrink-0" />

        <div className="px-6 pb-8 overflow-y-auto">
          {step !== 'fulfillment' && step !== 'confirmation' && (
            <button
              onClick={goBack}
              className="font-mono text-[10px] uppercase tracking-wider text-navy/40 hover:text-sin-red transition-colors mb-4"
            >
              ← Back
            </button>
          )}

          {step === 'fulfillment' && (
            <div>
              <h3 className="font-serif font-bold text-navy text-xl mb-6">How do you want it?</h3>
              <div className="space-y-3">
                <button
                  onClick={() => chooseFulfillment('pickup')}
                  className="w-full text-left border border-navy/10 rounded-2xl p-4 hover:border-sin-red transition-colors"
                >
                  <p className="font-medium text-navy">Pickup at the trailer</p>
                  <p className="text-[13px] text-navy/50">Free</p>
                </button>
                <button
                  onClick={() => chooseFulfillment('self-delivery')}
                  className="w-full text-left border border-navy/10 rounded-2xl p-4 hover:border-sin-red transition-colors"
                >
                  <p className="font-medium text-navy">Delivery by Sweet Sin</p>
                  <p className="text-[13px] text-navy/50">${SELF_DELIVERY_FEE.toFixed(2)} flat fee</p>
                </button>
                <button
                  onClick={() => chooseFulfillment('courier')}
                  className="w-full text-left border border-navy/10 rounded-2xl p-4 hover:border-sin-red transition-colors"
                >
                  <p className="font-medium text-navy">Courier delivery</p>
                  <p className="text-[13px] text-navy/50">Calculated at next step</p>
                </button>
              </div>
            </div>
          )}

          {step === 'address' && (
            <div>
              <h3 className="font-serif font-bold text-navy text-xl mb-2">Where to?</h3>
              {fulfillment === 'courier' && (
                <p className="text-[13px] text-navy/50 mb-4">
                  {courierFeeLoading
                    ? 'Calculating delivery fee…'
                    : `Delivery fee: $${COURIER_DELIVERY_FEE.toFixed(2)}`}
                </p>
              )}
              <div className="space-y-3 mb-4">
                <input
                  value={address.line1}
                  onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                  placeholder="Street address"
                  className={inputClass}
                />
                <input
                  value={address.suburb}
                  onChange={(e) => setAddress((a) => ({ ...a, suburb: e.target.value }))}
                  placeholder="Suburb"
                  className={inputClass}
                />
              </div>
              {addressError && <p className="text-sin-red text-[12px] mb-4">{addressError}</p>}
              <button
                onClick={submitAddress}
                disabled={fulfillment === 'courier' && courierFeeLoading}
                className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'contact' && (
            <div>
              <h3 className="font-serif font-bold text-navy text-xl mb-6">Your details</h3>
              <div className="space-y-3 mb-4">
                <input
                  value={contact.name}
                  onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Full name"
                  className={inputClass}
                />
                <input
                  value={contact.phone}
                  onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                  placeholder="Phone"
                  className={inputClass}
                />
                <input
                  value={contact.email}
                  onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                  placeholder="Email"
                  type="email"
                  className={inputClass}
                />
              </div>
              {contactError && <p className="text-sin-red text-[12px] mb-4">{contactError}</p>}
              <button
                onClick={submitContact}
                className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'payment' && (
            <div>
              <h3 className="font-serif font-bold text-navy text-xl mb-2">Pay</h3>
              <div className="flex justify-between items-center border-t border-b border-navy/10 py-3 mb-6">
                <span className="font-mono text-[11px] uppercase tracking-wider text-navy/40">Total</span>
                <span className="font-serif font-bold text-navy text-xl">${grandTotal.toFixed(2)}</span>
              </div>

              <button
                onClick={payWithWhatsApp}
                className="w-full bg-navy text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-navy-mid transition-colors mb-3"
              >
                Order via WhatsApp
              </button>

              <div className="border border-navy/10 rounded-2xl p-4 space-y-3">
                <p className="font-medium text-navy text-[14px]">Pay with card</p>
                <input
                  disabled
                  placeholder="4242 4242 4242 4242"
                  className="w-full bg-cream border border-navy/12 rounded-xl px-4 py-3 text-sm text-navy/60 placeholder:text-navy/35"
                />
                <div className="flex gap-3">
                  <input
                    disabled
                    placeholder="MM / YY"
                    className="w-1/2 bg-cream border border-navy/12 rounded-xl px-4 py-3 text-sm text-navy/60 placeholder:text-navy/35"
                  />
                  <input
                    disabled
                    placeholder="CVC"
                    className="w-1/2 bg-cream border border-navy/12 rounded-xl px-4 py-3 text-sm text-navy/60 placeholder:text-navy/35"
                  />
                </div>
                <button
                  onClick={payWithCard}
                  disabled={cardLoading}
                  className="w-full bg-sin-red text-white py-3.5 rounded-xl font-bold text-[14px] tracking-wide hover:bg-sin-red-light transition-colors disabled:opacity-60"
                >
                  {cardLoading ? 'Processing…' : `Pay $${grandTotal.toFixed(2)}`}
                </button>
              </div>
            </div>
          )}

          {step === 'confirmation' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-sin-red/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#E63946"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="font-serif font-bold text-navy text-xl mb-2">You're in!</h3>
              <p className="text-navy/50 text-[14px] mb-6">
                {FULFILLMENT_LABEL[fulfillment ?? 'pickup']} · ${grandTotal.toFixed(2)}
              </p>
              <button
                onClick={finishConfirmation}
                className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm run typecheck`
Expected: Still FAIL for the same pre-existing `CartBar.tsx` reason as Task 1 — `CheckoutModal.tsx` itself must show no new errors. Read the output and confirm the only error mentions `CartBar.tsx`, not `CheckoutModal.tsx`.

---

### Task 3: Mount `CheckoutModal` in `App.tsx`

**Files:**
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `CheckoutModal` default export from Task 2.

- [ ] **Step 1: Add the import**

In `apps/web/src/App.tsx`, alongside the existing `CartBar` import:

```tsx
import CartBar from './components/ui/CartBar';
import CheckoutModal from './components/ui/CheckoutModal';
```

- [ ] **Step 2: Mount it next to `<CartBar />`**

Find the `Home()` function's JSX, which currently ends with:

```tsx
        <MobileNav />
        <CartBar />
      </main>
```

Change it to:

```tsx
        <MobileNav />
        <CartBar />
        <CheckoutModal />
      </main>
```

`CheckoutModal` reads `checkoutOpen` from `useCart()` itself and renders `null` when closed, so no prop is needed — it just needs to be inside `<CartProvider>`, which it already is as a sibling of `CartBar`.

- [ ] **Step 3: Typecheck**

Run: `pnpm run typecheck`
Expected: Still FAIL for the same `CartBar.tsx` reason — confirm no new errors from `App.tsx`.

---

### Task 4: Wire `CartBar` and `Preorder` to the new checkout flow

**Files:**
- Modify: `apps/web/src/components/ui/CartBar.tsx:1-10` (imports/destructure) and `:110-118` (the WhatsApp button)
- Modify: `apps/web/src/components/sections/Preorder.tsx:1` (imports) and `:91-99` (the button)

**Interfaces:**
- Consumes: `openCheckout` and `totalQty` from `useCart()` (both already produced by Task 1).

- [ ] **Step 1: Update `CartBar.tsx`'s destructure**

Change line 7 from:

```tsx
  const { items, add, remove, clear, totalQty, totalPrice, sendToWhatsApp } = useCart();
```

to:

```tsx
  const { items, add, remove, clear, totalQty, totalPrice, openCheckout } = useCart();
```

- [ ] **Step 2: Replace the WhatsApp button with a checkout button**

Find this block (around line 110-118):

```tsx
          <button
            onClick={() => { sendToWhatsApp(); setOpen(false); }}
            className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors shadow-[0_4px_20px_rgba(230,57,70,0.28)] flex items-center justify-center gap-3 mb-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Send order via WhatsApp
          </button>
          <p className="text-center font-mono text-[9px] text-navy/30 uppercase tracking-wider pb-2">
            We'll confirm pickup time with you
          </p>
```

Replace it with:

```tsx
          <button
            onClick={() => { openCheckout(); setOpen(false); }}
            className="w-full bg-sin-red text-white py-4 rounded-2xl font-bold text-[15px] tracking-wide hover:bg-sin-red-light transition-colors shadow-[0_4px_20px_rgba(230,57,70,0.28)] flex items-center justify-center gap-3 mb-2"
          >
            Checkout
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
          <p className="text-center font-mono text-[9px] text-navy/30 uppercase tracking-wider pb-2">
            Choose pickup, delivery, and how you'd like to pay
          </p>
```

- [ ] **Step 3: Update `Preorder.tsx`**

Add the import at the top of the file (it currently has no `@/lib/cart` import):

```tsx
import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { isMotionOk } from '@/lib/animations';
import { useCart } from '@/lib/cart';
```

Inside `export default function Preorder()`, right after the `containerRef` declaration, add:

```tsx
  const { totalQty, openCheckout } = useCart();

  function handleStartOrder() {
    if (totalQty === 0) {
      document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    openCheckout();
  }
```

Then replace the button's `onClick`:

```tsx
        <button 
          onClick={() => window.alert('Order flow would open here')}
```

with:

```tsx
        <button 
          onClick={handleStartOrder}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS with zero errors — this is the task that resolves the `sendToWhatsApp` signature mismatch introduced in Task 1.

- [ ] **Step 5: Manual verification**

Run: `pnpm --filter @workspace/web run dev`, open `http://localhost:3000` (set `PORT`/`BASE_PATH` per `apps/web/.env` as established earlier in this project).

Verify, in order:
1. Click "Start your order" in the Ready to Sin section with an empty cart → page smooth-scrolls to the Menu section.
2. Add 2 different items from the Menu. The floating cart pill appears.
3. Click the cart pill → drawer opens showing both items and a "Checkout" button (not "Send order via WhatsApp").
4. Click "Checkout" → drawer closes, `CheckoutModal` opens on the "How do you want it?" step.
5. Click "Pickup at the trailer" → wizard skips straight to the "Your details" (contact) step (no address step).
6. Click "← Back" → returns to the fulfillment step. Click "Delivery by Sweet Sin" this time → address step appears with no "Calculating…" text, fee shown as $5.00 on the eventual payment step.
7. Leave both address fields empty and click "Continue" → inline error appears, step does not advance. Fill both fields, click "Continue" → advances to contact step.
8. Leave a contact field empty and click "Continue" → inline error, step does not advance. Fill all three, click "Continue" → advances to the payment step, total shown includes the $5.00 delivery fee.
9. Click "Pay $X" under "Pay with card" → button shows "Processing…" for ~1.2s, then the confirmation ("You're in!") screen appears with the correct fulfillment label and total.
10. Click "Done" → modal closes, cart pill disappears (cart was cleared).
11. Repeat from step 2, this time choosing "Courier delivery" → address step shows "Calculating delivery fee…" briefly, then "Delivery fee: $8.50"; the "Continue" button is disabled while calculating.
12. Repeat once more choosing any fulfillment, and at the payment step click "Order via WhatsApp" instead of paying by card → a new browser tab/window opens to `wa.me` with a pre-filled message that includes the item lines, the fulfillment line (with fee if applicable), address (if applicable), total, and the name/phone/email entered; the modal closes immediately (no confirmation screen); the cart pill is still showing (cart was NOT cleared by this path).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/cart.tsx apps/web/src/components/ui/CheckoutModal.tsx apps/web/src/App.tsx apps/web/src/components/ui/CartBar.tsx apps/web/src/components/sections/Preorder.tsx
git commit -m "$(cat <<'EOF'
feat: add checkout flow prototype (fulfillment, contact, payment)

Frontend-only wizard replacing the placeholder "Start your order"
button and the WhatsApp-only cart checkout. Fulfillment fees
(self-delivery, courier) and card payment are mocked per
docs/superpowers/specs/2026-08-09-checkout-prototype-design.md —
no backend, no real Stripe, no real courier integration yet.
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** All 5 wizard steps (fulfillment, address, contact, payment, confirmation), both entry points (Preorder button, CartBar), both payment methods (WhatsApp real / card mocked), and all three fulfillment modes with their specified fees are covered by Tasks 1–4.
- **Type consistency:** `CheckoutDetails` is defined once in `lib/cart.tsx` (Task 1) and imported by `CheckoutModal.tsx` (Task 2) rather than redefined — no drift risk. `Fulfillment` in `CheckoutModal.tsx` is derived as `CheckoutDetails['fulfillment']` rather than a second hand-written union, so the two can't diverge.
- **No placeholders:** every step above contains complete, copy-pasteable code — no "TODO" or "similar to Task N" shortcuts.
