"use server";

// Customer details (Phase 13): contact data, saved address and the private staff note.
import { revalidatePath } from "next/cache";
import type { AdminFormState } from "@/app/actions/admin";
import { assertAdmin } from "@/lib/admin";
import { countryName, isCountryCode } from "@/lib/countries";
import { db } from "@/lib/db";

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

export async function updateCustomer(customerId: string, _: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const name = text(form, "name", 120);
  if (!name) return { error: "Name is required.", fields: { name: "Name is required." } };
  const code = text(form, "country", 2).toUpperCase();
  const res = await db.customer.updateMany({
    where: { id: customerId },
    data: {
      name,
      phone: text(form, "phone", 40) || null,
      addressLine: text(form, "line", 200) || null,
      city: text(form, "city", 100) || null,
      state: text(form, "state", 100) || null,
      postalCode: text(form, "postalCode", 20) || null,
      country: code && isCountryCode(code) ? countryName(code) : null,
      adminNote: text(form, "adminNote", 4000) || null,
    },
  });
  if (res.count !== 1) return { error: "Customer not found." };
  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
  return { ok: "Customer saved." };
}
