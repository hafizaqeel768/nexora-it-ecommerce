"use server";

import { randomInt } from "node:crypto";
import { db } from "@/lib/db";

export type QuoteState =
  | { status: "idle" }
  | { status: "error"; message: string; fields: Record<string, string>; values: Record<string, string> }
  | { status: "ok"; number: string; firstName: string };

const text = (form: FormData, key: string, max: number) =>
  String(form.get(key) ?? "")
    .trim()
    .slice(0, max);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Home page "Request a quote" form → Quote row (status NEW), like the prototype's a_addQuote().
export async function requestQuote(_prev: QuoteState, form: FormData): Promise<QuoteState> {
  const values = {
    name: text(form, "name", 120),
    company: text(form, "company", 160),
    email: text(form, "email", 200),
    phone: text(form, "phone", 40),
    category: text(form, "category", 60),
    quantity: text(form, "quantity", 10),
    message: text(form, "message", 2000),
  };

  const fields: Record<string, string> = {};
  if (!values.name) fields.name = "Please enter your name.";
  if (!EMAIL.test(values.email)) fields.email = "Please enter a valid email address.";
  const qty = Number(values.quantity || "1");
  if (!Number.isInteger(qty) || qty < 1 || qty > 100000) fields.quantity = "Quantity must be a whole number from 1.";
  // values go back to the form: React resets uncontrolled fields after an action, this keeps the input.
  if (Object.keys(fields).length) return { status: "error", message: "Please check the highlighted fields.", fields, values };

  const category = values.category
    ? await db.category.findFirst({ where: { slug: values.category, parentId: null }, select: { id: true } })
    : null;

  // QT-xxxxx like the prototype; retry on the rare number collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const number = `QT-${randomInt(10000, 100000)}`;
    if (await db.quote.findUnique({ where: { number }, select: { id: true } })) continue;
    await db.quote.create({
      data: {
        number,
        name: values.name,
        company: values.company || null,
        email: values.email,
        phone: values.phone || null,
        categoryId: category?.id ?? null,
        quantity: String(qty),
        message: values.message || "(no details given)",
      },
    });
    return { status: "ok", number, firstName: values.name.split(" ")[0] };
  }
  return { status: "error", message: "Could not submit right now, please try again.", fields: {}, values };
}
