# Phase 3 — Design Tokens & Static Layout

Date: 2026-09-23 · Source of truth: `design/nexora-full-with-admin.html` (read only, unchanged).

## How the prototype was read

The prototype's CSS is layered: later rules override earlier ones (803 rules in total). The **final** cascade was used, not the first rule for each class:

- The header is the **light** version (white header, red sticky nav). The dark "glass pill" nav near the top of the CSS is overridden.
- The dedicated mega-menu (`.mm`) is permanently hidden (`display:none!important`). The plan's "mega-menu" is the **ALL CATEGORIES** dropdown (`.acd`) in the red nav.
- Sizes come from the "compact header" block (e.g. logo 28px, search 48px high, red nav 50px high), which overrides the earlier values.

## Design tokens (Tailwind v4 `@theme` in `src/app/globals.css`)

| Group | Tokens |
|---|---|
| Themable (flip in dark mode) | `bg`, `surface`, `ink`, `muted`, `line`, `hero`, `hero-ink` — same light/dark values as the prototype's `:root` |
| Brand | `brand #c8102e`, `brand-2 #e63946`, `accent #d21f2b`, `accent-hover #a9151f`, `accent-soft #fdecee` |
| Header (always light) | `header-ink/text/link/line/field/control/icon/placeholder` |
| Footer (always dark) | `footer-bg/text/line/edge/field` |
| Status | `star #f5a524`, `success #16a34a`, `warning #d97706` |
| Fonts | `sans` = system-ui stack (as the prototype, no web font), `serif` = Georgia (hero emphasis) |
| Type scale | Tailwind defaults removed. px-named sizes as used by the prototype: `text-11 … text-42`, plus `text-caption` 12.5, `text-ui` 13.5, `text-nav` 14.5. Line height is inherited (body 1.55), like the prototype. |
| Radii | `rounded-6 … rounded-20`, `rounded-pill` |
| Shadows | `shadow-field`, `shadow-field-focus`, `shadow-menu`, `shadow-bar`, `shadow-card-hover` |
| Layout | `wrap` utility = 1100px centered column with 20px gutters (the prototype's `.wrap`); `max-w-site` |
| Breakpoints | Match the prototype's `max-width` queries: `max-sm` ≤520, `max-md` ≤760, `max-lg` ≤800, `max-xl` ≤900, `max-2xl` ≤1180 |

The Geist fonts from the starter were removed (the prototype uses the system font stack).

## Files

| File | What |
|---|---|
| `src/app/globals.css` | Tokens, `wrap` utility, base styles (body, safe-area, reduced motion) |
| `src/app/layout.tsx` | Title/description from the prototype, header + footer around every page |
| `src/app/page.tsx` | Placeholder ("Home page content arrives in Phase 4") |
| `src/lib/site-nav.ts` | Static categories and nav/footer links (categories move to the DB in Phase 5) |
| `src/components/icons.tsx` | The prototype's inline SVG icons as components |
| `src/components/layout/site-header.tsx` | Top bar, logo/search/wishlist/cart row, sticky red nav (server component) |
| `src/components/layout/category-menu.tsx` | ALL CATEGORIES dropdown (the only client component) |
| `src/components/layout/site-footer.tsx` | 4-column footer + bottom bar (server component) |

No new packages were installed.

## Differences from the prototype (deliberate)

| Prototype | Next.js now | Why / when |
|---|---|---|
| Hash routes (`#/shop?c=Networking`) | Real routes (`/shop?category=networking`, `/cart`, `/wishlist`, `/login`, `/register`, `/admin`) | App Router. These pages **404 until their phase** (6–9). |
| Search: JS live-suggestion dropdown | Plain `<form action="/shop">` with `q` param | Works without JS; suggestions come with Phase 6 |
| Cart button opens a drawer | Link to `/cart` | Phase 7 |
| On mobile, wishlist icon lands **before** the logo (missing CSS `order`) | Wishlist sits next to the cart | Looks like a prototype oversight |
| Categories dropdown opens on hover only (touch relies on JS) | Hover (CSS) **and** click/tap, closes on outside click / Esc, `aria-expanded` | Accessibility + touch |
| Logged-in account box in top bar | Omitted | Phase 8 |
| Newsletter form (simulated) | Visual only (button does nothing) | Phase 10 (Resend) |
| Cart/wishlist counts from JS | Fixed at 0 (badges hidden at 0, as in the prototype) | Phases 7/8 |

## Checks

| Check | Result |
|---|---|
| `npm run lint` | ✅ exit 0 |
| `npx tsc --noEmit` | ✅ exit 0 |
| `npm run build` | ✅ compiled, `/` prerendered as static |
| Every Tailwind class used has a generated CSS rule | ✅ 197 classes checked against the built CSS |
| Dev server on 3100 | ✅ HTTP 200. Title, top bar, search form, wishlist, cart text, ALL CATEGORIES + 7 dropdown links, nav, PROMOTION and footer all present in the HTML |
| `design/` untouched | ✅ |
| Visual side-by-side | ⏳ **user compares by eye** (headless screenshots were declined) |

## Incident during this phase

While testing, port 3100 was already in use by a dev server started from this folder (probably the user's own, from the Phase 1 check). Two things went wrong:
1. `npm run build` rewrote `.next/` underneath that running dev server, so it returned **HTTP 500**. The code was fine; a fresh server returned 200.
2. The cleanup step killed `next` processes by folder, which **stopped that server**.

Fix going forward: never run `next build` while a dev server might be running, and only stop processes whose PID was recorded at start. Just run `npm run dev` again to restart.

## How to compare side by side

1. `cd ~/nextjs-ecommerce && nvm use && npm run dev`, then open **http://localhost:3100**
2. Open the prototype in another tab: `\\wsl.localhost\Ubuntu\home\dell\nextjs-ecommerce\design\nexora-full-with-admin.html` (paste into the Windows browser address bar)
3. Compare at these widths (DevTools → device toolbar): **1280** (full desktop), **900** (PROMOTION hides, nav scrolls), **760** (mobile header: search drops to its own row, cart text hides) and **390** (phone).
4. Check: hover the ALL CATEGORIES button, hover links, focus the search box (red border), scroll (red nav sticks to the top), and the footer columns (4 → 2 → 1).
