# Phase 7 — Cart + Checkout

Date: 2026-09-23 · Also includes the light-theme fix (the site no longer follows the OS dark mode).

## What works

| Piece | Behaviour (from the prototype) |
|---|---|
| **Add to cart** | On every product card (default option) and the product page (chosen option + quantity). Opens the **mini cart drawer**. Out-of-stock products show "Out of stock" (disabled). |
| **Header cart** | Badge + "N items - USD x", opens the drawer |
| **Mini cart** (drawer) | Lines with image, option, unit price, − / + (capped at stock), remove; subtotal; View cart / Checkout. Esc / overlay / navigation closes it. |
| **Resume checkout nudge** | 2.6 s after landing on a page with items in the cart (not on cart/checkout/order pages); dismissible |
| **`/cart`** | Lines, promo code (checked against the `Coupon` table: NEXORA10, WELCOME5), order summary, "Proceed to checkout" |
| **Totals** | Bulk tier + option price per line; promo % off the subtotal; **free shipping from $500** (after discount), else **$25**; **8 % tax** on the discounted subtotal (`src/lib/store-settings.ts`) |
| **`/checkout`** | Contact, shipping address, payment method (**Credit card / Purchase order / Bank transfer**), notes, summary with items |
| **Place order** (server action) | **Re-prices everything from the database** (the browser only sends product/option IDs and quantities), validates fields, checks coupon and stock, **reserves stock** (tracked products), upserts the `Customer` by email, creates `Order` + `OrderItem`s in one transaction |
| **Purchase order / bank transfer** | Order `PENDING` / `UNPAID` → confirmation page, cart cleared |
| **Credit card** | **Stripe Checkout** (hosted page, test mode) for the exact server total. Return → the server asks Stripe whether the session is paid (never trusts the URL) → `PAID` → confirmation, cart cleared. Cancel → order `CANCELLED`, **stock released**, back to checkout with the cart intact. |
| **`/order/<id>`** | "Thank you, {name}!" confirmation with items, totals and payment status. The id is an unguessable cuid. |
| Cart storage | Zustand + localStorage (`nexora-cart`), like the prototype's `nx_cart` |

## Stripe setup (needed for card payments)

Card payments are **off until a test key is set**; the other two methods work without Stripe.

1. Stripe Dashboard → switch on **Test mode** → Developers → API keys → copy the **Secret key** (`sk_test_…`)
2. Add it to `.env` (git-ignored): `STRIPE_SECRET_KEY=sk_test_...`
3. `docker compose restart app`
4. Pay with test card `4242 4242 4242 4242`, any future date, any CVC

Live keys (`sk_live_…`) are refused outside production.

## Schema change (migration `order_payment`)

`Order` gains `paymentStatus` (UNPAID / PAID / REFUNDED), `stripeSessionId` (unique) and `notes`. The seed marks processing/shipped/delivered demo orders as PAID (18) and pending/cancelled as UNPAID (6).

`prisma migrate dev` refuses to run without an interactive terminal when Prisma shows a warning (here: "unique constraint will be added"). The migration was created with `prisma migrate diff --from-config-datasource --to-schema … --script`, reviewed, and applied with `prisma migrate deploy`. Schema and DB are verified in sync.

**After any migration, restart the app** (`docker compose restart app`). `src/lib/db.ts` keeps one Prisma client across hot reloads, so the running server keeps the old client until it restarts. Before the restart, the cancel route failed with a validation error and a paid order showed "Awaiting payment".

## Packages

`zustand` 5.0.15, `stripe` 22.6.2 (server SDK only; hosted Checkout needs no browser SDK), both pinned exactly and installed in the container.

## Checks

| Check | Result |
|---|---|
| Server-side order (3 × Netgear M4250 + OptiPlex 32 GB option, NEXORA10, purchase order) | Subtotal **6,924.08**, discount **692.41**, shipping **0**, tax **498.53**, total **6,730.20**: exactly the hand-calculated values. Tier price $1,998.36 (−5 %), option +$180 applied. Netgear stock 6 → 3. |
| Rejections | Empty cart, missing fields (per-field messages), quantity above stock ("Only 6 … left"), card without Stripe, invalid coupon |
| Card cancel flow | Stock reserved 6 → 4, cancel route → order CANCELLED, stock back to 6; second call changes nothing |
| Pages | `/cart`, `/checkout`, `/checkout?canceled=1` → 200; `/order/<id>` shows "Credit card · Paid" / "Purchase order · Awaiting payment" correctly; unknown order → 404; cancel route redirects to `http://localhost:3100/checkout?canceled=1` |
| Shop page | 24 "Add to cart" buttons, header "0 items - USD 0.00", mini cart present |
| `tsc`, `eslint` | ✅; no errors in the container log after the restart |
| Test data | All test orders/customers deleted and stock restored (24 orders, 10 customers) |

**Not testable from the terminal:** clicks in the browser (drawer, cart persistence, the checkout form) and the real Stripe redirect (needs your test key). Please test those in the browser.
