# Phase 16 — Product Attributes

Date: 2026-09-25 · New roadmap, phase 3 of 7 (see PROJECT-PLAN.md).

## What you can do now

**Admin → Products** has a new tab, **Attributes** (`/admin/attributes`). Attributes are configured here, not in code: for example Processor, RAM, Storage, GPU, Screen size, Resolution, Operating system, Warranty or Color. The list starts **empty**: nothing business-specific is built in.

| Screen | What works |
|---|---|
| **Attribute list** | Search (name or code), filter by input type and status. Columns: name (+ unit), code, input type, required, number of options, sort order, **Active switch**. Empty state explains what to add. |
| **Add attribute** | **Attribute code** (e.g. `screen_size`: lowercase letters, numbers and `_`, starting with a letter, 2–40 characters; built-in product fields like `sku`, `price`, `name` are reserved), **name**, **input type**, **required**, **default value** (checked for the type), **unit** (numbers, e.g. GB, in, W), **sort order**, **description**, **show on the product page**, **active**. |
| **Edit attribute** | Everything except **code and input type**, which are fixed once created (like Magento): changing them would break values saved on products in Phase 17. Read-only for roles that can only view. |
| **Options** (dropdown / multiple choice) | **Add**, **rename**, **disable** (stays on products that already use it, can't be chosen any more), **reorder** (↑ ↓), **default** (one for a dropdown, several for multiple choice), **remove** (only while no product uses it). Existing options keep their id when renamed or moved. |
| **Delete attribute** | Only while unused: no attribute set and no product value. Otherwise the page says where it is used and suggests disabling it. |

### Input types

| Type | Stored default | Notes |
|---|---|---|
| Text | text, max 255 | one line |
| Text area | text, max 2,000 | several lines |
| Number | e.g. `15.6` | optional unit |
| Yes / No | `yes` / `no` | |
| Dropdown (one choice) | option marked default | at most one default |
| Multiple choice | options marked default | several defaults allowed |
| Date | `YYYY-MM-DD` | real dates only (2026-02-30 is refused) |
| Price | `1299.00` | store currency, 2 decimals |

## Permissions

New: `attributes.view`, `attributes.create`, `attributes.edit` (also enable/disable and options), `attributes.delete`. Every page and action checks them **on the server**. The rules live in `src/lib/attributes.ts`, which checks the permission again. **Catalog Manager** got all four, and **Content Manager** got `attributes.view`.

## Database (migration `product_attributes`)

- `Attribute`: code (unique, `CHECK` for the format), name, type (enum `AttributeType`), required, default value, unit, active, sort order, description, show on product page.
- `AttributeOption`: attribute (cascade delete), label (unique per attribute), sort order, active, default.
- Values per product and attribute sets come in Phase 17, in their own table: no column per attribute. All delete checks go through one function (`attributeUsage`), which Phase 17 fills in.

## Checks

The dev database was backed up first. **Afterwards all counts matched** (12 customers, 5 roles, 311 products, 25 orders, 0 attributes, 0 activity entries), and **product and customer checksums were identical**.

| Command | Result |
|---|---|
| `npm test`: codes (format, reserved), defaults for every type (normalised: `15.60` → `15.6`, `$1,299` → `1299.00`; refused: bad numbers, `2026-02-30`, too long, defaults on dropdowns), which types have options/units | **26/26** ✅ (5 new) |
| `npm run test:integration` (throwaway `nexora_test` database, all migrations from zero): every input type created; validation (code, reserved, duplicate code, duplicate name in any case, type, sort order, default); code and type stay fixed on edit; permissions refused by the service; DB `CHECK` rejects a bad code; options added in order with one default; rename + reorder + **swapping two labels** + disable keep the same rows; duplicates, empty labels, two defaults on a dropdown, a disabled default, **another attribute's option id** and >500 options are refused with nothing changed; multiple defaults on multiple choice; no options on a number; remove; disable/enable; delete with options | **54/54** ✅ (12 new) |
| `npm run test:e2e` (HTTP against the running server, `p16_…` test data): pages by role; **create, options, delete and toggle called directly** without the permission are refused and change nothing; the same calls with the permission work | **19/19** ✅ (2 new) |
| `tsc`, `eslint`, production build in a separate folder | ✅ |

## Not in this phase / not tested live

- Attribute sets, the product form fields, saving/showing values on products: **Phase 17**.
- Using attributes as shop filters, and importing/exporting attribute values (can be added to Data Transfer after Phase 17).
- Translations of attribute names.
- Clicking through in a browser: the options editor (↑ ↓, default ticks) and the form switching fields when the input type changes. Please try them.
