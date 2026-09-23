import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/account/password-forms";
import { peekToken } from "@/lib/auth-tokens";

export const metadata: Metadata = { title: "Choose a new password | Nexora IT", robots: { index: false } };

type Props = { searchParams: Promise<{ token?: string }> };

// Link from the reset email. The token is only used up when the new password is saved,
// so an email scanner opening the link doesn't break it.
export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token = "" } = await searchParams;
  const valid = !!(await peekToken(token, "RESET_PASSWORD"));
  return (
    <main className="min-h-[70vh] pt-14 pb-[70px]">
      <div className="wrap">
        {valid ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="mx-auto max-w-[460px] py-10 text-center">
            <h1 className="text-[clamp(24px,4vw,32px)] font-bold">This link has expired</h1>
            <p className="section-sub mx-auto mt-2 mb-5">Reset links work for 1 hour and only once.</p>
            <Link href="/forgot-password" className="btn">
              Send a new link
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
