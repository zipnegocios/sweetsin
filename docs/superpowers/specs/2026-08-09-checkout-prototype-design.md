# Checkout flow prototype (frontend-only)

## Context

The "Start your order" button in the Preorder section (`apps/web/src/components/sections/Preorder.tsx`) is a placeholder: `onClick={() => window.alert('Order flow would open here')}`. The section's copy also promises a Stripe card-payment flow ("Pay securely — Stripe checkout, under 2 min") that doesn't exist — the only working checkout today is the WhatsApp flow in `CartBar.tsx` (`sendToWhatsApp` in `lib/cart.tsx`).

The long-term goal is a real dual-payment (WhatsApp / Stripe), dual-fulfillment (pickup / self-delivery / courier via Uber Direct) checkout backed by an `orders` table. That full system is a multi-subsystem project (Stripe integration + webhook, order persistence, courier API integration, delivery pricing). This spec covers only the **first step**: a frontend-only prototype that draws the complete flow end-to-end with hardcoded/mocked data, so the UX can be validated before any backend work starts.

## Non-goals (explicitly out of scope for this spec)

- No backend endpoints, no database schema changes.
- No real Stripe integration (no Stripe.js, no PaymentIntent, no webhook).
- No real courier/Uber Direct integration, no real distance-based pricing, no geocoding or address validation.
- No order persistence of any kind — nothing survives a page refresh.

## Architecture

Everything lives in `apps/web`. One new component, `CheckoutModal`, implements a multi-step wizard using local component state (`useState`) — no new dependencies, no changes to `CartContext`.

**Entry points:**
- `Preorder.tsx`'s "Start your order" button: if the cart is empty, smooth-scrolls to `#menu`; if the cart has items, opens `CheckoutModal`.
- `CartBar.tsx`: the existing "Send order via WhatsApp" button is replaced with a "Checkout" button that opens `CheckoutModal`. The drawer itself (item list, qty controls, clear) is unchanged.

## Wizard steps

State shape (local to `CheckoutModal`):

```ts
type Fulfillment = 'pickup' | 'self-delivery' | 'courier';
type PaymentMethod = 'whatsapp' | 'card';

interface CheckoutState {
  step: 'fulfillment' | 'address' | 'contact' | 'payment' | 'confirmation';
  fulfillment: Fulfillment | null;
  address: { line1: string; suburb: string } | null;
  contact: { name: string; phone: string; email: string };
  paymentMethod: PaymentMethod | null;
}
```

1. **Fulfillment** — three cards: Pickup (free), Self-delivery (flat **$5**, hardcoded constant), Courier delivery (shows an 800ms fake "Calculating delivery fee…" spinner, then displays a hardcoded **$8.50**). Selecting one advances the wizard. This step exists to demonstrate all three fulfillment/pricing modes visually — none of the fees are computed from anything real.
2. **Address** — shown only if `fulfillment !== 'pickup'`. Two plain text inputs (street address, suburb). No geocoding, no validation beyond non-empty.
3. **Contact** — name, phone, email. Plain text inputs, required (non-empty), matching the existing inline-validation style used by `NewsletterForm` in `FindUs.tsx` (no react-hook-form, this is a throwaway prototype).
4. **Payment method** — two options:
   - **WhatsApp**: real, reuses the existing `sendToWhatsApp()` from `lib/cart.tsx`, extended to include the fulfillment choice, address (if any), and contact info in the message body. Closes the modal after opening WhatsApp (matches current behavior).
   - **Card**: fully mocked. Renders a static card-number/expiry/CVC form styled to resemble a Stripe Payment Element (no real input masking or validation beyond non-empty). A "Pay $X" button triggers a fake 1.2s loading state, then advances to the confirmation step. No network call, no real charge.
5. **Confirmation** — success screen with an order summary (items, fulfillment choice, total incl. delivery fee if any), styled consistently with the rest of the site. A "Done" button closes the modal and clears the cart (`clear()` from `useCart()`).

## Error handling

Minimal, since nothing is real: required-field checks block advancing between steps (inline red text under the field, consistent with existing form patterns). No other error states are modeled — e.g. there is no "card declined" simulation.

## Testing

Manual verification only (no automated tests exist elsewhere in `apps/web`): click through all three fulfillment options, both address-required and pickup (no-address) paths, both payment methods, and confirm the WhatsApp message includes the new fulfillment/contact fields correctly.

## Follow-up (separate specs, not covered here)

- Real Stripe integration (Payment Element + backend PaymentIntent + webhook).
- `orders` table in `lib/db`, unifying WhatsApp and Stripe orders.
- Real delivery: self-delivery fee configuration, Uber Direct integration for courier quoting/dispatch.
