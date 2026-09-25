"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import type { AdminFormState } from "@/app/actions/admin";
import { FormMessage } from "@/components/account/field";
import { primaryButton } from "@/components/admin/ui";

// Admin settings form. Submits with onSubmit (not a form action), so what you typed stays in the form when
// the server rejects it; `resetOnSuccess` empties "add new" forms after a successful save.
// `readOnly`: the admin's role may look but not change (Phase 14); fields are disabled and there is no button.
// The server action checks the permission itself either way.
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  className = "grid gap-3.5",
  resetOnSuccess = false,
  readOnly = false,
}: {
  action: (state: AdminFormState, form: FormData) => Promise<AdminFormState>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
  readOnly?: boolean;
}) {
  const [state, setState] = useState<AdminFormState>({});
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  // Bumped after a successful "add" so the fields (including pickers with their own state) start fresh.
  const [round, setRound] = useState(0);
  return (
    <form
      ref={ref}
      className={className}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (readOnly) return;
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          const next = await action(state, data);
          setState(next);
          if (next.ok && resetOnSuccess) setRound((r) => r + 1);
          // A saved upload must not be sent again with the next save.
          if (next.ok) ref.current?.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((i) => (i.value = ""));
        });
      }}
    >
      {readOnly ? (
        <fieldset disabled className="contents">
          {children}
        </fieldset>
      ) : (
        <Fragment key={round}>{children}</Fragment>
      )}
      <FormMessage state={state} />
      {readOnly ? (
        <p className="text-12 text-muted">View only: your role can&apos;t change this.</p>
      ) : (
        <div>
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Saving…" : submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}

// Delete (or other destructive) button with a confirmation.
export function ConfirmButton({ action, confirmText, label = "Delete" }: { action: () => Promise<void>; confirmText: string; label?: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <button type="submit" className="cursor-pointer text-13 font-bold text-accent hover:underline">
        {label}
      </button>
    </form>
  );
}
