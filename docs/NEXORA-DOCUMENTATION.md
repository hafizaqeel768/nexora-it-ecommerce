# Nexora IT — Project Documentation

Last updated: 2026-09-28 · Branch `develop` · Status: Phases 0–16 done, SEO foundation partly done.

This is the only project document. It replaces the earlier plan and per-phase reports (`PROJECT-PLAN.md`, `PHASE-0 … PHASE-16`, `DOCKERIZATION.md`, `HOME-PAGE.md`). They are still in git history before this commit if you ever need the full test logs.

---

## Contents

1. [Overview](#1-overview)
2. [Tech stack](#2-tech-stack)
3. [Local development (Docker)](#3-local-development-docker)
4. [Environment variables](#4-environment-variables)
5. [Folder layout](#5-folder-layout)
6. [Storefront](#6-storefront)
7. [Admin panel](#7-admin-panel)
8. [Data model and seed](#8-data-model-and-seed)
9. [Security](#9-security)
10. [Testing](#10-testing)
11. [Deploying to Vercel](#11-deploying-to-vercel)
12. [Known issues and remaining work](#12-known-issues-and-remaining-work)
13. [Lessons learned](#13-lessons-learned)
14. [History](#14-history)

---

## 1. Overview

Nexora IT is an online store for IT hardware (networking, monitors, power and UPS, audio and conferencing, computers, IoT). It has a full, Magento-style admin panel.

It was built phase by phase from a single-file HTML/CSS/JS prototype. The prototype set the layout, colour scheme (black/red/white), typography and all the behaviour: filtering, variants, bulk pricing, cart math, checkout, wishlist, reviews, admin CRUD, CSV export and turning a quote into an order. The prototype has since been removed from the repo. Its design lives on in the Tailwind tokens (`src/app/globals.css`), and its sample data in `prisma/seed-data/prototype-samples.json`.

---

## 2. Tech stack

| Layer | Used | Notes |
|---|---|---|
| Framework | **Next.js 15.5** (App Router, Turbopack) + **React 19.1** + **TypeScript 5** | Server components + server actions |
| Styling | **Tailwind CSS v4** | No `tailwind.config.ts`; tokens live in `@theme` in `src/app/globals.css` |
| Database | **PostgreSQL 17** | Docker locally, hosted Postgres in production |
| ORM | **Prisma 7.10** + `@prisma/adapter-pg` | `prisma.config.ts` holds the URL and seed command; the client is generated into `src/generated/prisma` (git-ignored) |
| Auth | **Auth.js / NextAuth 5.0.0-beta.32** | Credentials provider, JWT cookie (30 days), scrypt passwords |
| Payments | **Stripe 22.6** | Hosted Checkout + refunds; no webhook |
| Cart state | **Zustand 5** | localStorage `nexora-cart`, plus a server copy for signed-in users |
| Email | **Resend** (production) / **Mailpit** (development) | Chosen automatically based on `RESEND_API_KEY` |
| Runtime | **Node 22** | `.nvmrc`, `engines.node >= 22` |

Dependencies are pinned to exact versions on purpose. `npm audit` reports a `postcss` issue inside `next`. The only fix npm offers is upgrading to Next 16, so it was not applied; check again when a patched 15.5.x comes out.

---

## 3. Local development (Docker)

Everything runs in Docker. **Do not run `npm run dev` in WSL**, because port 3100 belongs to `nexora_app`.

```bash
cp .env.example .env            # first time only: set a DB password and AUTH_SECRET
docker compose up -d            # start app + database + Mailpit
docker compose logs -f app      # follow the Next.js dev server
docker compose stop             # stop everything (data is kept)
```

Run every project command **inside the container**: `docker compose exec app npm run <script>`.

### Containers, ports and names

This machine is shared with other projects (laravel-ecommerce, magento2, magento-react, ha-portfolio, old `magento249_*` volumes). **Never touch a container, network, volume or port that isn't prefixed `nexora_`.** Before using a new port, check `docker ps -a` (stopped containers too), `ss -tulpn` and Windows listeners, and record it here.

| Service | Container | Port (127.0.0.1 only) |
|---|---|---|
| Next.js dev server | `nexora_app` (image `nexora_app:dev`) | **3100** |
| PostgreSQL 17 | `nexora_pg` | **5432** (fallback **5433**, also verified free) |
| Prisma Studio | inside `nexora_app` | **5555** |
| Mailpit inbox | `nexora_mailpit` (`axllent/mailpit:v1.31.2`) | **8025** (SMTP 1025 not published) |

| Docker resource | Name |
|---|---|
| Compose project | `nexora` |
| Network | `nexora_network` |
| Volumes | `nexora_postgres_data` (database), `nexora_app_node_modules`, `nexora_app_next` |
| Backup | `nexora_pg_data`: the database volume from before a rename. It can be deleted with `docker volume rm nexora_pg_data` once you're sure it's no longer needed |

Ports that are **taken by other projects** (even while their containers are stopped): 80, 3000, 3001, 3002, 3306, 3307, 6379, 8081, 8085, 9200. Port 8080 is avoided too.

### How the app container works

- The project folder is bind-mounted at `/app`, so edits in WSL hot-reload in the container. No polling is needed.
- `node_modules` and `.next` live in their own Docker volumes. **The empty `.next` / `node_modules` folders in WSL are their mount points. Don't delete them while the app is running**, or the app returns 500 until `docker compose restart app`.
- The start command `npm run dev:docker` runs `prisma generate` and then `next dev`, so a fresh clone works without extra steps.
- Inside Docker the app connects to the database at `nexora_pg:5432`, which docker-compose sets for it. `DATABASE_URL` in `.env` (on `127.0.0.1`) is only for tools running in WSL or Windows.
- Email jobs run in the server every 15 minutes (`JOBS_INTERVAL_MINUTES`, via `src/instrumentation.ts`).

### Scripts

| Script | What it does |
|---|---|
| `dev` / `dev:docker` | Dev server on 3100 (`dev:docker` runs `prisma generate` first; it's the container's start command) |
| `build` / `start` | Production build / server |
| `lint` | ESLint |
| `test` | Unit tests (`tests/unit`) |
| `test:integration` | Integration tests on a throwaway `<db>_test` database, rebuilt from all migrations |
| `test:e2e` | HTTP tests against the running app |
| `db:generate` | `prisma generate` |
| `db:migrate` | `prisma migrate dev` |
| `db:seed` | `prisma db seed` (safe to run again) |
| `db:studio` | Prisma Studio on http://localhost:5555 |
| `admin:promote -- you@example.com [--revoke]` | Make an account a super admin, or take staff access away |
| `media:slugify [-- --dry-run]` | Rename new product photos to slug names |

### Everyday rules

- **Never `docker compose down -v`.** It deletes the database volume. Plain `down` or `stop` is safe.
- **After a migration, run `docker compose restart app`.** The Prisma client is cached across hot reloads (`src/lib/db.ts`), so until the restart, logins and new columns fail.
- After `package.json` changes (e.g. `git pull`), run `docker compose exec app npm ci`. After changing the Dockerfile, run `docker compose build app && docker compose up -d`.
- For a **QA production build** without disturbing the dev server, run `docker compose exec -e NEXT_DIST_DIR=.next-qa app npm run build`, then `docker compose exec app rm -rf /app/.next-qa` and `git checkout tsconfig.json`.
- **Never run `next build` into `.next` while the dev server runs**, and never kill processes by folder name.
- If `prisma migrate dev` refuses to run without an interactive terminal, create the migration with `prisma migrate diff … --script`, review it, then run `prisma migrate deploy`.
- Your WSL `node_modules` is only for VS Code IntelliSense. Refresh it with `nvm use && npm ci` in WSL.

### Database client (DBeaver / pgAdmin / TablePlus)

Host `127.0.0.1` (not `localhost`, because `::1` fails), port `5432`, database and user `nexora`, password = `POSTGRES_PASSWORD` from `.env`. From WSL: `docker exec -it nexora_pg psql -U nexora -d nexora`.

---

## 4. Environment variables

All of them are listed in `.env.example`. `.env` is git-ignored.

| Variable | Needed | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection. In production, use the hosted database's URL (with `sslmode=require`) |
| `AUTH_SECRET` | ✅ | Signs the login cookie. `openssl rand -base64 32`. Changing it signs everyone out |
| `APP_URL` | ✅ | Public site URL: used for email links, canonical URLs, sitemap and Stripe return URLs |
| `STRIPE_SECRET_KEY` | for card payments | `sk_test_…` / `sk_live_…`. Without it, card payments are off; purchase order and bank transfer still work. Live keys are refused outside production |
| `RESEND_API_KEY` | for real email | Without it, email goes to Mailpit (and fails if there is no Mailpit) |
| `EMAIL_FROM` | with Resend | e.g. `"Nexora IT <orders@your-domain>"`, on a domain verified in Resend |
| `CRON_SECRET` | serverless | Turns on `GET /api/cron/email-jobs` (send it as `Authorization: Bearer <secret>`); without it the route returns 404 |
| `ABANDONED_CART_HOURS` | optional | Default 3 |
| `JOBS_INTERVAL_MINUTES` | Docker only | Timer for the in-server email jobs. **Don't set it on Vercel** |
| `MAILPIT_URL` | Docker only | Set by docker-compose |
| `POSTGRES_DB/USER/PASSWORD/PORT` | Docker only | Used by the `nexora_pg` container |
| `NEXT_DIST_DIR` | optional | Build output folder for QA builds |

**Stripe test mode:** Dashboard → Test mode → Developers → API keys → copy the secret key into `STRIPE_SECRET_KEY` → restart. Test card `4242 4242 4242 4242`, any future date, any CVC.

**Resend:** create an account, verify your domain, create an API key, and set `RESEND_API_KEY`, `EMAIL_FROM` and `APP_URL`. The admin dashboard's **Email** card shows which transport is active.

Secrets (Stripe, Resend) stay out of the admin on purpose: the admin only shows their status.

---

## 5. Folder layout

```
nextjs-ecommerce/
├── docs/NEXORA-DOCUMENTATION.md   this file
├── media/                         site images, served at /media via the public/media symlink
│   ├── *.webp                     about-main, banner-<brand>-<topic>
│   ├── category/<slug>.webp       category photos (optional; tiles fall back to icons)
│   ├── products/<slug>.jpg        297 product photos
│   └── uploads/                   admin uploads (git-ignored)
├── prisma/
│   ├── schema.prisma              data model
│   ├── migrations/                13 migrations
│   ├── seed.ts                    idempotent seed
│   └── seed-data/
│       ├── kijero-products.json   real catalog (299 entries)
│       └── prototype-samples.json 14 sample products + demo data from the prototype
├── public/media -> ../media       symlink
├── scripts/
│   ├── admin-role.ts              admin:promote
│   ├── slugify-media.mjs          media:slugify
│   ├── studio.mjs                 Prisma Studio forwarder for Docker
│   └── test-integration.mjs       throwaway test database runner
├── src/
│   ├── app/(store)/               storefront (own layout: header, footer, cart drawer)
│   ├── app/admin/                 admin panel (own layout)
│   ├── app/actions/               server actions
│   ├── app/api/                   auth, search, cron/email-jobs
│   ├── app/print/                 invoice, packing slip
│   ├── app/uploads/[name]/        serves admin uploads
│   ├── app/robots.ts, sitemap.ts  SEO
│   ├── components/                by area: layout, home, shop, product, cart, checkout, account, wishlist, admin
│   ├── data/product-images.json   photo slug → original title
│   ├── lib/                       business logic (see below)
│   ├── auth.ts                    Auth.js config
│   └── instrumentation.ts         starts the in-server email job timer
├── tests/{unit,integration,e2e}/
├── Dockerfile, docker-compose.yml, .dockerignore
├── .env.example, .nvmrc, CLAUDE.md, README.md
└── next.config.ts, prisma.config.ts, tsconfig.json, eslint.config.mjs, postcss.config.mjs
```

Key modules in `src/lib/`: `catalog.ts` / `catalog-shared.ts` (shop queries and filter parsing), `pricing.ts` (tiers + options), `shipping.ts` / `shipping-data.ts` (zones, methods, tax), `orders.ts`, `order-emails.ts`, `email.ts` / `email-templates.ts`, `jobs.ts`, `saved-carts.ts`, `stripe.ts`, `config.ts` / `config-shared.ts` (settings), `acl.ts` / `acl-rules.ts` / `admin-users.ts` / `audit.ts`, `attributes.ts`, `data-transfer/`, `uploads.ts`, `media.ts`, `seo.ts`, `site-url.ts`, `viewer.ts`, `password.ts`, `auth-tokens.ts`, `csv.ts`.

**Media naming:** lowercase slug, accents removed, every run of other characters → `-`, and `.jpeg` → `.jpg`. To add product photos, drop them into `media/products/` named after the product title, then run `npm run media:slugify -- --dry-run` followed by `npm run media:slugify`. It never overwrites files and stops on a name collision.

---

## 6. Storefront

| Route | What it does |
|---|---|
| `/` | Home: hero (carousel, particle canvas, tilt), brand marquee (top 10 brands from the DB), about, category tiles (first 6 menu categories + IT Services + All Products), featured products, brand promotions, sectors, why us, FAQ, **request a quote** (saves a `Quote`) |
| `/shop` | Two-level category sidebar with counts, brands (within the current results), price min/max, rating, on sale, sort, filter chips, 24 per page. **All filter state is in the URL** |
| `/shop?q=` | Search: every word must match name, brand, SKU or short description |
| `/product/[slug]` | Gallery (zoom, lightbox, swipe), live price (bulk tiers + option), stock badge, options, bulk table, details, reviews (write/edit when logged in, ✓ Verified buyer), related products, save for later, request a quote |
| `/cart` | Lines, promo code, summary |
| `/checkout` | Contact, address (country list, US states), shipping methods and tax from the address, payment method (card / purchase order / bank transfer), notes |
| `/order/[id]` | Confirmation and order status, tracking, invoice button (the id is an unguessable cuid) |
| `/register`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email` | Accounts |
| `/account` | Orders (status, latest email sent, tracking), addresses, profile, "please confirm your email" banner |
| `/wishlist` | Saved products |
| `/api/search?q=` | Header live suggestions (6 matches + "See all") |

**Header and cart:** live search, a wishlist count, a cart badge with the total, the mini-cart drawer, and a "resume checkout" nudge. The category menu and footer come from the database.

**Checkout rules:** the server **re-prices everything** from the database (the browser only sends IDs and quantities). It checks the coupon, stock and the shipping method for the address, **reserves stock**, and creates the order in one transaction.
- **Card:** Stripe Checkout. On return, the server asks Stripe whether the session is paid. Cancelling marks the order Cancelled and releases the stock.
- **Purchase order / bank transfer:** the order is Pending / Unpaid, and payment instructions are shown.

**Accounts:** registering claims an earlier guest record but clears its phone and address. Earlier guest orders only show up after the email is confirmed.
- **Verification links** last 24 h. **Reset links** last 1 h, work once, and are only used up when the new password is saved.
- A password reset signs out every other device.
- Tokens are 256-bit, stored as SHA-256 hashes, with at most one per minute.

**Emails:** order received, status change (with tracking and a "Track your package" button), refund, confirm email, reset password, abandoned cart (confirmed emails only, after 3 h, one per cart version).
- Order emails are queued in the same transaction as the order change and sent after the response.
- Failures show in the admin with **Retry**, and are retried automatically up to 5 times.

**SEO:** `robots.txt` and `sitemap.xml` built from the DB, `metadataBase` / canonical URLs, Open Graph, JSON-LD (Organization + WebSite search on home, Product + breadcrumbs), and noindex on account, cart, checkout, login and filtered shop pages. Products and categories have `seoTitle` / `seoDescription`.

---

## 7. Admin panel

**Getting in:** register, then run `docker compose exec app npm run admin:promote -- you@example.com` (this makes the account a super admin), and open `/admin`. Signed-out visitors are sent to login, and customers see "No access".

| Area | What you can do |
|---|---|
| **Dashboard** | Revenue (minus cancellations and refunds), orders, buyers, quotes, a 14-day revenue chart (+ table view), top products, recent orders, low stock, reviews waiting, email status + "Run email jobs now" |
| **Products** | Search and filters, Live switch, add/edit (photo upload: JPG/PNG/WebP, 4 MB, 5 per save, make main, remove), SKU/slug, stock (empty = not tracked), specifications, one option group (price change, SKU), bulk tiers (% off from N units), SEO fields |
| **Categories** | Two levels, URL name, image or icon, description, order, show in menu; can only be deleted when empty |
| **Brands** | Counts, rename, merge |
| **Attributes** | Code (fixed once created, reserved names blocked), name, type (text, text area, number, yes/no, dropdown, multiple choice, date, price), required, default, unit, sort, show on product page, active; options (add, rename, disable, reorder, defaults, remove while unused); delete only while unused |
| **Reviews** | Waiting / approved / all; approve, hide, delete. Settings: reviews on/off, approval required, buyers only. The product's rating follows its approved reviews |
| **Orders** | Status chips, CSV export, detail: status (cancelling restocks once; Cancelled is final), mark as paid (PO/bank transfer), **edit items** (open, unpaid PO/bank orders: prices, quantities, add catalog or custom lines, shipping, discount, tax), edit customer/address until shipped, **tracking** (UPS/FedEx/USPS/DHL/other), **refunds** (card through Stripe, PO/bank recorded by hand; partial or full; optional cancel + restock + email), **invoice** and **packing slip** (staff only, no prices), activity timeline + private notes, email log with retry |
| **Quotes** | Status, **convert to order** (a pending PO order with a placeholder line; price it with Edit items) |
| **Customers** | Spend, orders (including guest orders with the same email), quotes, reviews, wishlist, saved cart; edit contact/address, private staff note, tax exemption |
| **Coupons** | Code (3–20 characters), 1–90 %, on/off, times used |
| **Settings** | **Store details** (name, tagline, announcement, logo upload or text logo, contacts, footer, social links), **Shipping** (zones by country/state, flat or pickup methods, "free from" / "only from" amounts), **Tax** (rates by country/state, tax on shipping, most specific rate wins), **Payments** (enable, rename, add instructions per method; Stripe status), **Checkout & stock** (guest checkout, minimum order, phone required, notes, default country, low-stock level), **Email** (sender, reply-to, subject + intro per email with `{name} {order} {status} {amount} {store}`, send test), SEO (see §12) |
| **Data transfer** | Import products / categories / customers (Add, Update or Add/Update; skip errors or stop; CSV up to 5 MB / 5,000 rows; sample file; column guide), **validate & preview** before anything is written, confirm once, result + error report CSV. Export products, categories, customers and orders with filters and a row count. No order import, on purpose |
| **Admin users** | Add (password ≥ 10 characters with letters and a number), role, disable/enable, reset password (signs out everywhere), super admin (super admins only), delete (kept as a record without login if it has history) |
| **Roles** | Custom roles from the permission list, grouped by module; starter roles: Catalog Manager, Sales Manager, Customer Manager, Content Manager, Support |
| **Activity log** | Every security-relevant change, imports and exports |

**Store maths:**
- **Shipping:** the address matches the first zone that lists its country (and state). A zone with no countries covers the rest of the world.
- **Tax** = rate × (subtotal − discount [+ shipping]). Tax-exempt customers pay none.
- The browser shows live totals and the server recomputes them. Existing orders keep their amounts.

**Import safety:**
- The upload is stored in the database, not on disk, and **validated again on confirm**.
- `VALIDATED → IMPORTING` is claimed atomically, so an import can only be confirmed once.
- Rows are written 100 per transaction, and a failed chunk is retried row by row.
- Passwords and roles are never imported.
- Uploads are deleted after 7 days, and previews nobody confirmed are cancelled after 1 day.
- **Careful:** a row whose SKU or slug matches an existing product *updates* that product. Read the preview.

**Permissions** (`src/lib/acl.ts`): `dashboard.view`, `products.view/create/edit/import/export`, `categories.view/create/edit/delete/import/export`, `attributes.view/create/edit/delete`, `reviews.view/moderate`, `orders.view/edit/refund/export`, `quotes.view/edit`, `customers.view/edit/import/export`, `coupons.view/create/edit/delete`, `settings.view/edit`, `import.access`, `export.access`, `admin_users.view/create/edit/disable/delete`, `roles.view/create/edit/delete`, `audit_log.view`.

---

## 8. Data model and seed

**Models:** Category (two levels), Product, Variant, PriceTier, Review, Customer (customers *and* staff), WishlistItem, Order, OrderItem, OrderEmail, OrderNote, Refund, Coupon, Quote, StoreConfig (one JSON document per settings section; defaults in `config-shared.ts`), ShippingZone, ShippingMethod, TaxRate, AuthToken, SavedCart, AdminRole, AdminAuditLog, ImportJob, Attribute, AttributeOption.

Money is always `Decimal(10,2)`. Order items keep a copy of the product name and price, so deleting a product doesn't change past orders.

**Migrations (13):** `init`, `order_payment`, `customer_auth`, `admin`, `emails`, `saved_cart_changed_at`, `store_configuration`, `catalog_management`, `order_operations`, `seo_fields`, `admin_acl`, `data_transfer`, `product_attributes`.

**Seed** (`npm run db:seed`, safe to run again; catalog products are upserted by SKU):
- 297 real catalog products from `kijero-products.json` plus 14 prototype samples (`isSample = true`) = **311 products**.
- 10 categories:
  - Computers, Tablets, Monitors, Power & UPS, IoT (no subcategories)
  - Networking → Network Switches, Wireless Access Points
  - Audio & Conferencing → Network Audio
- Demo data: 10 customers (`@example.com`), 24 orders, 3 quotes, 2 coupons (`NEXORA10`, `WELCOME5`).
- Data clean-up done by the seed:
  - HTML entities decoded
  - `StarTech.com` merged into `StarTech`
  - the duplicated Juniper EX4600 listing seeded once
  - kijero.com image URLs ignored, because images are local only

---

## 9. Security

- **Every admin page, server action, export and download checks permissions on the server** (`requireAdminPage` / `assertAdmin`). Hiding things in the UI is only for convenience.
- **No privilege escalation:**
  - Nobody can change their own role, status or super admin flag.
  - Admins can only assign or edit roles whose permissions they hold, and can't manage stronger admins or super admins.
  - The last active super admin can't be removed, even by two requests at the same time (row locks).
  - A database `CHECK` constraint keeps staff-only fields off customer accounts.
- **Passwords:** scrypt with a random salt and constant-time compare. An unknown email and a wrong password give the same answer and take the same time.
- **Sessions:** the JWT cookie only holds the customer id. Role and data are read fresh on every request, so a disabled or deleted account is signed out at once.
- **Uploads:** the file type is detected from its content, with size and count limits, random names and `nosniff`.
- **CSV:** cells starting with `= + - @` are prefixed with `'` on export (formula injection), and the prefix is removed again on import.
- **Stripe:** payment status always comes from Stripe, never from the URL. Refunds use an idempotency key.
- **Links:** `?next=` only allows same-site paths, and `javascript:` social links are refused.

---

## 10. Testing

| Command (in the container) | Covers | Last result |
|---|---|---|
| `npm test` | Permission rules, CSV/parsers, upload checks, attribute rules | 26/26 ✅ (2026-09-28) |
| `npm run test:integration` | Creates `<db>_test`, applies all migrations from zero, then tests services: ACL, admin users, data transfer, attributes | 54/54 ✅ (Phase 16) |
| `npm run test:e2e` | Real HTTP against the running app, including server actions called directly with the `Next-Action` header | 19/19 ✅ (Phase 16) |
| `npx tsc --noEmit`, `npm run lint` | | clean ✅ (2026-09-28) |

**Rules for tests (the dev database has real catalog data):**
- Tests that write data only create and use **their own data** (prefixes like `P16-…` or `p16_…@example.test`), and delete it afterwards.
- **Never reuse a real SKU or ID.** An earlier import test did, and overwrote a real product.
- Before tests that write: back up with `pg_dump`, record the counts, and compare them afterwards.

---

## 11. Deploying to Vercel

The project runs on the Docker setup today and **has not been deployed yet**. Check these points before or during your first Vercel deploy:

| # | Item | What to do |
|---|---|---|
| 1 | **Database** | Create a hosted Postgres (e.g. Neon from the Vercel Marketplace, Supabase, or Vercel Postgres). Set `DATABASE_URL` in Vercel. Then, from your machine, run `DATABASE_URL="<prod url>" npx prisma migrate deploy` and optionally `npx prisma db seed` (the seed adds demo customers, orders and coupons as well as the catalog) |
| 2 | **Prisma client** | `src/generated/` is not in git. Set the Vercel **Build Command** to `prisma generate && next build --turbopack` (or add `"postinstall": "prisma generate"` to `package.json`) |
| 3 | **Environment variables** | In Vercel → Settings → Environment Variables, set `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` (your Vercel/custom domain), `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM` and `CRON_SECRET`. **Don't** set `JOBS_INTERVAL_MINUTES`, `MAILPIT_URL` or `POSTGRES_*` |
| 4 | **Email jobs** | Vercel has no long-running server, so the 15-minute timer won't run. Add a Vercel Cron job that calls `/api/cron/email-jobs` (with `CRON_SECRET` set, Vercel sends it as the Bearer token) |
| 5 | **Email** | There is no Mailpit on Vercel, so without `RESEND_API_KEY` emails fail (they are queued and shown as Failed in the admin). Verify your domain in Resend first |
| 6 | **Images** | `public/media` is a **symlink** to `../media`. Check after the first deploy that `/media/...` images load. If they don't, replace the symlink with the real folder (`rm public/media && git mv media public/media`, then update `src/lib/media.ts` and `src/lib/uploads.ts`, which read from `process.cwd()/media`) |
| 7 | **Admin uploads** | `src/lib/uploads.ts` writes to `media/uploads/`, but **Vercel's filesystem is read-only and resets on every deploy**. Uploading product photos, category images and the store logo won't work until uploads move to object storage (e.g. Vercel Blob, S3 or Cloudinary). Photos already uploaded locally are git-ignored and won't be deployed either |
| 8 | **Server action body size** | `next.config.ts` allows 21 MB for photo uploads. Vercel functions accept about 4.5 MB per request, so large multi-photo saves will fail there |
| 9 | **Stripe** | No webhook is needed. Test with `sk_test_…` first, and test a real refund before switching to `sk_live_…` |
| 10 | **First admin** | Register on the live site, then run `DATABASE_URL="<prod url>" npx tsx scripts/admin-role.ts you@example.com` from your machine |
| 11 | **Node version** | Set Node 22 in Vercel → Settings → General |
| 12 | **Production build** | `next build` passes (checked 2026-09-28 in a separate folder). Vercel runs it for you |

Docker files (`Dockerfile`, `docker-compose.yml`, `.dockerignore`) are ignored by Vercel and can stay for local development.

---

## 12. Known issues and remaining work

| Item | Status |
|---|---|
| **Admin → Settings → SEO page** | The tab and save action exist, but `/admin/settings/seo` has no page, so the tab opens a 404 |
| **SEO foundation** (commit "Phase 17 (WIP)") | Code is in and type-checks, but it hasn't been fully tested |
| **Phase numbering** | The SEO commit is labelled Phase 17, but the roadmap's Phase 17 is Attribute sets. Renumber one of them |
| **Uploads on serverless** | Admin uploads need object storage before they can work on Vercel (§11 item 7) |
| **No-JavaScript fallback** | Bound server actions (e.g. the *Live* switch) fail in the Turbopack dev server when JavaScript is off; they work normally with JavaScript |
| **Copy to review** | The FAQ answer "Which brands do you carry?" names brands that aren't in the catalog. The contact details in the quote section are placeholders (sales@example.com, +1 (555) 010-2030, Austin TX) |
| **Not tested live** | A real Stripe card payment and refund (no keys on this machine), real delivery through Resend, and clicking through several admin screens in a browser |

### Roadmap

| Phase | Topic | Status |
|---|---|---|
| 17 | Attribute sets per product type, product form fields, values stored in their own table | Not started |
| 18 | My Account redesign (dashboard, orders, details, profile, addresses, security; strict ownership checks) | Not started |
| 19 | Security and data integrity audit (incl. login rate limiting, two-step login) | Not started |
| 20 | Complete testing and production readiness | Not started |
| 21 | To be defined | — |

**Ideas not planned yet:**
- **Catalog:** several option groups per product, brand pages, attribute filters in the shop, attributes in import/export, photos/options in the CSV import.
- **Pricing:** weight-based shipping, prices entered including tax, multiple currencies.
- **Orders:** invoice numbers separate from order numbers, returns (RMA), shipping label printing.
- **Data transfer:** XLSX/JSON/XML formats.

**Working agreement:** one phase at a time, each ending with a checkpoint that must pass. Anything that could affect another project on this machine needs confirmation first.

---

## 13. Lessons learned

- **Build vs dev server:** running `next build` into `.next` while the dev server runs breaks it (500). Use `NEXT_DIST_DIR=.next-qa`.
- **Stale Prisma client:** after a migration, run `docker compose restart app`, or logins fail.
- **Mount points:** deleting the WSL `.next` folder detaches the `nexora_app_next` volume, and the app returns 500 until restarted.
- **Test data:** an import test reused a real SKU and overwrote a real product. Tests now only touch their own data.
- **Prisma Studio in Docker** only works when the forwarder uses the **same port** as Studio, because Studio rejects other `Origin` ports (blank page / 403). That's why `scripts/studio.mjs` exists.
- **Checkout form:** a React form action reset the fields on a server error, so the checkout now keeps what the customer typed.
- **HTTP tests** must build server-action requests with React's own encoder (`encodeReply`), exactly like the browser does.

---

## 14. History

| Commit | Phase |
|---|---|
| `9db165c` | Next.js starter |
| `178ddb5` | 0–4: environment, Next.js setup, Postgres, layout and design tokens, media |
| `5988e81` | Dockerized dev environment, database schema + seed, full home page, shop + product pages |
| `5afaa47` | 7: cart, checkout, Stripe |
| `573d595` | 8: accounts, wishlist |
| `d2fc4c5` | 9: admin panel, header live search |
| `87db38a` | 10: emails, verification, password reset, cart reminders |
| `abca5b3` | 11: store configuration |
| `c908f1f` | 12: catalog management |
| `210b22f` | 13: order and customer operations |
| `6a2c2e8` | SEO foundation (WIP) |
| `5d0a233`, `bb6a441` | 14: admin users, roles, ACL |
| `251cccd` | 15: import / export framework |
| `709ce7a` | 16: product attributes |
