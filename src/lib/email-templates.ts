// Email content (server-only): simple table-based HTML that survives email clients, plus a plain-text part.
import { APP_URL, type Mail } from "@/lib/email";
import { money, statusLabel } from "@/lib/format";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden">
<tr><td style="background:#111;padding:18px 24px;font-size:22px;font-weight:900;letter-spacing:-1px;color:#fff">NEXORA<span style="color:#d21f2b">.IT</span></td></tr>
<tr><td style="padding:26px 24px;font-size:15px;line-height:1.55">${body}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #eee;font-size:12px;color:#777">Nexora IT · Business-grade IT hardware · <a href="${APP_URL}" style="color:#777">${esc(APP_URL.replace(/^https?:\/\//, ""))}</a></td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:22px 0"><a href="${esc(href)}" style="display:inline-block;background:#d21f2b;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">${esc(label)}</a></p>`;

type OrderForEmail = {
  id: string;
  number: string;
  name: string;
  status: string;
  paymentMethod: "CREDIT_CARD" | "PURCHASE_ORDER" | "BANK_TRANSFER";
  paymentStatus: string;
  subtotal: { toString(): string };
  discount: { toString(): string };
  shippingFee: { toString(): string };
  tax: { toString(): string };
  total: { toString(): string };
  items: { name: string; quantity: number; lineTotal: { toString(): string } }[];
};

function itemsTable(o: OrderForEmail) {
  const rows = o.items
    .map((i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0">${esc(i.name)} × ${i.quantity}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #f0f0f0;white-space:nowrap">${money(i.lineTotal)}</td></tr>`)
    .join("");
  const line = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:4px 0;color:${bold ? "#111" : "#666"};${bold ? "font-weight:bold;font-size:16px" : ""}">${label}</td><td align="right" style="padding:4px 0;${bold ? "font-weight:bold;font-size:16px" : "color:#666"}">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}
${line("Subtotal", money(o.subtotal))}${Number(o.discount.toString()) ? line("Discount", `−${money(o.discount)}`) : ""}${line("Shipping", Number(o.shippingFee.toString()) ? money(o.shippingFee) : "Free")}${line("Tax", money(o.tax))}${line("Total", money(o.total), true)}</table>`;
}

const itemsText = (o: OrderForEmail) =>
  o.items.map((i) => `- ${i.name} × ${i.quantity}: ${money(i.lineTotal)}`).join("\n") + `\nTotal: ${money(o.total)}`;

const paymentNote = (o: OrderForEmail) =>
  o.paymentStatus === "PAID"
    ? "Payment received, thank you."
    : o.paymentMethod === "PURCHASE_ORDER"
      ? "We'll send an invoice against your purchase order."
      : o.paymentMethod === "BANK_TRANSFER"
        ? "We'll email bank transfer details; the order ships once payment arrives."
        : "We're waiting for your card payment.";

const STATUS_TEXT: Record<string, string> = {
  PENDING: "Your order is pending and will be processed shortly.",
  PROCESSING: "We're preparing your order.",
  SHIPPED: "Good news: your order is on its way.",
  DELIVERED: "Your order has been delivered. We hope everything works perfectly.",
  CANCELLED: "Your order has been cancelled. If you already paid, we'll refund you. Reply to this email with any questions.",
};

export function orderConfirmationEmail(o: OrderForEmail, to: string): Mail {
  const link = `${APP_URL}/order/${o.id}`;
  const first = o.name.split(" ")[0];
  return {
    to,
    subject: `Order ${o.number} received`,
    html: layout(`Order ${o.number}`, `<h1 style="margin:0 0 12px;font-size:22px">Thank you, ${esc(first)}!</h1>
<p>We've received your order <b>${esc(o.number)}</b>. ${esc(paymentNote(o))}</p>${itemsTable(o)}${button(link, "View your order")}`),
    text: `Thank you, ${first}!\n\nWe've received your order ${o.number}. ${paymentNote(o)}\n\n${itemsText(o)}\n\nView your order: ${link}`,
  };
}

export function orderStatusEmail(o: OrderForEmail, status: string, to: string): Mail {
  const link = `${APP_URL}/order/${o.id}`;
  const label = statusLabel(status);
  return {
    to,
    subject: `Order ${o.number}: ${label}`,
    html: layout(`Order ${o.number}: ${label}`, `<h1 style="margin:0 0 12px;font-size:22px">Order ${esc(o.number)} · ${esc(label)}</h1>
<p>${esc(STATUS_TEXT[status] ?? `Your order status is now ${label}.`)}</p>${itemsTable(o)}${button(link, "View your order")}`),
    text: `Order ${o.number}: ${label}\n\n${STATUS_TEXT[status] ?? ""}\n\n${itemsText(o)}\n\nView your order: ${link}`,
  };
}

export function verifyEmail(name: string, to: string, link: string): Mail {
  return {
    to,
    subject: "Confirm your email address",
    html: layout("Confirm your email", `<h1 style="margin:0 0 12px;font-size:22px">Welcome, ${esc(name.split(" ")[0])}!</h1>
<p>Please confirm that this is your email address. Confirmed accounts also see earlier orders placed with this email.</p>${button(link, "Confirm email")}
<p style="font-size:13px;color:#666">The link works for 24 hours. If you didn't create an account, you can ignore this email.</p>`),
    text: `Welcome!\n\nPlease confirm your email address (the link works for 24 hours):\n${link}\n\nIf you didn't create an account, you can ignore this email.`,
  };
}

export function resetPasswordEmail(name: string, to: string, link: string): Mail {
  return {
    to,
    subject: "Reset your password",
    html: layout("Reset your password", `<h1 style="margin:0 0 12px;font-size:22px">Reset your password</h1>
<p>Hi ${esc(name.split(" ")[0])}, someone (hopefully you) asked to reset the password for this account.</p>${button(link, "Choose a new password")}
<p style="font-size:13px;color:#666">The link works for 1 hour and only once. If you didn't ask for this, ignore this email; your password stays the same.</p>`),
    text: `Reset your password\n\nChoose a new password (the link works for 1 hour, once):\n${link}\n\nIf you didn't ask for this, ignore this email.`,
  };
}

export function abandonedCartEmail(name: string, to: string, lines: { name: string; quantity: number; price: number }[], total: number): Mail {
  const link = `${APP_URL}/cart`;
  const rows = lines
    .map((l) => `<tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0">${esc(l.name)} × ${l.quantity}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #f0f0f0">${money(l.price * l.quantity)}</td></tr>`)
    .join("");
  return {
    to,
    subject: "You left something in your cart",
    html: layout("Your cart is waiting", `<h1 style="margin:0 0 12px;font-size:22px">Still thinking it over, ${esc(name.split(" ")[0])}?</h1>
<p>Your cart is saved. Pick up where you left off:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}
<tr><td style="padding:8px 0;font-weight:bold">Subtotal</td><td align="right" style="padding:8px 0;font-weight:bold">${money(total)}</td></tr></table>${button(link, "Resume checkout")}
<p style="font-size:13px;color:#666">Prices and stock are checked again at checkout. Log in on any device to get your cart back.</p>`),
    text: `Your cart is waiting.\n\n${lines.map((l) => `- ${l.name} × ${l.quantity}: ${money(l.price * l.quantity)}`).join("\n")}\nSubtotal: ${money(total)}\n\nResume checkout: ${link}`,
  };
}
