# Phase 6 — Shop + Product Pages (read-only)

Date: 2026-09-23 · All data from Postgres via Prisma, in the `nexora_app` container.

## Pages

| Route | What |
|---|---|
| `/shop` | Catalog listing: category sidebar (two levels, with counts), brand checkboxes, price min/max, rating, "On sale", sort, active-filter chips with ✕, result count, empty state, pagination |
| `/shop?category=<slug>` | Category (a top-level category includes its subcategories) |
| `/shop?q=<words>` | Search (header search box). Every word must match name, brand, SKU or short description (the prototype's `hit()`). |
| `/product/<slug>` | Product page: breadcrumb, gallery, info panel, reviews, related products |
| `/?quote=<slug>#contact` | "Request quote" from a product page pre-fills the home page quote form ("I would like a quote for: …" + category), like the prototype |

**All filter state lives in the URL** (`?category=networking&brand=Netgear&brand=Zyxel&min=100&max=500&rating=4&sale=1&sort=price-asc&page=2`): shareable, bookmarkable, back button works. Filtering, sorting and paging run in the database.

## Product page

- **Gallery:** main image with hover zoom (1.9×), click → lightbox (Esc, ← →), swipe on touch. Arrows, dots and thumbnails appear only with 2+ images (catalog products have 1 photo each). No photo → neutral category icon.
- **Info panel:** brand, name, rating (if any), **live price** that follows quantity (bulk tiers) and the selected variant (price delta), struck-through old price, stock badge ("In stock", "Only N left", "In stock (N)", "Out of stock"), description, variant buttons, bulk-pricing table, details table (sample specs, or for catalog products: SKU, MPN if different, condition if not new, package dimensions and weight), quantity stepper, trust badges.
- **Reviews:** average, star distribution bars, up to 6 reviews; "No reviews yet" for products without reviews.
- **Related products:** same category first, then others (10), in a scrollable row with ‹ › buttons.
- Unknown slug → 404. Page title = product name.

## Differences from the prototype (deliberate)

| Prototype (14 demo products) | Now (311 real products) | Why |
|---|---|---|
| All products on one page | **24 per page** with numbered pagination; out-of-range page → redirect to the last page | Performance with 311 products + photos |
| Brand list = all brands, global counts | Brands and counts **within the current category/search** | 53 brands; most would show 0 in a given category |
| Category list flat (6) | Two levels: top-level + indented subcategories, counts include subcategories | Phase 5 category tree |
| Subtitle "Sample products for demonstration." | Removed on the shop page | Real catalog now |
| Title size of product name = section h2 (up to 36px) | clamp(22px, 3vw, 30px) | Real names are up to ~120 characters |
| Description HTML | **Plain text** (`description_text`/short description) | Raw HTML from the source site would need a sanitizer; the text version has the same content |
| "Featured" sort = array order | Photos first → rated → name | No manual order exists for the real catalog |

**Not wired yet (by design, read-only phase):** Add to cart (Phase 7), ♥ / Save for later (Phase 8), writing reviews (Phase 8, needs accounts; the form is omitted).

## Also changed

- **Header dropdown + footer:** added **Audio & Conferencing** (98 products) with a speaker icon in the prototype's line style.
- **Seed fix: HTML entities.** The catalog JSON had `&amp;`, `&quot;`, `&#039;` in 8 names and 15 short descriptions (19 products), which would have shown literally (e.g. "Splitter &amp; Switcher"). The seed now decodes them, and catalog products are upserted **by SKU** (stable) so the 8 corrected slugs updated in place (still 311 products, no duplicates).
- `src/lib/pricing.ts`: tier/variant price rules (reused by the cart in Phase 7).
- `src/lib/catalog.ts` (server queries) / `src/lib/catalog-shared.ts` (filter parsing, sorts, `shopHref`, safe for client components).
- `getProduct` is wrapped in React `cache()` so metadata and page share one query.

## Checks

| Check | Result |
|---|---|
| `/shop` | 200, 311 products, 24 cards, 13 pages |
| Category | networking = 204 (5 samples + 100 + 99), network-audio = 98, audio-conferencing = 98 |
| Filters | "poe switch" → 10; Netgear+Zyxel $100–500 → 11; On sale → 6; 4.5★+ → 11; nonsense search → empty state |
| Sorting | low→high starts $11.57 (DB min), high→low $2,103.54 (DB max), rating 4.8, 4.8, 4.7… |
| Paging | `?page=99` → 307 to `?page=13` |
| Product pages | Sample with variants (OptiPlex: 2 options), with tiers (Netgear M4250: 3 rows, "Only 6 left"), catalog product (TP-Link: SKU/package details, "No reviews yet"), used product (Ubiquiti Wave AP: Condition = Used), no photo (ThinkPad: icon fallback). Related rows: 10 cards, same category first. Unknown slug → 404. |
| Quote pre-fill | `/?quote=netgear-m4250-40-port-poe-switch` → message + Networking preselected |
| Windows | `/shop` and a product page → 200 |
| `tsc`, `eslint` (container) | ✅; no errors in the container log |
