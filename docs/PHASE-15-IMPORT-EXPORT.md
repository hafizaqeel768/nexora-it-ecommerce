# Phase 15 — Import / Export Framework

Date: 2026-09-25 · New roadmap, phase 2 of 7 (see PROJECT-PLAN.md).

## What you can do now

A new sidebar item **Data transfer** has tabs **Import · Export**. The Products list's *Import CSV* tab and every *Export CSV* link now use this framework.

| Screen | What works |
|---|---|
| **Import** (`/admin/data-transfer/import`) | Choose the **entity** (Products, Categories, Customers), the **behavior** (*Add*, *Update*, *Add / Update*), what happens to **rows with errors** (*skip them* or *stop: import nothing*), and a **.csv file** (UTF-8, up to 5 MB / 5,000 rows). Each entity has a **column guide** (required/optional, format, example) and **Download sample CSV**. A **Recent imports** list shows who imported what, and when. |
| **Validate & preview** | Nothing is written yet. It shows **Total rows · Valid · Warnings · Errors**, file-level warnings (e.g. ignored columns), and every row as *Row 2: Valid · New*, *Row 3: Error: Price is required*, *Row 4: Warning: Category “X” not found; the current category is kept*. Rows can be filtered by level, 100 per page. Buttons: **Confirm import** (it says how many are new and how many are updates), **Cancel**, and **Download error report**. |
| **Result** | **Imported (new) · Updated · Skipped · Failed**, each row's outcome, and the **error report CSV**: the original row with its row number and the reasons. |
| **Export** (`/admin/data-transfer/export`) | Choose the entity and its filters. The page shows **how many rows match** before you download. Format: CSV (built so XLSX/JSON/XML can be added). |

### Entities

| Entity | Import | Matched by | Export filters |
|---|---|---|---|
| **Products** | ✅ | SKU, then URL slug (both pointing to different products → error) | search, SKU, category (incl. subcategories), status, price from/to, stock (in / out / low / not tracked) |
| **Categories** | ✅ | URL name | status (shown/hidden in menu), level, parent |
| **Customers** | ✅ | email | email, status (registered / guest / tax-exempt / staff), date range |
| **Orders** | ❌ export only | n/a | order number, status, payment status, customer (name/email), date range |

An exported Products, Categories or Customers file can be edited and imported again. The test suite checks that an unchanged export imports as **"no changes"**. Customer exports also contain read-only columns (orders, total spent, last order…), which the import ignores.

### Validation (before anything is written)

- **File:** `.csv` name, a text MIME type, max 5 MB, valid UTF-8, no binary/NUL bytes, max 5,000 rows. The file name is only displayed; any path in it is removed.
- **Headers:** matched ignoring case, spaces, `_` and `-` (so `compare_at_price` = *Compare-at price*). A column that appears twice, or is missing but required for the chosen behavior, rejects the file. Unknown columns are ignored with a warning. A row with more cells than the header is an error.
- **Rows:**
  - required fields, types (amounts with up to 2 decimals, whole numbers, yes/no, emails, dates), lengths, control characters
  - duplicates within the file
  - references: categories and parent categories must exist (or come earlier in the same file); countries by code or name
  - uniqueness: SKU and URL slug against the database and the file
  - business rules: compare-at price above price, only two category levels, a category with subcategories can't become a subcategory, staff accounts can't be changed, tax exemption only for registered accounts

### Safety of the import

- **Nothing is written until you confirm.** The preview stores the upload in the database (`ImportJob.content`, never on disk). On confirm, **the same file is validated again** against the current data.
- **Confirm runs once.** Status `VALIDATED → IMPORTING` is claimed atomically, so a double click or two tabs can't import twice (tested with two confirms at the same moment).
- **Chunked transactions:** 100 rows per transaction. If a chunk fails, its rows are retried one by one, so one bad row can't stop the good ones and **no row is ever half-written**. Categories are written parents first.
- **Stop mode:** with *stop: import nothing*, a file with any error changes nothing.
- **Customers:** contact details only. **Passwords, logins and roles are never imported.** New customers are records without a login, and registering later with that email drops the unverified details (existing rule). Staff accounts are refused.
- **CSV injection:** exports prefix cells starting with `= + - @` with `'`. The import removes that prefix again, and every export of imported text is guarded.
- Uploads are cleared after 7 days. Previews nobody confirmed are cancelled after a day.
- **Activity log:** every import (counts, behavior) and export (entity, filters, row count) is recorded.

