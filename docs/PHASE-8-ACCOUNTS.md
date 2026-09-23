# Phase 8 — Accounts + Wishlist

Date: 2026-09-23

## What works

| Piece | Behaviour (from the prototype) |
|---|---|
| **`/register`**, **`/login`** | The prototype's auth modal as its own page (the header links already pointed here). Register: full name, email, password (min. 8 characters). Login: email + password. Errors per field; the typed name/email survive a failed submit. `?next=` returns you to where you were (same-site paths only). Signed-in visitors are sent to `/account`. |
| **Header** | Signed out: Login · Register. Signed in: **name** (→ profile) · **Orders (n)** · **Logout**, like the prototype's `acctBox`. |
| **`/account`** | "My account / Welcome back, {name}" with the prototype's tabs: **Orders** (number, status badge in the prototype colours, date, total, items, "Awaiting payment"; each links to `/order/<id>`), **Addresses** (street, city, state, ZIP, country), **Profile** (name, phone; email shown read-only). Signed out → "Please sign in". |
| **Wishlist** | Heart on every product card and **♡ Save for later / ♥ Saved** on the product page. Saved in the database (`WishlistItem`). Header heart shows the count. Signed-out clicks go to login and come back. |
| **`/wishlist`** | "My wishlist", newest first, as normal product cards (unsaving removes the card). Inactive products are skipped. Signed out → "Please sign in". |
| **Checkout** | Signed in: name, email, phone and saved address are **pre-filled**; the order is linked to the account; the first order's shipping address is saved to the profile if none is set. |

## How login works

- **Auth.js** (`next-auth@5.0.0-beta.32`, pinned; v5 is the App Router version and still published as beta) with the **Credentials** provider. The session is a signed **JWT cookie** (30 days), so no Auth.js `Account`/`Session` tables are needed.
- The cookie only carries the customer id. Name, role, address and wishlist are read fresh from the database on each request (`src/lib/viewer.ts`), so edits show immediately and a deleted customer is simply signed out.
- Passwords: **scrypt** from Node's built-in `crypto` (`src/lib/password.ts`), random salt, constant-time compare. An unknown email takes as long as a wrong password, and both give the same message.
- `AUTH_SECRET` (signs the cookie) was generated into `.env`; `.env.example` has a placeholder. A new secret signs everyone out.
- `Role` (CUSTOMER / ADMIN) already exists on `Customer`; Phase 9 will gate `/admin` with it. No admin user is created yet.

### Guest orders and accounts (no email verification yet)

Anyone can register any email address until emails are verified (Phase 10), so the rules are:

- **Account order history starts at registration.** Guest orders placed with that email earlier are not shown.
- Registering an email that only has a guest checkout record **claims** that record but **clears the guest's phone and address**, so they aren't shown to whoever registered.
- A **guest checkout with a registered email** creates the order without linking it to that account. Only the account owner, signed in, adds orders to it.

When Phase 10 adds email verification, verified accounts can safely show their earlier guest orders.

## Schema change (migration `customer_auth`)

`Customer` gains `passwordHash` (null = guest, cannot log in) and `registeredAt`. Both are nullable, so no existing rows changed. It was created with `prisma migrate dev` (it ran fine without an interactive terminal this time, since there were no warnings). The app was restarted afterwards, as noted in Phase 7.

## Files

| File | Purpose |
|---|---|
| `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts` | Auth.js config + endpoints |
| `src/lib/password.ts` | scrypt hash / verify |
| `src/lib/viewer.ts` | Signed-in customer for the request (cached per request), account order filter |
| `src/app/actions/account.ts` | register, login, logout, profile, address, wishlist toggle |
| `src/app/login`, `src/app/register`, `src/app/account`, `src/app/wishlist` | Pages |
| `src/components/account/*` | Auth form, account forms, field, sign-in prompt |
| `src/components/wishlist/*` | Wishlist state (seeded from the server, updated at once on click) + heart, save-for-later, header link |
| Changed | `layout.tsx` (wishlist provider), `site-header.tsx`, `product-card.tsx`, `purchase-panel.tsx`, checkout page/view/action |

**Note:** the header now reads the session, so every page renders per request (no static pages). That is normal for a shop with a personalised header. Performance can be tuned later if needed.

## Packages

`next-auth` 5.0.0-beta.32, pinned exactly and installed in the container. No other new packages.

## Checks

Run against the live container by calling the real server actions (37 checks), then all test data deleted (back to 10 customers, 24 orders, 0 wishlist items).

| Check | Result |
|---|---|
| Register | Short password rejected per field; success signs in and redirects to `/account`; duplicate email rejected; email stored lower-case |
| Login | Wrong password and unknown email → same "Wrong email or password." (email kept in the form); success → `?next` path; `next=//evil.example` → `/account` |
| Header / pages | Name, Orders (n), Logout when signed in; `/login` while signed in → 307 to `/account`; `/account` and `/wishlist` show "Please sign in" when signed out |
| Wishlist | Signed out → login; unknown product refused; add → card on `/wishlist`, header "Wishlist, 1 item", heart pressed; remove → empty |
| Profile / address | Empty name rejected; name change shows in header; address saved; checkout pre-fill carries name, email, phone and saved address |
| Orders | Signed-in order appears in the account (Orders (1), "Awaiting payment"); first order saves the address to the profile; guest order with a registered email → no customer link, not in the account |
| Guest claim | Registering a guest email works; earlier guest order hidden; guest address/phone not shown |
| Logout | Cookie cleared, header back to Login/Register |
| `tsc`, `eslint` | ✅ clean; no errors in the container log after the restart |

**Not testable from the terminal:** clicking in the browser (the heart toggling at once, the login → back-to-page flow, how the forms look). Please try them in the browser.
