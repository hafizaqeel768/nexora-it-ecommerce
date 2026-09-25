"use server";

// Admin users and roles (Phase 14). Each action checks the permission it needs, then the service in
// src/lib/admin-users.ts checks it again together with the escalation rules and writes the audit log.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AdminFormState } from "@/app/actions/admin";
import { assertAdmin } from "@/lib/admin";
import * as staff from "@/lib/admin-users";

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

function refresh(...paths: string[]) {
  revalidatePath("/admin", "layout");
  for (const p of paths) revalidatePath(p);
}

const state = (r: staff.Result): AdminFormState => ({ ok: r.ok, error: r.error, fields: r.fields });

// ---------- admin users ----------

export async function createAdminUser(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await assertAdmin("admin_users.create");
  const r = await staff.createAdminUser(admin, {
    name: text(form, "name", 120),
    email: text(form, "email", 200),
    password: String(form.get("password") ?? ""),
    roleId: text(form, "roleId", 40),
    active: form.get("active") === "on",
    superAdmin: form.get("superAdmin") === "on",
  });
  if (!r.id) return state(r);
  refresh("/admin/users");
  redirect(`/admin/users/${r.id}?created=1`);
}

export async function updateAdminUser(id: string, _: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await assertAdmin("admin_users.edit");
  const r = await staff.updateAdminUser(admin, id, { name: text(form, "name", 120), email: text(form, "email", 200), roleId: text(form, "roleId", 40) });
  if (r.ok) refresh("/admin/users", `/admin/users/${id}`);
  return state(r);
}

export async function resetAdminPassword(id: string, _: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await assertAdmin("admin_users.edit");
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) return { error: "The passwords don't match.", fields: { confirm: "Doesn't match." } };
  const r = await staff.resetAdminPassword(admin, id, password);
  if (r.ok) refresh(`/admin/users/${id}`);
  return state(r);
}

export async function setAdminActive(id: string, active: boolean, _: AdminFormState): Promise<AdminFormState> {
  void _;
  const admin = await assertAdmin("admin_users.disable");
  const r = await staff.setAdminActive(admin, id, active);
  if (r.ok) refresh("/admin/users", `/admin/users/${id}`);
  return state(r);
}

export async function setSuperAdmin(id: string, on: boolean, _: AdminFormState): Promise<AdminFormState> {
  void _;
  const admin = await assertAdmin();
  const r = await staff.setSuperAdmin(admin, id, on);
  if (r.ok) refresh("/admin/users", `/admin/users/${id}`);
  return state(r);
}

export async function deleteAdminUser(id: string, _: AdminFormState): Promise<AdminFormState> {
  void _;
  const admin = await assertAdmin("admin_users.delete");
  const r = await staff.deleteAdminUser(admin, id);
  if (r.error) return state(r);
  refresh("/admin/users", "/admin/customers");
  redirect(`/admin/users?done=${encodeURIComponent(r.ok ?? "")}`);
}

// ---------- roles ----------

export async function saveRole(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const id = text(form, "id", 40) || null;
  const admin = await assertAdmin(id ? "roles.edit" : "roles.create");
  const r = await staff.saveRole(admin, id, {
    name: text(form, "name", 60),
    description: text(form, "description", 300),
    permissions: form.getAll("permissions").map(String),
  });
  if (!r.ok) return state(r);
  refresh("/admin/roles", "/admin/users");
  if (!id) redirect(`/admin/roles/${r.id}?created=1`);
  return state(r);
}

export async function deleteRole(id: string, _: AdminFormState): Promise<AdminFormState> {
  void _;
  const admin = await assertAdmin("roles.delete");
  const r = await staff.deleteRole(admin, id);
  if (r.error) return state(r);
  refresh("/admin/roles");
  redirect(`/admin/roles?done=${encodeURIComponent(r.ok ?? "")}`);
}
