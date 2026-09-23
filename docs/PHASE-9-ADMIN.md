# Phase 9 — Admin Panel

Date: 2026-09-23 · Also includes two storefront fixes made before this phase started: the header search's live suggestions, and removing the Admin link from the footer.

## Becoming an admin

Admins are normal accounts with the `ADMIN` role. There are no demo credentials.

1. Register at `/register` (or use an existing account)
2. `docker compose exec app npm run admin:promote -- you@example.com`
3. Log in and open **http://localhost:3100/admin**

Take the role away again with `npm run admin:promote -- you@example.com --revoke`. Signed-out visitors to `/admin` are sent to login. Signed-in customers get a 404, so the admin area isn't advertised.

## What works

| Section | Behaviour (from the prototype) |
|---|---|
| **Layout** | Dark sidebar (Dashboard, Products, Orders, Quotes, Customers, Coupons, Settings), top bar with the page title and admin email, "← View store", Log out. On screens under 900px it becomes a top bar with scrolling nav. No store header/footer. |
| **Dashboard** | KPIs: revenue (all orders except cancelled), orders + pending, unique buyers, quote requests + new. **Revenue bar chart for the last 14 days**: hover or keyboard focus shows the date and amount, and "Show as table" lists every day. Top 5 products by revenue, 6 recent orders, low stock (from the setting). |
| **Products** | Search (name, brand, SKU), category and live/draft filters, 50 per page. Photo, name, brand · SKU, category, price (+ struck compare-at), stock (red when low, "—" when not tracked), **Live switch**, Edit. CSV export follows the filters. |
| **Add / edit product** | Photos: **upload** (JPG/PNG/WebP, 4 MB each, 5 per save), **Make main**, **Remove**; the first photo is the main image. Name, brand, category (grouped), price, compare-at price, stock (empty = not tracked), SKU (unique), status, availability, description, specifications ("Label: value" per line). New products get a URL slug from the name. Stock 0 marks the product out of stock. |
| **Orders** | Status chips with counts, 50 per page, CSV export (follows the chip). |
| **Order detail** | Customer (registered or guest), ship-to, payment method + status, Stripe session, items (linked to products), totals with coupon, notes, source quote. **Status update**. **Mark as paid** for purchase-order and bank-transfer orders (card orders are only marked paid by Stripe). **Email notifications** log. |
| **Quotes** | Status chips with counts, table (quote → converted order number). Detail: contact, request, message, **status update**, **Convert to order**. |
| **Customers** | Every customer with account type (admin / registered / guest), orders, total spent (without cancelled orders), last order; sorted by spend; CSV export. |
| **Coupons** | Add (code 3–20 characters, 1–90 %), on/off switch, times used, delete (with confirmation). The cart and checkout use them immediately. |
| **Settings** | Sales tax %, free shipping threshold, flat shipping fee, low-stock alert. **The storefront uses them right away**: cart, drawer, checkout totals, the checkout's server-side calculation, and the header's "Free shipping on orders over $…". Existing orders keep their amounts. |

### Order lifecycle rules

- Every status change records a **status email** (`OrderEmail`, shown as "Queued"). Sending comes in Phase 10 with Resend, so for now nothing reaches the customer.
- **Cancelling puts the items back in stock** (tracked products), exactly once. **Cancelled is final**, so stock can't be released twice. If the order was paid, the message reminds you to refund it in Stripe or by hand.
- If someone else changed the order at the same moment, the update is refused with "please reload".

### Converting a quote

Like the prototype: a **pending purchase-order order** with one placeholder line ("Custom quote — {category} (qty N)", $0), the address marked "To be confirmed", and the quote's message in the notes. The quote becomes **Won** and links to the order. Converting again opens the same order. Order lines and prices can't be edited in the admin yet (see below).

## Security

