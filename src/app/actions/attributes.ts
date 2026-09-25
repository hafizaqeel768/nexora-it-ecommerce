"use server";

// Product attributes (Phase 16). The service in src/lib/attributes.ts checks permissions again and validates.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AdminFormState } from "@/app/actions/admin";
import { assertAdmin } from "@/lib/admin";
import * as attributes from "@/lib/attributes";

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").slice(0, max);
const state = (r: attributes.Result): AdminFormState => ({ ok: r.ok, error: r.error, fields: r.fields });

export async function saveAttribute(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const id = text(form, "id", 40) || null;
  const admin = await assertAdmin(id ? "attributes.edit" : "attributes.create");
  const r = await attributes.saveAttribute(admin, id, {
    code: text(form, "code", 60),
    name: text(form, "name", 120),
    type: text(form, "type", 20),
    required: form.get("required") === "on",
    defaultValue: text(form, "defaultValue", 2100),
    unit: text(form, "unit", 40),
    active: form.get("active") === "on",
    sortOrder: text(form, "sortOrder", 12),
    description: text(form, "description", 600),
    showOnProduct: form.get("showOnProduct") === "on",
  });
  if (r.error) return state(r);
  revalidatePath("/admin/attributes");
  if (!id) redirect(`/admin/attributes/${r.id}?created=1`);
  revalidatePath(`/admin/attributes/${id}`);
  return state(r);
}

export async function saveAttributeOptions(attributeId: string, _: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await assertAdmin("attributes.edit");
  const ids = form.getAll("o.id").map(String);
  const labels = form.getAll("o.label").map((v) => String(v).slice(0, 200));
  const active = form.getAll("o.active").map(String);
  const defaults = form.getAll("o.default").map(String);
  if (labels.length > attributes.MAX_OPTIONS + 1 || ids.length !== labels.length || active.length !== labels.length || defaults.length !== labels.length) {
    return { error: "The option list could not be read; please reload." };
  }
  const r = await attributes.saveOptions(
    admin,
    attributeId,
    labels.map((label, i) => ({ id: ids[i], label, active: active[i] === "1", isDefault: defaults[i] === "1" })),
  );
  if (r.ok) revalidatePath(`/admin/attributes/${attributeId}`);
  return state(r);
}

export async function toggleAttribute(id: string, active: boolean) {
  const admin = await assertAdmin("attributes.edit");
  await attributes.setAttributeActive(admin, id, active);
  revalidatePath("/admin/attributes");
  revalidatePath(`/admin/attributes/${id}`);
}

export async function deleteAttribute(id: string, _: AdminFormState): Promise<AdminFormState> {
  void _;
  const admin = await assertAdmin("attributes.delete");
  const r = await attributes.deleteAttribute(admin, id);
  if (r.error) return state(r);
  revalidatePath("/admin/attributes");
  redirect(`/admin/attributes?done=${encodeURIComponent(r.ok ?? "")}`);
}
