# Bulk order volume discounts (frontend-only)

## Context

Sweet Sin's Menu only sells single-unit pastries today — "add to order" is a `+1` click, there's no way to select a large quantity, and there's no coffee product at all. Wholesale/catering customers (the site already has an "Events" section targeting corporate catering) commonly order large quantities of one item (e.g. 50+ coffees for an office event), and the business wants to reward that with automatic volume-based discounts.

Like the checkout prototype (`2026-08-09-checkout-prototype-design.md`), this is a **frontend-only prototype**: discount tiers and the coffee product are hardcoded in `apps/web`. No backend, no database changes.

## Non-goals

- No backend/DB changes — discount tiers live in a constant array in the frontend, not a database table.
- No per-customer or per-event negotiated pricing (that's what the existing "Get a quote" form in `Events.tsx` already covers, unchanged).
- No inventory/stock limits on large quantities.
- No changes to the "Get a quote" custom-quote flow.

## Product addition: Coffee

Add a new `Product` category `'coffee'` and one product to `apps/web/src/lib/data.ts`:

```ts
export interface Product {
  id: string;
  name: string;
  category: 'sin' | 'virtue' | 'coffee';
  price: number;
  description: string;
  available: boolean;
  featured?: boolean;
  image?: string;
}
```

```ts
{ id: 'p16', name: 'Sweet Sin Coffee', category: 'coffee', price: 4.5, description: 'Locally roasted, made fresh at the trailer.', available: true, image: '/products/p16.jpg' },
```

(No product photo exists yet for coffee — `image` will 404 gracefully to the existing gradient placeholder used when `product.image` is falsy; for this prototype we ship without a real photo rather than block on one.)

`Menu.tsx`'s category filter pills (`All / Sins / Virtues`) gain a fourth: `Coffee`.

## Discount engine

New file `apps/web/src/lib/pricing.ts`, pure functions, no state:

```ts
export interface VolumeTier {
  minQty: number;
  discountPct: number; // e.g. 0.05 = 5%
}

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

Tiers apply **per product line** (same product, summed quantity across the cart), not to the cart's combined total — ordering 15 coffees + 15 croissants does not trigger the 20-unit tier for either line. This matches how the business actually thinks about volume ("50 coffees") per the original request.

`VOLUME_TIERS` is deliberately a flat exported array (not wrapped in a class/hook) so it's trivial to tune the thresholds later without touching any component.

## Cart integration

`CartContext` (`lib/cart.tsx`) currently computes `totalPrice` by summing `product.price * item.qty` with no discount awareness. It changes to use `getLineTotal` from `pricing.ts` for every line, so the discount applies everywhere `totalPrice` is already consumed (cart pill, drawer, `CheckoutModal`) with no per-component changes needed beyond showing the *savings*, which is new:

```ts
// in CartProvider, replacing the current totalPrice reduce:
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
```

`totalSavings` is added to `CartContextValue` and surfaced in the `CartBar` drawer and `CheckoutModal`'s payment step ("You're saving $X with volume pricing") whenever it's greater than 0. `sendToWhatsApp`'s message also includes it in the same conditional way.

`CartBar`'s per-line price (`${(product.price * item.qty).toFixed(2)}`, currently full-price) must switch to `getLineTotal(product.price, item.qty)` too — otherwise the line prices and the drawer's bottom-line total would disagree once a discount applies.

## Quantity selection UI

`MenuCard` (`Menu.tsx`) already shows a red `+` button and, when the item is in the cart, a small count bubble on the image corner. It gains a **quantity input**, shown only once the item is in the cart (i.e. `inCart` is truthy), replacing the `+` button's neighboring space with a compact stepper:

- A number `<input>` (width ~48px, centered text, same visual language as the existing `−`/`+` buttons in `CartBar`) bound to `inCart.qty`, editable directly (so someone can type `50` instead of clicking 50 times) plus a `+`/`−` pair for fine adjustment.
- `CartContext` needs a new `setQty(productId: string, qty: number)` alongside the existing `add`/`remove`, so the input can jump straight to an arbitrary value instead of only incrementing by 1. `qty <= 0` removes the line (same rule `remove` already follows).
- When `qty` reaches a tier threshold, the card shows a small badge under the price: `"5% off at 20+"` (or the next tier's message once inside a tier — e.g. at qty 25, show `"5% off applied — 10% off at 50+"` to upsell the next tier). This reuses `getDiscountForQty` and a simple "next tier" lookup (the tier in `VOLUME_TIERS` immediately below the current one, since the array is sorted descending by `minQty`).

## Error handling

- Typing a non-numeric or negative value in the quantity input is clamped to `0` (removes the line) — same permissive, non-blocking pattern as the rest of this prototype (no toast/error message, just clamps).
- No maximum quantity cap in this prototype (no stock model exists to cap against).

## Testing

Manual only, consistent with the rest of the app (no test runner exists). Verification steps:
1. Coffee appears in the Menu grid and under a new "Coffee" filter pill.
2. Add 1 coffee → no discount shown anywhere.
3. Type `20` directly into the quantity input → card shows "5% off" badge, cart pill/drawer/checkout totals reflect the discounted price, `totalSavings` displays in the drawer and checkout.
4. Increase to `50`, then `100` → badge and totals update to 10%, then 15%, at each threshold.
5. Two different products at qty 15 and 15 (30 combined) → neither gets a discount (tiers are per-line, not combined).
6. Complete checkout via WhatsApp with a discounted quantity → message includes the savings line.
7. Type `0` or a negative number into the quantity input → line is removed from the cart.

## Follow-up (not covered here)

- Real product photo for coffee.
- Making `VOLUME_TIERS` configurable from a database/admin UI instead of hardcoded (only worth doing once this prototype's UX is validated).
- Coffee-specific fulfillment/prep-time considerations (e.g. large coffee orders may need lead time) — out of scope; this spec only covers pricing/UI.
