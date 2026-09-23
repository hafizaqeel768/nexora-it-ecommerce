// Email content (server-only): simple table-based HTML that survives email clients, plus a plain-text part.
// Branding comes from Settings → Store details; subjects and intro texts from Settings → Email.
import { getConfig } from "@/lib/config";
import { fillTemplate, type EmailTemplateKey, type StoreDetails } from "@/lib/config-shared";
import { APP_URL, type Mail } from "@/lib/email";
import { money, statusLabel } from "@/lib/format";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(store: StoreDetails, title: string, body: string) {
  const logo = store.logoUrl
    ? `<img src="${esc(APP_URL + store.logoUrl)}" alt="${esc(store.name)}" height="36" style="display:block;height:36px;border:0">`
    : `${esc(store.logoText)}<span style="color:#d21f2b">${esc(store.logoAccent)}</span>`;
  const contact = [store.supportEmail, store.phone].filter(Boolean).map(esc).join(" · ");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden">
<tr><td style="background:#111;padding:18px 24px;font-size:22px;font-weight:900;letter-spacing:-1px;color:#fff">${logo}</td></tr>
<tr><td style="padding:26px 24px;font-size:15px;line-height:1.55">${body}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #eee;font-size:12px;color:#777">${esc(store.name)}${store.tagline ? ` · ${esc(store.tagline)}` : ""}${contact ? `<br>${contact}` : ""}<br><a href="${APP_URL}" style="color:#777">${esc(APP_URL.replace(/^https?:\/\//, ""))}</a></td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:22px 0"><a href="${esc(href)}" style="display:inline-block;background:#d21f2b;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">${esc(label)}</a></p>`;

/** Store details + the chosen template with placeholders filled in. */
async function prepare(key: EmailTemplateKey, values: Record<string, string>) {
  const [store, email] = await Promise.all([getConfig("store"), getConfig("email")]);
  const all = { store: store.name, ...values };
  const t = email.templates[key];
  return { store, subject: fillTemplate(t.subject, all), intro: fillTemplate(t.intro, all) };
}

const para = (text: string) => (text ? `<p>${esc(text).replace(/\n/g, "<br>")}</p>` : "");

type OrderForEmail = {
  id: string;
  number: string;
  name: string;
  status: string;
  paymentMethod: "CREDIT_CARD" | "PURCHASE_ORDER" | "BANK_TRANSFER";
  paymentStatus: string;
  shippingMethod: string | null;
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
  const shipping = o.shippingMethod ? `Shipping (${esc(o.shippingMethod)})` : "Shipping";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}
${line("Subtotal", money(o.subtotal))}${Number(o.discount.toString()) ? line("Discount", `−${money(o.discount)}`) : ""}${line(shipping, Number(o.shippingFee.toString()) ? money(o.shippingFee) : "Free")}${line("Tax", money(o.tax))}${line("Total", money(o.total), true)}</table>`;
}

const itemsText = (o: OrderForEmail) =>
  o.items.map((i) => `- ${i.name} × ${i.quantity}: ${money(i.lineTotal)}`).join("\n") + `\nTotal: ${money(o.total)}`;

const paymentKey = { CREDIT_CARD: "card", PURCHASE_ORDER: "purchaseOrder", BANK_TRANSFER: "bankTransfer" } as const;

async function paymentNote(o: OrderForEmail) {
  if (o.paymentStatus === "PAID") return "Payment received, thank you.";
  if (o.paymentMethod === "CREDIT_CARD") return "We're waiting for your card payment.";
  return (await getConfig("payments"))[paymentKey[o.paymentMethod]].instructions;
}

const STATUS_TEXT: Record<string, string> = {
  PENDING: "Your order is pending and will be processed shortly.",
  PROCESSING: "We're preparing your order.",
  SHIPPED: "Good news: your order is on its way.",
  DELIVERED: "Your order has been delivered. We hope everything works perfectly.",
  CANCELLED: "Your order has been cancelled. If you already paid, we'll refund you. Reply to this email with any questions.",
};

const first = (name: string) => name.split(" ")[0];

export async function orderConfirmationEmail(o: OrderForEmail, to: string): Promise<Mail> {
  const link = `${APP_URL}/order/${o.id}`;
  const { store, subject, intro } = await prepare("orderConfirmation", { name: first(o.name), order: o.number });
  const note = await paymentNote(o);
  return {
    to,
    subject,
    html: layout(store, subject, `${para(intro)}${para(note)}${itemsTable(o)}${button(link, "View your order")}`),
    text: `${intro}\n\n${note}\n\n${itemsText(o)}\n\nView your order: ${link}`,
  };
}

export async function orderStatusEmail(o: OrderForEmail, status: string, to: string): Promise<Mail> {
  const link = `${APP_URL}/order/${o.id}`;
  const label = statusLabel(status);
  const p = await prepare("orderStatus", { name: first(o.name), order: o.number, status: label });
  const intro = p.intro || STATUS_TEXT[status] || `Your order status is now ${label}.`;
  return {
    to,
    subject: p.subject,
    html: layout(p.store, p.subject, `<h1 style="margin:0 0 12px;font-size:22px">Order ${esc(o.number)} · ${esc(label)}</h1>${para(intro)}${itemsTable(o)}${button(link, "View your order")}`),
    text: `Order ${o.number}: ${label}\n\n${intro}\n\n${itemsText(o)}\n\nView your order: ${link}`,
  };
}

export async function verifyEmail(name: string, to: string, link: string): Promise<Mail> {
  const { store, subject, intro } = await prepare("verifyEmail", { name: first(name) });
  return {
    to,
    subject,
    html: layout(store, subject, `${para(intro)}${button(link, "Confirm email")}
<p style="font-size:13px;color:#666">The link works for 24 hours. If you didn't create an account, you can ignore this email.</p>`),
    text: `${intro}\n\nConfirm your email address (the link works for 24 hours):\n${link}\n\nIf you didn't create an account, you can ignore this email.`,
  };
}

