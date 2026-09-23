# Phase 5 — Database Schema + Seed

Date: 2026-09-23 · Runs entirely in Docker (`nexora_app` → `nexora_pg`).

## Decisions (made with the user)

| Question | Decision |
|---|---|
| Product data | **`docs/kijero-products.json`** (added by the user): 299 real products with price, SKU, brand, category, descriptions, packaging, and `image_file` pointing at the Phase 4 photos |
| Categories | **Two levels**: the prototype's 6 top-level categories + new **Audio & Conferencing**; the JSON's categories become subcategories |
| Prototype's 14 sample products | **Included**, marked `isSample = true` (specs, variants, bulk tiers, reviews) |
| Demo admin data | **Seeded**: 10 customers, 24 orders, 3 quotes, 2 coupons (from the prototype) |

## Packages (installed inside the container, exact versions)

| Package | Version | Why |
|---|---|---|
| `prisma` (dev) | 7.10.0 | CLI. npm's `latest` tag points to **8.0.0-rc.15** (a release candidate), so the stable 7.10.0 was pinned. |
| `@prisma/client` | 7.10.0 | Client (its `latest` = 7.10.0) |
| `@prisma/adapter-pg` | 7.10.0 | Prisma 7 requires a driver adapter; brings `pg` |
| `tsx` (dev) | 4.23.15 | Runs the TypeScript seed |

Prisma 7 specifics used: `prisma.config.ts` holds the datasource URL and seed command (Prisma 7 no longer reads `.env` itself; inside Docker, `DATABASE_URL` comes from compose). The generator is `prisma-client` with output `src/generated/prisma` (git-ignored). The client takes `adapter: new PrismaPg(...)`.

## Schema (`prisma/schema.prisma`, migration `20260923103510_init`)