- **Every** admin page, server action and CSV export checks the admin role itself. Server actions can be called directly, so the layout check alone would not be enough. Tested: customer calls are rejected and nothing changes.
- Uploads: the type is detected from the file's first bytes (a renamed text file is refused), with size and count limits, random file names, and `nosniff`. Files are saved in `media/uploads/` (git-ignored) and served by `src/app/uploads/[name]/route.ts`, which also works after a production build. Photos removed from a product are deleted from disk. Catalog images under `/media` are never deleted.
- CSV cells that start with `=`, `+`, `-` or `@` get a leading `'`, so a product or customer name can't run as a spreadsheet formula.

## Header search (fix before this phase)

The prototype's **live suggestions**: popular searches while empty; while typing, the first 6 matches (photo, name, brand · category, price) and "See all N results for "…" →". Arrow keys, Enter and Esc work. `GET /api/search?q=` uses the same matching as the shop. On `/shop` the box shows the current search. Without JavaScript it is still a plain form to `/shop?q=`.

## Structure changes

- Store pages moved into the **`src/app/(store)/` route group** with their own layout (header, footer, cart drawer). **URLs are unchanged.** `/admin` has its own layout.
- Store rules: `src/lib/store-settings.ts` now holds the type and defaults. `src/lib/settings.ts` reads the database, and `StoreRulesProvider` passes the rules to browser components.
- `src/lib/orders.ts` gained `newOrderNumber` and `restockOrder`, shared by checkout, card cancel and the admin.
- `next.config.ts`: server-action body limit 21 MB (photo uploads). Changing it needs `docker compose restart app`.

## Schema change (migration `admin`)

New tables only: `OrderEmail` (order, status announced, recipient, `sentAt`, `error`) and `StoreSettings` (one row, id 1; defaults match the prototype: 8 % tax, free shipping from $500, $25 fee, low stock at 10). No existing data changed.

## Not in this phase

- Editing product **variants and bulk-price tiers**, and **order lines/prices** (e.g. pricing a converted quote). These can be added if you want them.
- The prototype's store-name setting and "Reset demo data" button.
- Showing "✉️ Email sent" to customers in their account. That waits for real sending in Phase 10.

## Checks

Run against the live container with real server actions, using a temporary admin and customer. All test data was deleted afterwards: back to 10 customers, 24 orders, 3 quotes, 2 coupons, stock restored, settings back to defaults, no uploads.

| Check | Result |
|---|---|
| Access | All 8 admin pages: admin 200, customer 404; signed out → login. CSV export as customer → 404. Customer calls to admin actions (toggle product, settings, order status, delete coupon) rejected, nothing changed. |
| `admin:promote` | Promotes a registered account; refuses an unknown email |
| Dashboard / lists | KPIs, chart + table view, low stock; order chips "All (24)"; product search filters; orders CSV 24 rows + header; filtered products CSV; customers CSV |
| Products | Validation; fake image refused; created with 2 uploaded photos → edit page, "Product created."; upload served as `image/png`; live in store at its slug; duplicate SKU refused; edit (new price, compare-at, removed photo deleted from disk); Live switch hides/shows it in the store (404 ↔ 200) |
| Settings | Tax 60 % refused; 10 % / free from $1,000 / $30 fee → header shows $1,000, and a new order totals $863.80 (758 + 30 + 75.80) |
| Orders | Checkout reserved 2 units (9 → 7); mark as paid; → Shipped (email recorded); same status refused; → Cancelled (refund reminder, stock back to 9); cancelled is final; 2 emails logged |
| Quotes | Home page quote → listed under New → Contacted → converted (placeholder line, linked, purchase order) → converting again reuses the order → quote Won |
| Coupons | Validation; PHASE9 created (upper-cased); duplicate refused; accepted in the cart at 20 %; switched off → refused; deleted |
| `tsc`, `eslint` | ✅ clean. The only errors in the log are the 5 intended "Admin access required" rejections. |

**Not testable from the terminal:** clicking through the admin in a browser (layout, switches, photo previews, the chart's hover). Please check those in the browser.
