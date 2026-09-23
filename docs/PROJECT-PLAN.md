# Nexora IT — Next.js E-Commerce Build Plan

## Project location
`~/nextjs-ecommerce` (WSL2 filesystem — not under `/mnt/c/...`)

This directory is fully isolated from other running projects on this machine. No existing containers, networks, ports, or files outside this folder should be modified.

## Reference materials in this repo

```
nextjs-ecommerce/
├── design/
│   └── nexora-full-with-admin.html   ← working HTML/CSS/JS prototype (storefront + admin)
├── docs/
│   ├── PROJECT-PLAN.md               ← this file
│   ├── PHASE-0-ENVIRONMENT.md        ← environment audit, agreed ports & names
│   ├── PHASE-1-INSTALL.md            ← Next.js install report
│   ├── PHASE-2-DATABASE.md           ← Postgres (Docker) setup report
│   ├── PHASE-3-LAYOUT.md             ← design tokens + header/footer report
│   ├── PHASE-4-IMAGES.md             ← media naming convention + home image sections
│   ├── DOCKERIZATION.md              ← Docker-first dev environment (nexora_app + nexora_pg)
│   ├── PHASE-5-DATABASE.md           ← Prisma schema + seed report
│   ├── HOME-PAGE.md                  ← all home page sections (completed after Phase 5)
│   ├── PHASE-6-SHOP.md               ← shop listing + product pages report
│   ├── PHASE-7-CART.md               ← cart, checkout, Stripe report
│   ├── PHASE-8-ACCOUNTS.md           ← login/register, account, wishlist report
│   ├── PHASE-9-ADMIN.md              ← admin panel report (+ header search fix)
│   └── kijero-products.json          ← real product catalog (299 entries) used by the seed
├── media/
│   ├── products/                     ← real product photos
│   ├── category/                     ← category tile/banner images
│   └── (all other images sit directly in media/ — banners, hero, content, promo)
```

`design/nexora-full-with-admin.html` is the single source of truth for:
- Layout and structure
- Color scheme (black/red/white IT-hardware theme)
- Typography, spacing, buttons, and UI elements
- Every interaction already implemented in vanilla JS: product filtering, variants, tiered/bulk pricing, cart math, checkout flow, wishlist, reviews, admin CRUD, CSV export, quote-to-order conversion

Treat it as an executable spec, not just a visual mockup — the JS logic in it can be read directly as pseudocode for the real implementation.

## Constraints for this build

- **No changes outside `~/nextjs-ecommerce`.** Other projects' containers, networks, volumes, and ports must not be touched.
- **Check before creating.** Before adding any Docker container, network, or exposed port, run `docker ps`, `docker network ls`, and check for port collisions. Use project-specific names (e.g. `nexora_pg`, not `postgres`) and a dedicated Docker network for this project.
- **One phase at a time.** Do not scaffold the whole app in one shot. Complete a phase, verify it works, then move to the next.
- **Use the provided media, not placeholders.** Once images exist in `media/`, wire components to reference them by a predictable naming/slug convention rather than stock/random images.
- **Docker-first development (changed 2026-09-23, see `docs/DOCKERIZATION.md`).** `docker compose up -d` runs everything: `nexora_app` (Next.js dev server, source bind-mounted for hot reload) and `nexora_pg` (PostgreSQL). Do not run `npm run dev` directly in WSL; it would collide with `nexora_app` on port 3100. Run project commands inside the container: `docker compose exec app npm …`.

## Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Server components for fast, SEO-friendly product pages; API routes double as backend |
| Styling | Tailwind CSS | Reference design is already utility-CSS-shaped; mechanical port |
| UI primitives | shadcn/ui (Radix-based) | Accessible dialogs/dropdowns for cart drawer, mobile menu, admin modals |
| Database | PostgreSQL (Docker) | Relational data: orders → items → products → variants |
| ORM | Prisma | Type-safe queries, migrations, schema doubles as documentation |
| Auth | Auth.js (NextAuth v5) | Customer accounts + separate admin role |
| Payments | Stripe (test mode → live later) | Industry standard, handles PCI compliance |
| Cart/UI state | Zustand | Lightweight, replaces the prototype's global `cart[]` pattern |
| Forms | React Hook Form + Zod | Shared validation client + server |
| Image uploads | UploadThing or Cloudinary | Replaces prototype's base64-in-localStorage approach |
| Transactional email | Resend | Real order-status and quote emails, replacing the simulated log |
| Background jobs (later) | Inngest or a cron route | Abandoned-cart email, needs to fire outside request/response cycle |

