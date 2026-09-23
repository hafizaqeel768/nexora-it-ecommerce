# Home Page — Completed Sections

Date: 2026-09-23 · Follows Phase 4 (image sections) and Phase 5 (database).

The home page now has all sections of the prototype, in its order:

| # | Section | Source | Notes |
|---|---|---|---|
| 1 | Hero | Phase 4 | Slider, animated canvas, floating image cards, stats |
| 2 | Brand marquee (`#brands`) | **new** | **Top 10 brands from the database** (TP-Link, Logitech, Ubiquiti Networks, Netgear, TRENDnet, Eaton, IOGEAR, Zyxel, Cyber Acoustics, D-Link) instead of the prototype's fixed list, which includes Cisco/Asus/Acer that aren't in the catalog |
| 3 | About (`#about`) | Phase 4 | |
| 4 | Product categories (`#products`) | Phase 4 | |
| 5 | Featured products (`#featured`) | **new** | From the DB: the prototype's picks (Dell U2724D, CyberPower UPS, Ubiquiti PowerBeam, ThinkPad T14). Badges follow the prototype (Sale → Bulk pricing → Options). The ThinkPad has no photo and shows its category icon, never a stock image. |
| 6 | Top brands & promotions (`#deals`) | Phase 4 | |
| 7 | Serving every sector (`#sectors`) | **new** | Dark band, 7 sectors + "Your industry? Talk to us" |
| 8 | Why teams choose us (`#why`) | **new** | 3 cards with the prototype's 3D tilt + moving highlight (mouse only) |
| 9 | FAQ (`#faq`) | **new** | Accordion, one open at a time, animated |
| 10 | Request a quote (`#contact`) | **new** | **Saves a `Quote`** (status NEW) via a server action, then shows "Thanks, {name}! Your quote request QT-xxxxx was received." Categories come from the DB (incl. Audio & Conferencing) + "Other". Server-side validation; input is kept on errors. |

## New files

- `src/components/home/`: `brand-marquee.tsx`, `featured-products.tsx`, `sectors.tsx`, `why-us.tsx` (client), `faq.tsx` (client), `quote-request.tsx` (client)
- `src/components/product/product-card.tsx`: reusable product card (the prototype's `.pc`), also for the Phase 6 shop
- `src/lib/products.ts`: featured products, top brands, top categories (server-only queries → plain data)
- `src/lib/format.ts`: `money()` and `stars()`, same output as the prototype
- `src/app/actions/quote.ts`: quote form server action
- `globals.css`: `animate-marquee`, `animate-rise`, `animate-pop`, `.section-title.no-rule`

The page is `force-dynamic` (reads the DB per request), so `next build` doesn't need a database.

## Not wired yet (by design)

| Element | Phase |
|---|---|
| Product card "Add to cart" button | 7 (cart) |
| Product card ♥ wishlist button | 8 (accounts + wishlist) |
| Product card links `/product/<slug>` (404 until built) | 6 (shop + product pages) |
| Quote form spam protection / email notification | 9–10 |

## Checks

- All 10 sections render in order; one `<h1>`; no errors in the container log
- Featured: 4 cards from the DB with correct prices ($429.00, $189.00, $129.00, $1,149.00) and badges
- Quote action: invalid input → field errors for name/email/quantity with input kept; valid input → `QT-xxxxx` saved with category and quantity (test quote deleted afterwards)
- `tsc` and `eslint` pass in the container

## Copy to review

- The FAQ answer "Which brands do you carry?" (prototype text) names Linksys, Dell, HP, Lenovo and Cisco. The real catalog is mostly TP-Link, Logitech, Ubiquiti, Netgear, TRENDnet… You may want to update that sentence.
- Contact details in the quote section are the prototype's placeholders (sales@example.com, +1 (555) 010-2030, 100 Tech Avenue, Austin, TX).