| Model | Notes |
|---|---|
| `Category` | Self-relation `parent`/`children`, `image` (e.g. `/media/category/monitors.webp`), `sortOrder` |
| `Product` | `slug`/`sku` unique, `brand`, `price` + `compareAtPrice` (the prototype's "old"), `currency`, `stock` (null = not tracked), `availability`, `condition`, `status` (ACTIVE/DRAFT), `shortDescription`, `description`, `descriptionHtml` (raw; **sanitize before rendering**), `specs` JSON `[{label,value}]`, `packaging` JSON, `image` + `gallery`, `rating`, `isSample`, `sourceUrl` |
| `Variant` | The prototype's option groups: `attribute`, `name`, `priceDelta` |
| `PriceTier` | Bulk pricing: `minQty`, `maxQty` (null = open), `multiplier`. Added beyond the plan's list because the prototype's tiered pricing needs it. |
| `Review` | `authorName`, `rating`, `body`, `approved`, optional `customer` |
| `Customer` | `email` unique, `role` (CUSTOMER/ADMIN), address fields. Auth.js tables come in Phase 8. |
| `WishlistItem` | Unique per customer + product |
| `Order` / `OrderItem` | `number` (NX-…), address, `paymentMethod`, `status`, `subtotal`/`discount`/`shippingFee`/`tax`/`total`. Items snapshot name/price; product link becomes null if the product is deleted. |
| `Coupon` | `code` unique, `percentOff`, `active` |
| `Quote` | `number` (QT-…), company, quantity, message, `status` (NEW/CONTACTED/WON/CLOSED), optional `category`, `orderId` for quote → order conversion |

Money is `Decimal(10,2)`, never floating point.

## Seed (`prisma/seed.ts`)

Sources: `docs/kijero-products.json` and `prisma/seed-data/prototype-samples.json`. The latter was **extracted programmatically** from the prototype's own JS literals (products, variants, tiers, review pools, coupons, quotes, demo-order recipe), not retyped.

**Result (identical on re-run, so the seed is idempotent):**

| | Count |
|---|---|
| Categories | 10 (7 top-level + 3 sub) |
| Products | **311** = 297 catalog + 14 samples |
| Products with a real photo | **301** (all 297 catalog + 4 samples) |
| Variants / price tiers / reviews | 8 / 12 / 43 |
| Customers / orders / order items | 10 / 24 / 48 |
| Quotes / coupons | 3 / 2 (NEXORA10, WELCOME5) |

**Category tree:**

```
Computers (3 samples)
Tablets (2 samples)
Monitors (2 samples)                       image: /media/category/monitors.webp
Networking (5 samples)                     image: /media/category/networking.webp
  └ Network Switches (100)
  └ Wireless Access Points (99)
Power & UPS (1 sample)                     image: /media/category/power.webp
IoT (1 sample)
Audio & Conferencing
  └ Network Audio (98)
```

**Data handling:**
- Every catalog product's image resolves to an existing file in `media/products/` (0 missing).
- **Juniper EX4600-EM-8F appears 3 times** in the JSON (identical except category: Switches, Access Points, Audio). It is seeded once, under Network Switches (its first listing).
- Condition `NEWCondition` → NEW; the one `UsedCondition` product (Ubiquiti Wave AP) → USED.
- Brand `StarTech.com` merged into `StarTech`.
- `specifications` is empty for all 299 JSON products, so only samples have specs. `description_html` (51 products) is stored raw.
- The JSON's `gallery_urls`/`image_url` (kijero.com) are **not** used; images are local only.
- **Demo emails rewritten to `@example.com`**: the prototype used real domains (`mail.com`, `lincoln.edu`, …), and Phase 10 will send real email.
- Sample images: Dell U2724D and LG 34WQ75C → `category/monitors.webp`, CyberPower UPS → `category/power.webp`, Ubiquiti PowerBeam → `category/networking.webp` (as in the prototype). The other 10 samples have no image.
- Demo orders follow the prototype's `a_seed()`: 8% tax, $25 shipping under $500 (e.g. NX-100240: 749.00 → 808.92).

## Prisma Studio in Docker

Studio only listens on `127.0.0.1` inside the container (no `--hostname` flag), which a Docker port mapping can't reach. `scripts/studio.mjs` runs Studio on `127.0.0.1:5555` and forwards **the same port on the container's network address** (e.g. `172.23.0.3:5555`) to it with Node's `net` module (no extra packages). It stops Studio's whole process group on exit.

**Fix after first try (blank page):** the first version ran Studio on 5556 behind a `0.0.0.0:5555` forwarder. The page loaded but stayed blank, because Studio rejects requests whose `Origin`/`Host` port differs from its own port: `Origin: http://localhost:5555` → **403 Forbidden** (curl without an Origin header had returned 200, which hid the problem). With the same port number on both sides, browser-style requests return 200 with data. Verified inside the container on a spare port (5557) with `Origin: http://localhost:5557` → 200, 311 products.

`nexora_app` was recreated (user-approved) with:
- port `127.0.0.1:5555:5555`, verified free on WSL, Windows and in Docker bindings
- `command: npm run dev:docker` = `prisma generate && next dev …`, so a fresh clone works without a manual generate

`nexora_pg` was not recreated (same container ID; compose config hash of `db` unchanged).

## npm scripts

| Script | Does |
|---|---|
| `dev:docker` | Container start command (generate + dev server) |
| `db:generate` | `prisma generate` |
| `db:migrate` | `prisma migrate dev` |
| `db:seed` | `prisma db seed` |
| `db:studio` | Studio on http://localhost:5555 |

Run them inside the container: `docker compose exec app npm run db:studio`.

## Checks

| Check | Result |
|---|---|
| `prisma validate` / migration | ✅ valid; `init` migration applied, 11 tables |
| Seed | ✅ counts above; second run identical |
| Spot checks vs JSON | ✅ TP-Link TL-SF1005D $11.57, Juniper $1,477, used AP = USED, StarTech merged, order totals match the prototype's formula |
| Next.js → Prisma at runtime | ✅ Temporary API route (removed afterwards) returned 311 products and a product with category path and image; the image URL from the DB served 200 |
| Prisma Studio | ✅ page 200 from WSL and Windows; data API with browser `Origin` header → 200 after the same-port fix (the first version returned 403 → blank page) |
| Lint / typecheck (in container) | ✅ |
| `nexora_pg` / other projects | ✅ Not recreated / 15 containers, 7 networks and 23 volumes identical (IDs + names). The magento-react project was started outside this session during Phase 5 and was not touched. |

## Notes

- **Header, footer and home tiles still list the prototype's 6 categories.** "Audio & Conferencing" and linking tiles to DB categories are Phase 6 work.
- **Editor support in WSL:** the WSL `node_modules` (used only by VS Code) doesn't have the new Prisma packages yet. Run `nvm use && npm ci` in WSL once to get IntelliSense for `@prisma/client` and `@/generated/prisma`. This doesn't affect Docker.
- `*:Zone.Identifier` (Windows download markers, e.g. next to `kijero-products.json`) is now git-ignored.
- While writing this phase, a `̀-ͯ` regex escape in `scripts/slugify-media.mjs` (Phase 4) was found saved as literal combining characters. It was functionally equivalent but unreadable; restored to the escaped form (re-run: 0 renames).
