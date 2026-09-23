# Phase 12 — Catalog Management

Date: 2026-09-23 · Store-management roadmap, phase 2 of 7 (see PROJECT-PLAN.md).

## What you can do now

In the admin sidebar, **Products** has tabs **Products · Categories · Brands · Import CSV**, and there is a new **Reviews** item.

| Screen | What works |
|---|---|
| **Categories** | Add / edit / delete (only when empty), two levels (top + sub), URL name (auto from the name), **image upload** or **icon**, description, order, **show in menu**. Rules: no third level, a category with subcategories stays top-level, URL names unique and valid. |
| **Storefront categories** | The *All categories* menu, the footer's *Shop* column and the **home page tiles** now come from the database (they were hard-coded). The home page shows the **first 6 menu categories** (by order) plus *IT Services* and *All Products*, like the prototype. Hidden categories keep their shop page. |
| **Brands** | Every brand with product counts; **rename** on all products, or **merge** by renaming to an existing brand (e.g. spelling variants). |
| **Product → Options** | One option group per product (e.g. *Warranty*: 1 year +$0, 3 years +$25), with name, price change, SKU. Rows can be added, removed and reordered by position. Existing options keep their id, so carts and past orders stay linked. |
| **Product → Bulk pricing** | Tiers "from N units, X % off" with a live unit-price preview. Tiers must go up without overlapping; the last may be open-ended. |
| **Reviews (customers)** | Logged-in customers write a review on the product page (1–5 stars, optional headline, text) and can edit it later. One per product. Shown as "Jordan K.". **✓ Verified buyer** when they ordered it. |
| **Reviews (admin)** | *Waiting for approval* / *Approved* / *All*; **Approve**, **Hide**, **Delete**. Settings: reviews on/off, **approval required** (default on), **buyers only**. The dashboard shows how many are waiting. The product's star rating follows its approved reviews. |
| **Import CSV** | Same columns as *Export CSV* (SKU, Name, Brand, Category, Price, Compare-at price, Stock, Status, URL slug; Description optional). **Preview** shows new / changed / unchanged / errors per row; nothing is written until **Apply**. Rows match existing products by URL slug, then SKU; other rows create products. Rows with errors are skipped. Up to 2,000 rows / 2 MB. |

**Watch out with import:** a row whose SKU (or URL slug) matches an existing product **updates** it. The preview shows "Change" with what would change, so read it before pressing Apply.

## Carried over (migration `catalog_management`)

- Top-level categories got the icons and the **home tile descriptions** that were in the code, so the menu, footer and home page look the same as before. Tile titles now use the category names (e.g. "Computers" instead of "PCs & Laptops"), and both can be changed in Admin → Categories.
- New fields: `Category.icon`, `Category.showInMenu`, `Review.title`, `Review.verifiedBuyer`, one review per customer per product. Existing data unchanged (43 demo reviews stay approved).
- Settings section `reviews` (`src/lib/config-shared.ts`).

## Checks

Against the live container with a temporary admin, buyer and second customer, and test-owned products (`P12-…`) and categories. **Afterwards every count matched the "before" snapshot:** 311 products, 10 categories, 43 reviews (rating sum 199), 8 options, 12 tiers, 58 brands, product rating sum 63.8, 25 orders, 12 customers. The test category image was removed.

| Area | Result |
|---|---|
| Access | 4 new admin screens: admin 200, customer → "No admin access"; customer calls to catalog/review actions rejected |
| Categories | Auto URL name; duplicate / invalid URL name and a third level refused; subcategory; parent with children can't move under another; order −1 + image → first home tile (6th drops off); non-empty delete refused, empty delete works; hidden from menu/footer/tiles but shop page still works |
| Import | Preview 3 new / 4 errors (unknown category, bad price, duplicate row, compare-at ≤ price), extra column ignored, nothing written; Apply creates 3 and skips 4; `$1,200.50`, "not tracked", draft, quoted comma all parsed; a name starting with `=` is stored as typed, guarded as `'=` in the export and restored on import; export → import = unchanged; edited export → exactly "price 100 → 95, stock 20 → 3"; slug-matched row with another product's SKU refused; file without key columns refused |
| Brands | Merge (2 moved, merged), rename (3 moved) |
| Options / tiers | Validation (group name, duplicate names, foreign option id, overlaps, > 90 %); ids kept on edit; product page shows choices with price change and the bulk table ($85.50 / $76.00); **order 10 × (95 −20 % + $40) = $1,160 + 8 % tax = $1,252.80** |
| Reviews | Guest sees "Log in", customer sees the form; short text refused; pending until approved (author sees "waiting"); approve → public + rating; verified-buyer badge for the buyer; edit replaces and re-queues; buyers-only; approval off → live; reviews off → no form and refused; delete → rating recalculated; customer can't approve |
| Build | `tsc`, `eslint` clean; production build OK (34 pages) |

### Incident during testing (fixed and restored)

The first import test used a **real** product's SKU in a row meant to test a "SKU clash". The import matched it by SKU, as designed, and the test's Apply **overwrote the real product TRENDnet TEG-S50G** (name, brand, category, price, stock). It was restored field by field from `docs/kijero-products.json` (the seed's source); all other catalog products were untouched (TRENDnet has 14 products again). The same run exposed a real bug, now fixed: an empty "URL slug" cell made every row look like a duplicate (`??` vs `||` on empty strings). Tests now only touch test-owned data.

**Not in this phase:** multiple option groups per product (e.g. colour × size), brand logos/pages, and images/options in the CSV import.