export async function resetPasswordEmail(name: string, to: string, link: string): Promise<Mail> {
  const { store, subject, intro } = await prepare("resetPassword", { name: first(name) });
  return {
    to,
    subject,
    html: layout(store, subject, `${para(intro)}${button(link, "Choose a new password")}
<p style="font-size:13px;color:#666">The link works for 1 hour and only once. If you didn't ask for this, ignore this email; your password stays the same.</p>`),
    text: `${intro}\n\nChoose a new password (the link works for 1 hour, once):\n${link}\n\nIf you didn't ask for this, ignore this email.`,
  };
}

export async function abandonedCartEmail(name: string, to: string, lines: { name: string; quantity: number; price: number }[], total: number): Promise<Mail> {
  const link = `${APP_URL}/cart`;
  const { store, subject, intro } = await prepare("cartReminder", { name: first(name) });
  const rows = lines
    .map((l) => `<tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0">${esc(l.name)} × ${l.quantity}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #f0f0f0">${money(l.price * l.quantity)}</td></tr>`)
    .join("");
  return {
    to,
    subject,
    html: layout(store, subject, `${para(intro)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}
<tr><td style="padding:8px 0;font-weight:bold">Subtotal</td><td align="right" style="padding:8px 0;font-weight:bold">${money(total)}</td></tr></table>${button(link, "Resume checkout")}
<p style="font-size:13px;color:#666">Prices and stock are checked again at checkout. Log in on any device to get your cart back.</p>`),
    text: `${intro}\n\n${lines.map((l) => `- ${l.name} × ${l.quantity}: ${money(l.price * l.quantity)}`).join("\n")}\nSubtotal: ${money(total)}\n\nResume checkout: ${link}`,
  };
}

/** Admin "Send test email": the chosen template with sample values, to check wording and sender. */
export async function testEmail(key: EmailTemplateKey, to: string): Promise<Mail> {
  const sample = { name: "Alex", order: "NX-123456", status: "Shipped" };
  const { store, subject, intro } = await prepare(key, sample);
  const body = key === "orderStatus" && !intro ? STATUS_TEXT.SHIPPED : intro;
  return {
    to,
    subject: `[Test] ${subject}`,
    html: layout(store, subject, `<p style="font-size:12px;color:#999">Test email with sample values.</p>${para(body)}`),
    text: `Test email with sample values.\n\n${body}`,
  };
}
