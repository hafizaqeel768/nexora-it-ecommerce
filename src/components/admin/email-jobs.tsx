"use client";

import { useActionState } from "react";
import { runEmailJobsNow, type AdminFormState } from "@/app/actions/admin";
import { FormMessage } from "@/components/account/field";
import { textButton } from "@/components/admin/ui";

export function RunEmailJobsButton() {
  const [state, action, pending] = useActionState<AdminFormState>(runEmailJobsNow, {});
  return (
    <form action={action} className="grid gap-2">
      <button type="submit" disabled={pending} className={`${textButton} justify-self-start`}>
        {pending ? "Running…" : "Run email jobs now"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