### Why there is no order import

An order ties together a customer, product snapshots, **stock reservations**, **payment state** (Stripe sessions, refunds), shipping and tax totals, status history and emails. An import would create orders that skip those rules: wrong stock, totals that don't add up, or "paid" orders with no payment. Orders keep coming only from checkout and quote conversion. **Order export is supported**, with one row per order and its items in one column.

## Permissions

New: `import.access`, `export.access` (open the screens), `categories.import`, `categories.export`, `customers.import`. Each entity also needs its own permission (`products.import`, `orders.export`, …), **checked on the server** for every page, download, sample file, error report and action. The Products/Orders/Customers list export links still need only the entity's export permission, as before.

Starter roles were extended: Catalog Manager (+ import/export access, categories import/export), Sales Manager (+ export access), Customer Manager (+ import/export access, customers import).

## Database (migration `data_transfer`)

- New table `ImportJob`: entity, behavior, on-error mode, file name/size, file content (cleared later), status (`VALIDATED`, `IMPORTING`, `DONE`, `FAILED`, `CANCELLED`), totals, per-row report, result, created by, finished at.
- Starter roles get the new permissions (only added, nothing removed).

## Code

- `src/lib/data-transfer/`: `types.ts` (adapter interfaces), `import-engine.ts` (file checks, header mapping, validation, chunked import, error report), `export-engine.ts` (streaming in 500-row pages, format registry), `jobs.ts` (preview → confirm once → result, permission checks, audit), `registry.ts`, `values.ts` (cell parsers), `entities/{products,categories,customers,orders}.ts`.
- Adding an entity is one adapter file plus one line in `registry.ts`. Adding a format is one entry in `FORMATS`.
- Removed: `src/lib/product-import.ts`, `components/admin/import-form.tsx` and the `importProducts` action (replaced; `/admin/products/import` redirects).

## Checks

The dev database was backed up first (`pg_dump`). **Afterwards all counts matched the "before" snapshot** (12 customers, 311 products with stock sum 280, 25 orders, 10 categories, 43 reviews, 5 roles, 0 activity entries, 0 import jobs), and **checksums of every product, customer and category row were identical**.

| Command | Result |
|---|---|
| `npm test`: unit tests (parsers, CSV round trip, formula guard, upload checks: wrong extension/type, empty, >5 MB, binary, non-UTF-8, path in the name) | **21/21** ✅ |
| `npm run test:integration`: throwaway `nexora_test` database with all 12 migrations from zero. Preview levels (valid/warning/error), file-level rejections, behaviors, skip vs stop, per-row isolation when a write fails (rolled back, rest kept), error report, export → import round trip with no changes, categories parent-in-same-file / third level / self-parent, customers (no passwords, staff refused, countries, tax exemption), jobs (permissions, confirm-once under two simultaneous confirms, cancel, audit), every exporter, **1,203-row export across 3 pages without gaps**, price/stock filters, sample files | **42/42** ✅ (17 new + 25 from Phase 14) |
| `npm run test:e2e`: HTTP against the running server with `P15-…`/`p15-…` test data. Role without access → forbidden pages and 404 downloads; per-entity permissions; bad date filter → 400; **validate called directly** by a role without permission → nothing stored; `.exe` upload refused; preview stores nothing; **confirm called directly by another role → refused**; confirm once; second confirm refused; error report private; the list export link round-trips; old import URL redirects; imports and exports in the activity log | **17/17** ✅ (5 new + 12 from Phase 14) |
| `tsc`, `eslint`, production build in a separate folder | ✅ |

### Incident during testing (fixed)

The first HTTP test run sent the file in a different multipart layout from a browser, so the server received no file. It was a test problem, not an app problem. The tests now build requests with **React's own encoder** (`encodeReply`), exactly like the browser. Two temporary debug log lines used to find this were removed.

## Not in this phase / not tested live

- **XLSX / JSON / XML** export and import (the format registry is ready for them).
- **Replace** behavior: not offered. It would delete records not in the file, which is unsafe with orders and reviews linked.
- Importing product photos, options, bulk prices, category images/icons.
- Background jobs for very large files. Imports run in the request (up to 5,000 rows); exports stream without limit.
- Clicking through in a browser: the column guide switching with the entity, and the preview page on a phone. Please try them.
