"use client";

import { useActionState } from "react";
import { updateAddress, updateProfile, type FormState } from "@/app/actions/account";
import { Field, FormMessage } from "@/components/account/field";

const row = "grid grid-cols-2 gap-3.5 max-sm:grid-cols-1";
const submit = "btn cursor-pointer justify-self-start border-0 text-15 disabled:opacity-60";

type Address = { line: string; city: string; state: string; postalCode: string; country: string };

// Addresses tab (the prototype's #addrf). Checkout pre-fills from this address.
export function AddressForm({ address }: { address: Address }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateAddress, {});
  return (
    <form action={action} className="grid max-w-[520px] gap-3.5">
      <Field label="Street address" name="line" defaultValue={address.line} autoComplete="street-address" />
      <div className={row}>
        <Field label="City" name="city" defaultValue={address.city} autoComplete="address-level2" />
        <Field label="State / Region" name="state" defaultValue={address.state} autoComplete="address-level1" />
      </div>
      <div className={row}>
        <Field label="ZIP / Postal code" name="postalCode" defaultValue={address.postalCode} autoComplete="postal-code" />
        <Field label="Country" name="country" defaultValue={address.country} autoComplete="country-name" />
      </div>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={submit}>
        {pending ? "Saving…" : "Save address"}
      </button>
    </form>
  );
}

// Profile tab (the prototype's #proff). The email is the login, so it can't be changed here.
export function ProfileForm({ name, email, phone }: { name: string; email: string; phone: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, {});
  return (
    <form action={action} className="grid max-w-[520px] gap-3.5">
      <Field label="Full name" name="name" required defaultValue={name} autoComplete="name" error={state.fields?.name} />
      <Field label="Email" value={email} disabled readOnly />
      <Field label="Phone" name="phone" type="tel" defaultValue={phone} autoComplete="tel" />
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className={submit}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
