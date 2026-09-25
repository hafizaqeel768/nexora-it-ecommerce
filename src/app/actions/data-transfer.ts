"use server";

// Data Transfer → Import (Phase 15). The job service (src/lib/data-transfer/jobs.ts) checks import.access and the
// entity's import permission again for every step.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AdminFormState } from "@/app/actions/admin";
import { assertAdmin } from "@/lib/admin";
import { readUpload } from "@/lib/data-transfer/import-engine";
import { cancelJob, commitJob, createJob } from "@/lib/data-transfer/jobs";

/** Step 1: check the file and every row; nothing is imported. Opens the preview. */
export async function validateImport(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await assertAdmin("import.access");
  const file = await readUpload(form.get("file"));
  if ("error" in file) return { error: file.error, fields: { file: file.error } };
  const job = await createJob(admin, {
    entity: String(form.get("entity") ?? ""),
    behavior: String(form.get("behavior") ?? ""),
    onError: String(form.get("onError") ?? ""),
    file,
  });
  if ("error" in job) return { error: job.error };
  redirect(`/admin/data-transfer/import/${job.id}`);
}

/** Step 2: the admin confirmed the preview. */
export async function confirmImport(id: string, _: AdminFormState): Promise<AdminFormState> {
  void _;
  const admin = await assertAdmin("import.access");
  const r = await commitJob(admin, id);
  if ("error" in r) return { error: r.error };
  revalidatePath("/", "layout");
  redirect(`/admin/data-transfer/import/${id}`);
}

export async function cancelImport(id: string, _: AdminFormState): Promise<AdminFormState> {
  void _;
  const admin = await assertAdmin("import.access");
  if (!(await cancelJob(admin, id))) return { error: "This import can't be cancelled any more." };
  redirect("/admin/data-transfer/import");
}
