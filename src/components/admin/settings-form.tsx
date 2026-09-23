"use client";

import { useActionState } from "react";
import { saveSettings, type AdminFormState } from "@/app/actions/admin";
import { Field, FormMessage } from "@/components/account/field";
import { primaryButton } from "@/components/admin/ui";
import type { StoreRules } from "@/lib/store-settings";

// Store settings (the prototype's a_set).
export function SettingsForm({ rules }: { rules: StoreRules }) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(saveSettings, {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="grid gap-3.5" noValidate>
      <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
        <Field label="Sales tax (%)" name="taxPercent" type="number" min="0" max="50" step="0.01" defaultValue={rules.taxPercent} error={f.taxPercent} />
        <Field label="Free shipping over (USD)" name="freeShippingFrom" type="number" min="0" step="0.01" defaultValue={rules.freeShippingFrom} error={f.freeShippingFrom} />
        <Field label="Flat shipping fee (USD)" name="shippingFee" type="number" min="0" step="0.01" defaultValue={rules.shippingFee} error={f.shippingFee} />
        <Field label="Low-stock alert at (units)" name="lowStockAt" type="number" min="0" step="1" defaultValue={rules.lowStockAt} error={f.lowStockAt} />
      </div>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={`${primaryButton} justify-self-end`}>
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
