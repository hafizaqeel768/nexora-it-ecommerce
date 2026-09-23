# Phase 4 — Images Folder Wiring

Date: 2026-09-23 · Decisions made with the user: **rename to slugs + manifest**, **category tiles show photos where available**, **build only the image-bearing home sections**.

## What was in media/

| Folder | Found |
|---|---|
| `media/` | 5 site images (webp): 4 brand banners + 1 about image |
| `media/category/` | 3 images (webp, 135×135): monitor, ups, wireless bridge. No image for computers, tablets or IoT. |
| `media/products/` | **297 product photos** (296 `.jpg`, 1 `.jpeg`, 18 MB) added by the user, named after the full product title |

All 8 images embedded (base64) in the prototype are byte-identical to files in `media/`.

## Naming convention

```
media/<name>.webp                   site images: about-main, banner-<brand>-<topic>
media/category/<category-slug>.*    category photos (webp/jpg/png); optional, tiles fall back to icons
media/products/<product-slug>.jpg   product photos
src/data/product-images.json        slug → file → original title (for the Phase 5 seed)
```

Slug = lowercase, accents stripped, every run of non-alphanumerics → `-`, trimmed. `.jpeg` becomes `.jpg`.

### Renames performed

A backup (`media-backup-before-phase4.tar`, 305 files) and checksums were taken first. **All 305 files are byte-identical after renaming**; only the names changed.

| Old | New |
|---|---|
| `viewsonic-monitors.webp` | `banner-viewsonic-monitors.webp` |
| `ubiquiti-switches.webp` | `banner-ubiquiti-switches.webp` |
| `METSEPM8244---kijero-llc_1.webp` | `banner-schneider-power-meters.webp` |
| `prolec-transformer-Kijero-llc_1.webp` | `banner-prolec-transformers.webp` |
| `about-kijero.webp` | `about-main.webp` |
| `category/monitor.webp` | `category/monitors.webp` |
| `category/ups.webp` | `category/power.webp` |
| `category/wireless-wifi-bridge.webp` | `category/networking.webp` |
| 297 × `products/<Title>.jpg` | `products/<slug>.jpg`: full list with original titles in `src/data/product-images.json` |

Example: `Adesso AUH-5100 CyberHub UHD 4K60 HDMI Splitter & Switcher.jpg` → `adesso-auh-5100-cyberhub-uhd-4k60-hdmi-splitter-switcher.jpg`. There were no slug collisions.

### Adding more product photos later

Drop the photo into `media/products/` named with the product title, then:

```bash
npm run media:slugify -- --dry-run   # preview
npm run media:slugify                # rename + add to manifest
```

It is safe to re-run: slugged files are skipped, it never overwrites, and it stops with an error on a collision.

## How images are served

Next.js serves static files only from `public/`. Instead of copying 20 MB, **`public/media` is a symlink to `../media`**, so `media/` stays the single copy.
- `/media/...` URLs serve the originals, and `next/image` optimizes them (`/_next/image?url=/media/...`).
- `src/lib/media.ts` is the only place that knows the paths: `siteImages` (about + banners with sizes), `categoryImage(slug)` (returns `null` if there's no photo, so the tile shows its icon) and `productImage(slug)`.

## Home page sections built

Order as in the prototype, only the sections that carry images:

| Section | Images | Behaviour ported from the prototype |
|---|---|---|
| Hero (`hero.tsx`, client) | 3 floating cards: `category/monitors`, `category/power`, `category/networking` | 3-slide carousel (6s autoplay, arrows, dots, progress bar, swipe), particle-network canvas that reacts to the pointer, 3D tilt of the card stage, scroll parallax, stat count-up. Respects reduced motion. |
| About (`about-section.tsx`) | `about-main.webp` | Tick list, floating image |
| Product categories (`category-grid.tsx`) | Monitors, Networking, Power **show photos**; Computers, Tablets, IoT, IT Services, All Products show icons | Hover lift, numbered tiles, red "All Products" tile |
| Top brands & promotions (`brand-deals.tsx`, client) | 4 banners | Tabs + slideshow, 5s rotation, blurred backdrop, "Shop now" badge |

Not built yet (no images, or needs data): brand marquee, featured products (needs DB, Phase 6), sectors, why us, FAQ, contact form.

Styling: the hero and brand deals, which are heavily animated, use CSS modules ported rule-for-rule from the prototype. About and categories use Tailwind. Shared pieces (`.btn`, `.eyebrow`, `.section-title`, `.section-sub`, `.section-head`, `section-white`, `section-grey`, `animate-bob`) were added to `globals.css`.

## Checks

| Check | Result |
|---|---|
| `npm run lint` | ✅ exit 0 |
| `npx tsc --noEmit` | ✅ exit 0 |
| Home page on the user's running dev server (3100) | ✅ HTTP 200, all 4 sections present, exactly one `<h1>` |
| Images referenced | ✅ All 8 (about, 4 banners, 3 category photos) |
| Raw files via symlink | ✅ `/media/...webp`, `/media/category/...`, `/media/products/...jpg` → 200 with the correct type |
| Optimized via `next/image` | ✅ `/_next/image?url=/media/...` → 200 |
| Category tiles | ✅ Photos on Monitors/Networking/Power, icons on the other 5 |
| Rename script idempotent | ✅ Second dry run: 0 renamed |
| `npm run build` | ⏸ **Not run**, because the user's dev server was running and a build would disrupt it (see Phase 3 incident). Run it after stopping the dev server. |
| Visual comparison | ⏳ User, by eye |

## Notes

- The optimizer returns WebP/AVIF to browsers (curl got JPEG because it doesn't advertise WebP).
- `media/` (20 MB, 305 images) will be committed to git with the code unless we decide otherwise. It's fine at this size; revisit if photos grow a lot (Git LFS or an image host in Phase 9).
- Category photos are 135×135 and look sharp in the 60px tile box and the 150×110 hero cards. Larger category photos would be needed for bigger tiles.
