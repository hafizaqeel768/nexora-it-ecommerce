"use server";

import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getViewer } from "@/lib/viewer";

/** `values` echoes non-secret inputs back, since React clears the form after each submit. */
export type FormState = { error?: string; ok?: string; fields?: Record<string, string>; values?: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (s: unknown, max: number) => String(s ?? "").trim().slice(0, max);

/** Only same-site paths, so ?next= can't send people to another site. */
function safeNext(value: unknown) {
  const next = String(value ?? "");
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/account";
}

// ---------- login / register / logout ----------

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = clean(form.get("email"), 200);
  try {
    await signIn("credentials", {
      email,
      password: String(form.get("password") ?? ""),
      redirectTo: safeNext(form.get("next")),
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Wrong email or password.", values: { email } };
    throw e; // the redirect after a successful login
  }
  return {};
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const name = clean(form.get("name"), 120);
  const email = clean(form.get("email"), 200).toLowerCase();
  const password = String(form.get("password") ?? "");
  const fields: Record<string, string> = {};
  if (!name) fields.name = "Please enter your name.";
  if (!EMAIL.test(email)) fields.email = "Please enter a valid email address.";
  if (password.length < 8) fields.password = "Use at least 8 characters.";
  else if (password.length > 200) fields.password = "Use at most 200 characters.";
  const values = { name, email };
  if (Object.keys(fields).length) return { error: "Please check the highlighted fields.", fields, values };

  const passwordHash = await hashPassword(password);
  const existing = await db.customer.findUnique({ where: { email }, select: { passwordHash: true } });
  if (existing?.passwordHash) {
    return { error: "An account with this email already exists. Please log in.", fields: { email: "Already registered." }, values };
  }
  const account = { name, passwordHash, registeredAt: new Date() };
  if (existing) {
    // Guest checkout record: claim it, but drop the contact details a guest left, since nobody has
    // verified that this person owns the email yet (their earlier orders stay hidden, see viewer.ts).
    const res = await db.customer.updateMany({
      where: { email, passwordHash: null },
      data: { ...account, phone: null, addressLine: null, city: null, state: null, postalCode: null, country: null },
    });
    if (res.count !== 1) return { error: "An account with this email already exists. Please log in.", values };
  } else {
    await db.customer.create({ data: { email, ...account } });
  }

  await signIn("credentials", { email, password, redirectTo: safeNext(form.get("next")) });
  return {};
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}

// ---------- account ----------

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Please log in again." };
  const name = clean(form.get("name"), 120);
  if (!name) return { error: "Please check the highlighted fields.", fields: { name: "Please enter your name." } };
  await db.customer.update({ where: { id: viewer.id }, data: { name, phone: clean(form.get("phone"), 40) || null } });
  revalidatePath("/", "layout");
  return { ok: "Profile updated" };
}

export async function updateAddress(_: FormState, form: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Please log in again." };
  const value = (k: string, max: number) => clean(form.get(k), max) || null;
  await db.customer.update({
    where: { id: viewer.id },
    data: {
      addressLine: value("line", 200),
      city: value("city", 100),
      state: value("state", 100),
      postalCode: value("postalCode", 20),
      country: value("country", 100),
    },
  });
  revalidatePath("/account");
  return { ok: "Address saved" };
}

// ---------- wishlist ----------

export async function toggleWishlist(productId: string): Promise<{ saved: boolean } | { error: "login" | "unavailable" }> {
  const viewer = await getViewer();
  if (!viewer) return { error: "login" };
  const removed = await db.wishlistItem.deleteMany({ where: { customerId: viewer.id, productId } });
  if (removed.count === 0) {
    const product = await db.product.findFirst({ where: { id: productId, status: "ACTIVE" }, select: { id: true } });
    if (!product) return { error: "unavailable" };
    await db.wishlistItem.upsert({
      where: { customerId_productId: { customerId: viewer.id, productId } },
      create: { customerId: viewer.id, productId },
      update: {},
    });
  }
  revalidatePath("/wishlist");
  return { saved: removed.count === 0 };
}
