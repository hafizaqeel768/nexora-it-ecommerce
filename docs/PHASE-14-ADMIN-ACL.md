# Phase 14 — Admin Users, Roles & ACL

Date: 2026-09-25 · New roadmap, phase 1 of 7 (see PROJECT-PLAN.md, "Roadmap change").

## How it fits the existing app

Staff are still `Customer` rows with `role = ADMIN`, so login, sessions and password reset work as before. Three things now decide what a staff account may do:

| | What it is | Who can change it |
|---|---|---|
| **Role** (`AdminRole`) | A named set of permission codes, e.g. `products.view`. Custom roles can be created, edited and deleted. | Admins with `roles.*`, and only with permissions they have themselves |
| **Super admin** (`Customer.isSuperAdmin`) | A protected flag, **not a role and not a permission**. It grants everything, and only super admins can manage other super admins. | Only another super admin, or `npm run admin:promote` from the server shell |
| **Disabled** (`adminDisabledAt`) | The account can't log in, and existing sessions end at once. | Admins with `admin_users.disable` |

**The existing account `admin@nexora.com` became a super admin** in the migration, so it keeps full access. Before this phase every admin could do everything.

## What you can do now (Admin → System)

- **Admin users** (`/admin/users`): list (All / Active / Disabled, role or Super Admin badge, status, last login, created). **Add admin user** asks for name, email, password (at least 10 characters, letters and a number), role, active, and a super admin switch that only super admins see. The **edit page** has details & role, reset password (signs the admin out everywhere), enable/disable, super admin (super admins only), delete, and the account's history.
- **Roles** (`/admin/roles`): list with permission and member counts. The role editor shows permissions grouped by module with "All/None" per module. Permissions you don't have are shown but locked. It also lists the role's members and history. A role that is in use can't be deleted.
- **Activity log** (`/admin/audit`): every security-relevant change, filterable by admin users or roles.
- **Starter roles** (ordinary data, editable): Catalog Manager, Sales Manager, Customer Manager, Content Manager, Support.

## Permissions (`src/lib/acl.ts`)

`dashboard.view` · `products.view/create/edit/import/export` · `categories.view/create/edit/delete` · `reviews.view/moderate` · `orders.view/edit/refund/export` · `quotes.view/edit` · `customers.view/edit/export` · `coupons.view/create/edit/delete` · `settings.view/edit` · `admin_users.view/create/edit/disable/delete` · `roles.view/create/edit/delete` · `audit_log.view`

Permissions only exist for things the app can do today. There is no product delete yet, so there is no `products.delete`. Attributes, attribute sets and import/export permissions come with Phases 15–17.

## Enforcement (server side)

- **Every admin page** calls `requireAdminPage(path, permission)`. Signed out → login. Not staff → "No access". Missing permission → `/admin/forbidden`. `/admin` without `dashboard.view` → the first section the admin may open.
- **Every server action** calls `assertAdmin(permission…)`. For example, toggling a product needs `products.edit`, a refund needs `orders.refund`, and converting a quote needs `quotes.edit` + `orders.edit`.
- **CSV exports** need `products.export` / `orders.export` / `customers.export`. Otherwise they return 404.
- **Packing slips** need `orders.view`.
- The sidebar, tabs and buttons only show what the role allows. Forms a role may only look at are shown **read-only** ("View only: your role can't change this").

### No privilege escalation (`src/lib/acl-rules.ts`, checked in `src/lib/admin-users.ts`)

- Nobody changes **their own** role, status, password, super admin status or account here. They use *My account* for their own name and password.
- A normal admin can only **assign, create or edit roles whose permissions they hold**, and can't edit or delete a role stronger than themselves. So `admin_users.*` + `roles.*` never adds up to more than the admin already has.
- A normal admin can't manage an admin whose role has permissions they lack, and never a super admin. That includes resetting their password, disabling them, deleting them or changing their details through *Customers*.
- **Super admin** can't be put in a role, and a role can't be named "Super Admin". Only a super admin can grant or remove it, and never on themselves.
- **Last super admin:** disabling, deleting or removing super admin from the last *active* super admin is refused. The check locks the super admin rows (`SELECT … FOR UPDATE`), so two simultaneous requests can't both succeed.
- Database: `CHECK` constraint `Customer_staff_fields_check`. A non-staff account can't have `isSuperAdmin`, a role or a disabled date.

