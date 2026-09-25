// Orders for Data Transfer (Phase 15): export only, one row per order with its items in one column.
//
// Order import is deliberately not offered. An order ties together a customer, product snapshots, stock
// reservations, payment state (Stripe sessions, refunds), shipping and tax totals, status history and emails.
// Importing rows would either skip those rules (wrong stock, totals that don't add up, "paid" orders without a
// payment) or have to re-run checkout for every row. Orders are created by checkout or by converting a quote.
import { OrderStatus, PaymentStatus, type Prisma } from "@/generated/prisma/client";
import { parseDay } from "@/lib/data-transfer/entities/customers";
import type { ExportAdapter } from "@/lib/data-transfer/types";
import { db } from "@/lib/db";

type Filters = { number: string; status: OrderStatus | null; payment: PaymentStatus | null; customer: string; from: Date | null; to: Date | null };

const paymentLabel = { CREDIT_CARD: "Credit card", PURCHASE_ORDER: "Purchase order", BANK_TRANSFER: "Bank transfer" } as const;

const where = (f: Filters): Prisma.OrderWhereInput => ({
  ...(f.number ? { number: { contains: f.number, mode: "insensitive" } } : {}),
  ...(f.status ? { status: f.status } : {}),
  ...(f.payment ? { paymentStatus: f.payment } : {}),
  ...(f.customer ? { OR: [{ email: { contains: f.customer, mode: "insensitive" } }, { name: { contains: f.customer, mode: "insensitive" } }] } : {}),
  ...(f.from || f.to ? { createdAt: { ...(f.from && { gte: f.from }), ...(f.to && { lt: f.to }) } } : {}),
});

const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

export const orderExport: ExportAdapter<Filters> = {
  entity: "orders",
  label: "Orders",
  permission: "orders.export",
  filters: [
    { key: "number", label: "Order number contains", type: "text", placeholder: "NX-…" },
    { key: "status", label: "Status", type: "choice", options: [{ value: "", label: "Any" }, ...Object.values(OrderStatus).map((s) => ({ value: s, label: title(s) }))] },
    { key: "payment", label: "Payment", type: "choice", options: [{ value: "", label: "Any" }, ...Object.values(PaymentStatus).map((s) => ({ value: s, label: title(s) }))] },
    { key: "customer", label: "Customer (name or email)", type: "text" },
    { key: "from", label: "Placed from", type: "date" },
    { key: "to", label: "Placed to", type: "date" },
  ],
  async parseFilters(p) {
    const errors: string[] = [];
    const status = p.get("status") ?? "";
    const payment = p.get("payment") ?? "";
    if (status && !(Object.values(OrderStatus) as string[]).includes(status)) errors.push("Unknown order status.");
    if (payment && !(Object.values(PaymentStatus) as string[]).includes(payment)) errors.push("Unknown payment status.");
    const filters: Filters = {
      number: (p.get("number") ?? "").trim().slice(0, 40),
      status: (Object.values(OrderStatus) as string[]).includes(status) ? (status as OrderStatus) : null,
      payment: (Object.values(PaymentStatus) as string[]).includes(payment) ? (payment as PaymentStatus) : null,
      customer: (p.get("customer") ?? "").trim().slice(0, 200),
      from: parseDay(p.get("from"), "From", errors),
      to: parseDay(p.get("to"), "To", errors, true),
    };
    if (filters.from && filters.to && filters.from >= filters.to) errors.push("“From” is after “To”.");
    return { filters, errors };
  },
  count: (f) => db.order.count({ where: where(f) }),
  headers: [
    "Order",
    "Date",
    "Status",
    "Customer",
    "Email",
    "Phone",
    "Payment",
    "Payment status",
    "Items",
    "Item count",
    "Subtotal",
    "Discount",
    "Coupon",
    "Shipping",
    "Shipping method",
    "Tax",
    "Total",
    "Refunded",
    "Address",
    "City",
    "State",
    "ZIP",
    "Country",
    "Tracking carrier",
    "Tracking number",
  ],
  async page(f, cursor, take) {
    const rows = await db.order.findMany({
      where: where(f),
      orderBy: { id: "asc" },
      take,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: { items: { orderBy: { id: "asc" }, select: { name: true, sku: true, quantity: true, unitPrice: true } } },
    });
    return {
      last: rows.at(-1)?.id ?? null,
      rows: rows.map((o) => [
        o.number,
        o.createdAt.toISOString().replace("T", " ").slice(0, 16),
        o.status.toLowerCase(),
        o.name,
        o.email,
        o.phone,
        paymentLabel[o.paymentMethod],
        o.paymentStatus.toLowerCase().replace(/_/g, " "),
        o.items.map((i) => `${i.quantity} × ${i.name}${i.sku ? ` (${i.sku})` : ""} @ ${i.unitPrice.toString()}`).join("; "),
        o.items.reduce((s, i) => s + i.quantity, 0),
        o.subtotal.toString(),
        o.discount.toString(),
        o.couponCode,
        o.shippingFee.toString(),
        o.shippingMethod,
        o.tax.toString(),
        o.total.toString(),
        o.refundedTotal.toString(),
        o.addressLine,
        o.city,
        o.state,
        o.postalCode,
        o.country,
        o.trackingCarrier,
        o.trackingNumber,
      ]),
    };
  },
};