## Phase-by-phase plan

### Phase 0 — Environment check (no code yet)
- Confirm WSL distro, Node version via `nvm`, Docker Desktop WSL integration enabled
- `docker ps` / `docker network ls` — identify ports and names already in use by other projects
- Decide this project's port numbers and container/network naming convention
- **Checkpoint:** clear list of "safe" ports and names, no conflicts identified

### Phase 1 — Fresh Next.js install
- `create-next-app` with TypeScript + Tailwind + App Router, inside `~/nextjs-ecommerce` only
- **Checkpoint:** blank Next.js app runs and loads in browser on a confirmed free port

### Phase 2 — Docker: database only
- `docker-compose.yml` with Postgres only — custom container name, custom port if 5432 is taken, dedicated named volume, dedicated network
- **Checkpoint:** `docker compose up -d` succeeds, can connect with a DB client, no impact on other running containers

### Phase 3 — Design tokens & static layout
- Extract colors, type scale, spacing from `design/nexora-full-with-admin.html` into `@theme` tokens in `src/app/globals.css` (Tailwind v4 — no `tailwind.config.ts`)
- Build static header (top bar, search, mega-menu), footer — no data yet
- **Checkpoint:** side-by-side visual match with the reference file

### Phase 4 — Images folder wiring
- Populate `media/products/` with product photos, `media/category/` with category images; all other images (banners, hero, content, promo) go directly in `media/`
- Establish naming convention (e.g. product slug → filename in `media/products/`; category slug → filename in `media/category/`; descriptive names like `hero-main.jpg`, `banner-networking.jpg` in `media/`) and reference it from components
- **Checkpoint:** hero/banners/category tiles on the home page render real images, not placeholders

### Phase 5 — Database schema + seed
- Prisma schema: `Product`, `Variant`, `Category` (with image referencing `media/category/`), `Review`, `Order`, `OrderItem`, `Customer`, `WishlistItem`, `Coupon`, `Quote` — modeled on the prototype's data shapes (variants, tiered pricing, reviews, etc.)
- Seed script ports the prototype's sample products, pointed at real image files
- **Checkpoint:** `docker compose exec app npm run db:studio` → http://localhost:5555 shows correctly seeded data

### Phase 6 — Shop + product pages (read-only)
- Category grid, shop listing with filters/search/sort, PDP with gallery, variant selector, bulk-tier pricing table, reviews — all reading from Postgres via Prisma
- **Checkpoint:** browsing experience matches the prototype, now data-backed

### Phase 7 — Cart + checkout
- Zustand cart (replacing prototype's in-memory array), checkout form, Stripe test-mode payment
- **Checkpoint:** a full test order completes and is stored in the database

### Phase 8 — Accounts + wishlist
- Auth.js login/register, order history page, wishlist page
- **Checkpoint:** a registered user can log in, see their past orders, and manage a wishlist

### Phase 9 — Admin panel
- Role-gated `/admin` routes matching the prototype's admin: dashboard, products (with real image upload), orders (status + email trigger), quotes (with convert-to-order), customers, coupons, settings, CSV export
- **Checkpoint:** admin can manage the full catalog and order lifecycle

### Phase 10 — Emails + polish
- Real order-status emails via Resend (replacing the prototype's simulated log)
- Abandoned-cart reminder job
- Final QA pass across all phases

## Working agreement

- We complete and verify one phase before starting the next.
- Each phase ends with an explicit checkpoint that must pass before moving on.
- If a step risks touching anything outside `~/nextjs-ecommerce` or an existing container/port, stop and confirm first.
