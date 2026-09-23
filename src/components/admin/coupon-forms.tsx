"use client";

import { useActionState } from "react";
import { createCoupon, type AdminFormState } from "@/app/actions/admin";
import { FormMessage, fieldClass } from "@/components/account/field";
import { primaryButton, textButton } from "@/components/admin/ui";

// "Add coupon" row (the prototype's cpn form).
export function NewCouponForm() {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(createCoupon, {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="grid gap-3" noValidate>
      <div className="flex flex-wrap items-start gap-3">
        <label className="grid max-w-[320px] min-w-[160px] flex-1 gap-1 text-13 text-muted">
          <span className="sr-only">Coupon code</span>
          <input name="code" placeholder="Coupon code (e.g. SAVE15)" required className={`${fieldClass} py-2.5 uppercase`} aria-invalid={!!f.code} />
          {f.code && <span className="text-accent">{f.code}</span>}
        </label>
        <label className="grid w-[150px] gap-1 text-13 text-muted">
          <span className="sr-only">Discount percent</span>
          <input name="percent" type="number" min={1} max={90} placeholder="Discount %" required className={`${fieldClass} py-2.5`} aria-invalid={!!f.percent} />
          {f.percent && <span className="text-accent">{f.percent}</span>}
        </label>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Adding…" : "Add coupon"}
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

// Delete with a confirmation, since it can't be undone.
export function DeleteCouponButton({ code, action }: { code: string; action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete coupon ${code}? Orders that used it keep the code.`)) e.preventDefault();
      }}
    >
      <button type="submit" className={textButton}>
        Delete
      </button>
    </form>
  );
}
