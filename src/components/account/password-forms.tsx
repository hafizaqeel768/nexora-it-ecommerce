"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, resendVerification, resetPassword, type FormState } from "@/app/actions/account";
import { Field, FormMessage } from "@/components/account/field";

const cardClass = "mx-auto w-[min(420px,100%)] animate-rise rounded-20 border border-line bg-white p-[30px] shadow-[0_20px_50px_#0000001a]";
const submit = "btn cursor-pointer border-0 text-15 disabled:opacity-60";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, {});
  return (
    <div className={cardClass}>
      <h1 className="mb-2 text-22 font-bold">Forgot your password?</h1>
      <p className="mb-[18px] text-14 text-muted">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      <form action={action} className="grid gap-3.5" noValidate>
        <Field label="Email" name="email" type="email" required autoComplete="email" defaultValue={state.values?.email} error={state.fields?.email} />
        <FormMessage state={state} />
        <button type="submit" disabled={pending} className={submit}>
          {pending ? "Please wait…" : "Send reset link"}
        </button>
        <p className="text-center text-14 text-muted">
          <Link href="/login" className="font-bold text-accent">
            Back to login
          </Link>
        </p>
      </form>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPassword, {});
  const f = state.fields ?? {};
  return (
    <div className={cardClass}>
      <h1 className="mb-[18px] text-22 font-bold">Choose a new password</h1>
      <form action={action} className="grid gap-3.5" noValidate>
        <input type="hidden" name="token" value={token} />
        <Field label="New password" name="password" type="password" required minLength={8} autoComplete="new-password" error={f.password} />
        <Field label="Repeat new password" name="confirm" type="password" required autoComplete="new-password" error={f.confirm} />
        {!f.password && <p className="-mt-2 text-12 text-muted">At least 8 characters. Other devices will be signed out.</p>}
        <FormMessage state={state} />
        <button type="submit" disabled={pending} className={submit}>
          {pending ? "Saving…" : "Save new password"}
        </button>
      </form>
    </div>
  );
}

// "Please confirm your email" banner on the account page.
export function VerifyEmailBanner({ email }: { email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resendVerification, {});
  return (
    <div className="mb-5 grid max-w-[760px] gap-2 rounded-14 border border-[#f59e0b55] bg-[#f59e0b14] px-4 py-3 text-14">
      <p>
        <b>Please confirm your email.</b> We sent a link to {email}. Once confirmed, you&apos;ll also see earlier orders placed with this email.
      </p>
      <form action={action}>
        <button type="submit" disabled={pending} className="cursor-pointer text-13 font-bold text-accent hover:underline disabled:opacity-60">
          {pending ? "Sending…" : "Send the link again"}
        </button>
      </form>
      <FormMessage state={state} />
    </div>
  );
}