**Deleting an admin user:** if the account has orders, quotes or reviews, it is kept as a customer record **without a login**, so the history stays linked. Otherwise it is deleted. **Creating an admin** with an email that has a registered account is refused. An earlier guest checkout with that email is turned into the admin account, and its orders stay linked.

### Audit log (`AdminAuditLog`)

The log records actor (id + email), action, target, time and what changed. Covered actions:
- admin created, changed or deleted
- role assigned
- password reset
- admin disabled or enabled
- super admin granted or removed
- role created, changed or deleted (with permissions added and removed)
- `admin:promote` from the command line

Each entry is written in the same transaction as the change. Passwords and tokens are never stored (a test checks this).

## Database (migration `admin_acl`)

- `Customer`: `isSuperAdmin`, `adminRoleId` (→ `AdminRole`, restrict), `adminDisabledAt`, `lastLoginAt`. Indexes on `role` and `adminRoleId`. `CHECK` constraint for the staff-only fields.
- New tables `AdminRole` (unique name, `permissions text[]`) and `AdminAuditLog` (indexed by time and by target).
- Data: existing admins → super admin; 5 starter roles.

## Command line

`docker compose exec app npm run admin:promote -- you@example.com` now makes the account a **super admin**. `--revoke` removes staff access, and is refused for the last active super admin. Both are written to the activity log.

## Checks

| Command | What it does | Result |
|---|---|---|
| `docker compose exec app npm test` | Unit tests of the permission catalog and escalation rules | **13/13** ✅ |
| `docker compose exec app npm run test:integration` | Creates a **separate throwaway database** `nexora_test` on nexora_pg, applies all 11 migrations from zero, runs the service tests. Covers roles, validation, hashing, every escalation path, role changes applying immediately, disable/enable, password reset (no password in the log), last super admin (including **two simultaneous removals**), the DB constraint, and the delete/keep-history paths. | **25/25** ✅ |
| `docker compose exec app npm run test:e2e` | Real HTTP against the running dev server with test-owned accounts (`p14-…@example.test`), then deletes them. Covers a disabled login, customer / signed-out / role-restricted page access, CSV exports by permission, and **server actions called directly with the `Next-Action` header**. Toggle product and disable admin are refused for roles without the permission. A user manager can't disable a super admin or grant super admin, not even to themselves. The same calls by a super admin succeed, which proves the refusals are real. | **12/12** ✅ |
| `tsc --noEmit`, `eslint` | | clean ✅ |
| Production build (`NEXT_DIST_DIR=.next-qa`) | Separate folder, dev server untouched | ✅ |

The dev database was backed up first (`pg_dump`). **After the tests, all counts matched the "before" snapshot:** 12 customers (1 admin, still super admin), 311 products, 25 orders, 10 categories, 2 coupons, 43 reviews, 3 quotes, 5 roles, 0 audit entries, 0 test accounts left.

### Incident during testing (fixed)

- **Dev server needs a restart after a schema change.** The Prisma client is cached on `globalThis` across hot reloads (src/lib/db.ts), so the running server didn't know the new columns, and logins failed until `docker compose restart app`. It was restarted, and logins work again. Remember this after future migrations.

## Not in this phase / not tested live

- **No-JavaScript fallback of bound server actions fails in the dev server** (turbopack) with "Cannot read properties of undefined (reading 'bind')". That covers switches and buttons like *Live* or *Disable account* when JavaScript is off. With JavaScript (normal use) they work. This is not new in Phase 14; the same forms existed before.
- Not tested by clicking in a browser: layout of the new screens, the permission picker's All/None buttons, and read-only forms. Please click through them.
- Two-step login and login rate limiting are not part of this phase (Phase 19 security audit).
- The Settings → **SEO** tab (from the Phase 17 WIP commit) still links to a page that doesn't exist yet.
