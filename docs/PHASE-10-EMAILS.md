# Phase 10 — Emails + Polish

Date: 2026-09-23

## Seeing the emails (development)

A new container, **`nexora_mailpit`** (Mailpit v1.31.2), catches every email the app sends. **Inbox: http://localhost:8025.** Nothing reaches real addresses. The app sends through Mailpit's HTTP API inside `nexora_network`. Only the inbox is published, on 127.0.0.1:8025; port and name were verified free and recorded in `PHASE-0-ENVIRONMENT.md`. Restarting Mailpit empties the inbox.

## Going live with real email (Resend)

1. Create a Resend account, verify your sending domain, and create an API key
2. In `.env`: `RESEND_API_KEY=re_…`, `EMAIL_FROM="Nexora IT <orders@your-domain>"` (the domain must be the verified one), `APP_URL=https://your-site` (links in emails)
3. Restart the app. With a Resend key set, email goes to Resend instead of Mailpit. The admin dashboard's **Email** card shows which transport is in use.

## What gets sent

| Email | When |
|---|---|
| **Order received** | Order placed with purchase order / bank transfer. Card orders: once Stripe confirms payment. Items, totals, payment note, link to the order. |
| **Order status** (Processing, Shipped, Delivered, Cancelled…) | Every admin status change. Replaces Phase 9's "recorded only" log. |
| **Confirm your email** | Registration (link valid 24 h); "Send the link again" on the account page |
| **Reset your password** | "Forgot password?" on the login page (link valid 1 h, once) |
| **Abandoned cart** | Signed-in customer with a **confirmed** email left the cart untouched for 3 h (`ABANDONED_CART_HOURS`) and hasn't ordered since. One reminder per cart version. |

Order emails are **queued in the same transaction** as the order change and sent right after the response, so a slow or broken email service never blocks checkout or the admin. Failures are shown in the admin order's **Email notifications** (Failed ×n + the error + **Retry**) and retried automatically, up to 5 tries.

The customer's account shows the latest sent email per order ("✉️ Email sent: shipped (date)"), like the prototype.

## Accounts

- **Email verification** (promised in Phase 8): once confirmed, the account also shows **earlier guest orders placed with that email**. The account page shows a "Please confirm your email" banner until then.
- **Forgot / reset password**: `/forgot-password` gives the same answer whether or not the account exists. `/reset-password` shows the form and only uses up the link on save, so email scanners that open links don't break it. A reset also confirms the email address and **signs out every other device** (sessions older than the password change are rejected).
- Links contain a random 256-bit token. Only its SHA-256 hash is stored, and each token can be used once. At most one new link per account and purpose per minute.

## Abandoned carts

- For signed-in customers the cart is saved on the server (`SavedCart`) a moment after each change. If they log in on another device with an empty cart, **it's restored**.
- Placing an order clears the saved cart. Saving an identical cart (e.g. restoring it) doesn't trigger a second reminder.
- Reminders only go to confirmed emails, so nobody can make up an account to send mail to someone else.

## Email jobs (retries + reminders)

- Run **inside the server every 15 minutes** (`JOBS_INTERVAL_MINUTES: 15` in docker-compose.yml, via `src/instrumentation.ts`)
- **Admin dashboard → Email → "Run email jobs now"** also shows the transport, waiting/failed emails and carts without a reminder
- For serverless hosting (no long-running server): set `CRON_SECRET` and call `GET /api/cron/email-jobs` with `Authorization: Bearer <secret>` from a scheduler. Without the secret the route returns 404.

## Polish

- **404 page** with the store header for unknown URLs and missing products; **error pages** for the store and the admin (with "Try again")
- `.env.example` documents every setting (Resend, EMAIL_FROM, APP_URL, ABANDONED_CART_HOURS, CRON_SECRET)
- `next.config.ts` accepts `NEXT_DIST_DIR`, so a QA production build can run next to the live dev server (see DOCKERIZATION.md)

## Schema (migrations `emails`, `saved_cart_changed_at`)

`Customer.emailVerifiedAt`, `Customer.passwordChangedAt`; `OrderEmail.kind` (CONFIRMATION / STATUS) and `attempts`; new `AuthToken` and `SavedCart` tables. Existing rows were not changed. The second migration replaced `SavedCart.updatedAt` with `changedAt` (the table was new and empty). An automatic `updatedAt` also moved when a reminder was recorded, which would have hidden real cart changes.

## Final QA

| Check | Result |
|---|---|
| **Production build** (`next build`, separate folder) | ✅ Compiles, types and lint pass, all 31 routes build. The dev server kept running (200) throughout. |
| `tsc`, `eslint` | ✅ clean |
| Regression sweep | ✅ 23/23: home, shop (search + category), product page, cart, checkout, login/register/forgot, account/wishlist prompts, media files, search API, all 8 admin pages |
| Order emails | ✅ Guest order → "Order … received" (items, total, link); signed-in order → confirmation; admin → Shipped email with text; admin log "Sent"; account shows the latest email |
| Failure + retry | ✅ Mailpit stopped → status still saved, admin shows "Failed (1×)" + error + Retry, dashboard 1 waiting; Mailpit back → "Run email jobs now" sent it |
| Verification | ✅ Email on register; guest order hidden until confirmed, then visible; banner; resend within a minute refused; link works once; bogus link refused |
| Password reset | ✅ Same answer for unknown email (no mail sent); one mail per minute; form survives being opened twice; mismatch / short refused; reset → login notice; **old device signed out**; old password refused, new one works; link can't be reused |
| Cart + reminders | ✅ Saved/restored with current catalog data (bad lines dropped); reminder to the confirmed user only (not the unconfirmed one); correct items/subtotal/link; no second reminder; identical save keeps the state; a changed cart re-arms it; ordering clears it; skipped when the customer ordered after the cart changed |
| Cron route / 404 | ✅ 404 without the secret or with a wrong one; unknown URL and product → 404 page with the store header |

All test data was deleted afterwards (stock restored: UDM Pro 9, Netgear 6). Counts are back to 24 orders, 3 quotes, 2 coupons and 0 emails/tokens/carts. Customers are 11: the 10 demo customers plus the account you registered yourself during this phase (`admin@nexora.com`), which was left untouched.

**Not testable here:** the real Stripe card flow (needs your test key; its confirmation email is wired to the payment confirmation) and real delivery through Resend (needs a key and a verified domain). Clicking through in a browser also remains for you.
