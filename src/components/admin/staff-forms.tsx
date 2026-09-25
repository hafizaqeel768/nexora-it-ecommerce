"use client";

import { useActionState, useState } from "react";
import type { AdminFormState } from "@/app/actions/admin";
import { FormMessage } from "@/components/account/field";
import { textButton } from "@/components/admin/ui";
import { PERMISSION_GROUPS } from "@/lib/acl";

// Admin users & roles (Phase 14): one-click actions with a confirmation and an inline result,
// and the grouped permission picker for roles.

/** A button that runs a server action after an optional confirm, and shows its error or success below. */
export function StaffActionButton({
  action,
  label,
  confirmText,
  danger = false,
}: {
  action: (state: AdminFormState) => Promise<AdminFormState>;
  label: string;
  confirmText?: string;
  danger?: boolean;
}) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <form
      action={run}
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
      className="grid justify-items-start gap-2"
    >
      <button
        type="submit"
        disabled={pending}
        className={danger ? "btn cursor-pointer border-0 bg-[#b3141f] text-14 disabled:opacity-60" : "btn cursor-pointer border-0 bg-ink text-14 disabled:opacity-60"}
      >
        {pending ? "Working…" : label}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

/**
 * Permission checkboxes by module, with "all" per module. `grantable`: codes this admin may grant
 * ("all" for super admins); the others are shown but locked. The server enforces the same rule.
 */
export function PermissionPicker({ selected, grantable, readOnly = false }: { selected: string[]; grantable: string[] | "all"; readOnly?: boolean }) {
  const [on, setOn] = useState(() => new Set(selected));
  const may = (p: string) => !readOnly && (grantable === "all" || grantable.includes(p));
  const toggle = (codes: string[], value: boolean) =>
    setOn((prev) => {
      const next = new Set(prev);
      for (const c of codes) {
        if (!may(c)) continue;
        if (value) next.add(c);
        else next.delete(c);
      }
      return next;
    });

  return (
    <div className="grid gap-3">
      <p className="text-13 text-muted">
        {on.size} permission{on.size === 1 ? "" : "s"} selected. Super admin is not a permission: it can&apos;t be given through a role.
      </p>
      <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
        {PERMISSION_GROUPS.map((g) => {
          const codes = g.permissions.map((p) => p[0] as string);
          const editable = codes.filter(may);
          const all = codes.every((c) => on.has(c));
          return (
            <fieldset key={g.key} className="rounded-12 border border-line p-3">
              <legend className="flex w-full items-center gap-3 px-1 text-14 font-bold">
                {g.label}
                {editable.length > 0 && (
                  <button type="button" className={`${textButton} ml-auto text-12`} onClick={() => toggle(codes, !all)}>
                    {all ? "None" : "All"}
                  </button>
                )}
              </legend>
              <div className="grid gap-1.5">
                {g.permissions.map(([code, label]) => {
                  const locked = !may(code);
                  return (
                    <label key={code} className={`flex items-start gap-2.5 text-13 ${locked ? "text-muted" : "cursor-pointer"}`}>
                      <input
                        type="checkbox"
                        name="permissions"
                        value={code}
                        checked={on.has(code)}
                        disabled={locked}
                        onChange={(e) => toggle([code], e.target.checked)}
                        className="mt-0.5 size-4 accent-accent"
                      />
                      <span>
                        {label}
                        <code className="block text-11 text-muted">{code}</code>
                      </span>
                      {/* A locked box isn't submitted; keep what the role already has so saving doesn't drop it. */}
                      {locked && on.has(code) && <input type="hidden" name="permissions" value={code} />}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
