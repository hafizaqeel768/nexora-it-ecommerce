# Phase 13 — Order & Customer Operations

Date: 2026-09-24 · Store-management roadmap, phase 3 of 7 (see PROJECT-PLAN.md).

## What you can do now

Everything below is on **Admin → Orders → an order**, unless noted.

| Feature | What works |
|---|---|
| **Edit items** | On open (pending/processing), **unpaid purchase-order or bank-transfer** orders: change names, SKUs, unit prices and quantities, remove lines, **add catalog products** (search by name or SKU) or **custom lines** (e.g. installation), and set shipping, discount, tax rate and "tax also on shipping". A live preview shows the total; the server works it out again. Stock follows the changes for tracked products (the save is refused if there isn't enough). This is how you price an order that was **converted from a quote**. Card orders can't be edited, because Stripe already charged the original amount. |
| **Edit customer & address** | Name, email, phone and shipping address, until the order ships. Shipping and tax are **not** recalculated; adjust them in *Edit items* if needed. |
| **Tracking** | Carrier (UPS, FedEx, USPS, DHL, other) and tracking number. You can enter them together with the status change to **Shipped**, so the **Shipped email includes the number and a "Track your package" button**. You can change them later (optionally re-sending the Shipped email) or remove them. Customers see tracking on their order page and in *My Account*. |
| **Refunds** | For paid orders: any amount up to what's left, with a reason. **Card** orders are refunded **through Stripe** (only recorded once Stripe accepts it). **PO / bank transfer** refunds are recorded as paid back by hand. Options: *also cancel the order and put the items back in stock*, and *email the customer* (new **Refund** email; subject and intro can be edited in Settings → Email). Payment status becomes **Partially refunded** or **Refunded**. Revenue on the dashboard and customer "spent" figures subtract refunds. |
| **Invoice** | `/print/invoice/<order id>`: store details and logo, bill-to and ship-to, lines, totals, refunds and net paid, and payment instructions while unpaid. **Print / Save as PDF** button. Customers get an *Invoice* button on their order page; like that page, the private order id is the key. |
| **Packing slip** | `/print/packing-slip/<order id>` (**staff only**): ship-to, a checkbox per line, SKUs and quantities, **no prices**, tracking, and the customer's note. |
| **Activity & internal notes** | A timeline on every order. **Notes** are written by staff and never shown to customers. **Events** are recorded automatically for status changes (with tracking), marked paid, item edits (old → new total), address changes, tracking changes, refunds and "created from quote". |
| **Customer detail** (Admin → Customers → name) | Badges (registered/guest, email confirmed, tax-exempt, admin); totals: orders, spent (excluding cancelled orders and refunds), average order, customer since; all orders, **including guest orders placed with the same email**; quotes; reviews; wishlist and saved-cart summary. You can edit name, phone and saved address, write a **private staff note**, and switch tax exemption. Order pages link to the customer. |

## Database (migration `order_operations`)

- `Order.trackingCarrier`, `Order.trackingNumber`, `Order.refundedTotal`
- `Refund` (amount, reason, method STRIPE/MANUAL, Stripe refund id, restocked, created by)
- `OrderNote` (kind NOTE/EVENT, body, author): the activity timeline
- `Customer.adminNote`
- `PaymentStatus.PARTIALLY_REFUNDED`, `OrderEmailKind.REFUND` (+ `OrderEmail.refundId`)
- Email template `refund` (placeholders `{name} {order} {amount} {store}`)

Existing orders are unchanged (refunded total 0, no tracking, empty timeline).

## Checks

Run against the live container with a temporary admin and customer, 3 draft products (`P13-A/B/C`) and 4 orders (`P13-00000x`), all owned by the test. Tables were backed up first. **Afterwards all counts matched the "before" snapshot:** 311 products (stock sum 280), 25 orders ($55,562.59), 49 order items, 12 customers, 3 quotes, 1 order email, 0 notes, 0 refunds. Test emails were removed from Mailpit. **69 of 69 checks passed.**

| Area | Result |
|---|---|
| Access | Admin pages 200. A customer is sent to "No access" for admin order pages and the packing slip; a guest is sent to login. A customer calling note/refund/customer/search actions is rejected. The invoice opens by order id; an unknown id gives 404 |
| Notes | Empty note refused; note saved with the author; never on the customer's page |
| Edit items | Empty order, negative price, fractional quantity, too-large discount, another order's line id and not enough stock are all refused (stock unchanged). A real edit (qty 2→4 at $90, line removed, catalog product and custom line added, shipping $30, discount $10, 8.25 % incl. shipping) gives **$573.73**. Stock moved A 7→5, B 3→4, untracked C untouched. Logged as "total $295.00 → $573.73". Admin page and invoice show it. Paid and card orders refused |
| Address | Validation; saved with the country code/name and the state normalised (Texas → TX); locked once shipped |
| Tracking | Bad carrier refused; Shipped + UPS number stored, **Shipped email contains the number and the UPS link**, event logged; order page and account show it; re-save with FedEx sends a second Shipped email (number URL-encoded); remove works; "Other carrier" shows the number without a button |
| Refunds | Unpaid, $0 and more than the total refused; $40.50 partial → *Partially refunded* + refund email (amount, reason, wording); second refund capped at $67.50; rest + cancel → *Refunded*, *Cancelled*, stock +1; 2 refund rows; no email when unticked; nothing more once fully refunded; invoice shows refunds and net paid; card refund without Stripe keys → a clear "Stripe is not set up" message, nothing recorded |
| Customer | 4 orders including a guest order with a differently-cased email, spent $731.73; name required; saved address and note; customer can't call it; note not visible to the customer; list links to the detail page; product search by SKU flags drafts |
| Build | `tsc` and `eslint` clean; production build (separate folder) OK. The dev server kept running |

**Not tested live:** a real Stripe refund. This server has no Stripe keys (`STRIPE_SECRET_KEY` is not in `.env`), so only the "not set up" path could run. The Stripe call uses the checkout session's payment intent and an idempotency key. Test it once with test keys before going live.

**Not in this phase:** credit notes/invoice numbering separate from order numbers, printing several orders at once, returns (RMA) workflow, and carrier label printing.
