"use client";

import { useActionState } from "react";
import type { AdminFormState } from "@/app/actions/admin";
import { FormMessage } from "@/components/account/field";
import { primaryButton, select } from "@/components/admin/ui";
import { statusLabel } from "@/lib/format";

// Status select + update button (the prototype's order/quote modal footer).
export function StatusForm({
  action,
  current,
  options,
  submitLabel,
  note,
  children,
}: {
  action: (state: AdminFormState, form: FormData) => Promise<AdminFormState>;
  current: string;
  options: string[];
  submitLabel: string;
  note?: string;
  /** Extra fields sent with the status (e.g. tracking for "Shipped") */
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <select name="status" defaultValue={current} aria-label="Status" className={select} key={current}>
          {options.map((o) => (
            <option key={o} value={o}>
              {statusLabel(o)}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
      {children}
      {note && <p className="text-12 text-muted">{note}</p>}
      <FormMessage state={state} />
    </form>
  );
}
