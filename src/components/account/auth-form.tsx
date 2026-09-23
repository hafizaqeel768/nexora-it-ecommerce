"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register, type FormState } from "@/app/actions/account";
import { Field, FormMessage } from "@/components/account/field";

// Login / register card (the prototype's auth modal #am, as its own page).
export function AuthForm({ mode, next }: { mode: "login" | "register"; next: string }) {
  const isLogin = mode === "login";
  const [state, action, pending] = useActionState<FormState, FormData>(isLogin ? login : register, {});
  const f = state.fields ?? {};
  const v = state.values ?? {};
  const other = `/${isLogin ? "register" : "login"}${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="mx-auto w-[min(420px,100%)] animate-rise rounded-20 border border-line bg-white p-[30px] shadow-[0_20px_50px_#0000001a]">
      <h1 className="mb-[18px] text-22 font-bold">{isLogin ? "Login to your account" : "Create an account"}</h1>
      <form action={action} className="grid gap-3.5" noValidate>
        <input type="hidden" name="next" value={next} />
        {!isLogin && <Field label="Full name" name="name" required autoComplete="name" defaultValue={v.name} error={f.name} />}
        <Field label="Email" name="email" type="email" required autoComplete="email" defaultValue={v.email} error={f.email} />
        <Field
          label="Password"
          name="password"
          type="password"
          required
          minLength={isLogin ? undefined : 8}
          autoComplete={isLogin ? "current-password" : "new-password"}
          error={f.password}
        />
        {!isLogin && !f.password && <p className="-mt-2 text-12 text-muted">At least 8 characters.</p>}
        <FormMessage state={state} />
        <button type="submit" disabled={pending} className="btn cursor-pointer border-0 text-15 disabled:opacity-60">
          {pending ? "Please wait…" : isLogin ? "Login" : "Create account"}
        </button>
        <p className="text-center text-14 text-muted">
          {isLogin ? "No account? " : "Already registered? "}
          <Link href={other} className="font-bold text-accent">
            {isLogin ? "Register" : "Login"}
          </Link>
        </p>
      </form>
    </div>
  );
}
