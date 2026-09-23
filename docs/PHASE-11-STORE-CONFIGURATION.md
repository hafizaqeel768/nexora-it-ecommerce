# Phase 11 — Store Configuration

Date: 2026-09-23 · First phase of the store-management roadmap (see PROJECT-PLAN.md).

**Goal:** a non-technical owner configures the store in **Admin → Settings**, Magento-style, without code changes.

## Settings tabs (`/admin/settings`)

| Tab | What you can change | Where it shows up |
|---|---|---|
| **Store details** | Store name, tagline, announcement bar, **logo image upload** (or text logo + red accent part), support/sales email, phone, address, footer about text, copyright line (`{year}`), LinkedIn/X/Facebook/YouTube links | Header (logo, announcement), footer (only filled-in contacts and social icons), every **page title** ("Cart \| Store name"), email branding, admin sidebar, Stripe order name |
| **Shipping** | **Zones** (countries via a searchable checklist, optional states, order) and per zone **methods**: name, flat rate or local pickup, price, "free from" amount, "only offered from" amount, on/off, order | Checkout: only countries you ship to; methods and prices update live from the address; the server rejects any method that doesn't belong to the address |
| **Tax** | **Rates** by country and state (or "All countries"), %, "also tax shipping" | Checkout (live) and the order: most specific rate wins (state → country → all). **Tax-exempt customers** are switched on per customer in Customers |
| **Payments** | Per method (card, purchase order, bank transfer): on/off, name, customer instructions (e.g. **bank details**); Stripe status (test/live/not set up) | Checkout shows only enabled methods; instructions appear at checkout, on the order page (while unpaid) and in the confirmation email |
| **Checkout & stock** | Guest checkout on/off, minimum order, phone required, order-notes field, default country, low-stock alert | Checkout (guests are sent to login when off), server-side checks, dashboard/products low-stock |
| **Email** | Sender name and email, reply-to, **subject + intro text of every email** (order received, status update, confirm email, reset password, abandoned cart) with placeholders `{name} {order} {status} {store}`; **Send test email** | All emails |

Changes apply immediately. Existing orders keep the amounts, method and tax rate they were placed with.

**Secrets stay out of the admin:** the Stripe and Resend keys remain in the server's `.env` on purpose. The admin shows their status but never the key.

## How the numbers are worked out

- Shipping: the address matches the **first zone** listing its country (and state, if the zone has states). A zone with no countries is **rest of the world**. No match means "Sorry, we don't ship to …". Prices, "free from" and "only from" use the order total after discounts.
- Tax = rate × (subtotal − discount [+ shipping if the rate says so]). Tax-exempt accounts (when signed in) pay none.
- The browser shows live totals with the same functions (`src/lib/shipping.ts`), and **the server recomputes everything** when the order is placed.
- The cart page and mini cart now show "shipping and tax at checkout", since both depend on the address.

## Carried over from Phase 9

The migration moved the 4 old settings into the new model before dropping the old `StoreSettings` table: zone **"Everywhere"** (rest of the world) with **"Standard shipping" $25, free from $500**, tax **"Sales tax" 8 % for all countries**, and low stock at **10**. The storefront looked the same after the upgrade.

## Also fixed

- Checkout no longer wipes what the customer typed when the server rejects the order (it used a form action, which React resets).
- Checkout country is now a proper list of countries (ISO codes, names from `Intl`), and US states are a dropdown. Orders store the country code, shipping method name and tax rate.

## Schema (migration `store_configuration`)

New: `StoreConfig` (one JSON document per settings section; shapes and defaults in `src/lib/config-shared.ts`, merged over defaults on read), `ShippingZone`, `ShippingMethod`, `TaxRate`, `Customer.taxExempt`, `Order.countryCode/shippingMethod/taxRate`. Removed: `StoreSettings` (after the data carry-over above). Code removed: `src/lib/settings.ts`, `src/lib/store-settings.ts`, `StoreRulesProvider`, the old settings form.

## Checks

Real admin actions and orders against the live container, with a temporary admin and customer. All test data was deleted afterwards and **your settings were restored to exactly the pre-test backup** (Everywhere/$25/free from $500, 8 %, low stock 10, default store details). Your own test order NX-360924 (`haqeel775@gmail.com`) was left untouched.

| Area | Result |
|---|---|
| Access | All 6 tabs: admin 200, customer → "No admin access"; customer calls to settings actions rejected |
| Store details | Validation (store name, email, `javascript:` link refused); title + tagline, page title template, announcement, wordmark, footer (about, mailto, `tel:` link, address, copyright with year, only LinkedIn icon); logo upload → header and admin sidebar; remove → wordmark and file deleted |
| Shipping | 2-country zone with states refused; states normalised (`tx` → TX, "Oklahoma" → OK); TX address can't use the Everywhere method; Canada freight hidden under $1,000; no rest-of-world zone → "we don't ship to France"; method validation |
| Tax | State name → code; duplicate and >50 % refused; exact totals: **TX $192.04** (5 + 8.25 % incl. shipping), **OK $191.19**, **US-CA $211.19**, **Canada $226.19**, **tax-exempt TX $177.40**; order stores method, country code, rate |
| Payments | All-off refused; disabled method refused by the server; renamed PO + instructions on checkout, order page and confirmation email; Stripe "Not set up" shown |
| Checkout & stock | Validation; minimum $500 enforced (and $517.20 passes); phone required; guest refused and `/checkout` → login; notes field hidden; dashboard uses the new low-stock value |
| Email | Validation; custom subject with placeholders; sender name/email and reply-to in the delivered email; custom intro and store branding; "Send test email" → `[Test] Acme Hardware: order NX-123456 is Shipped` |
| Build | `tsc`, `eslint` clean; production build (separate folder) OK, 30 pages. The dev server kept running. |

**Not in this phase:** weight-based shipping (products have no reliable weight yet), prices entered including tax, and multiple currencies. These can follow if needed. Next on the roadmap: **Phase 12, catalog management**.
