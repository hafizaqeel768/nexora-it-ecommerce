import type { Metadata } from "next";
import Link from "next/link";
import { consumeToken } from "@/lib/auth-tokens";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Confirm email", robots: { index: false } };

type Props = { searchParams: Promise<{ token?: string }> };

// Link from the "confirm your email" message. Opening it confirms the address (harmless if a mail scanner opens it first).
export default async function VerifyEmailPage({ searchParams }: Props) {
  const { token = "" } = await searchParams;
  const customerId = await consumeToken(token, "VERIFY_EMAIL");
  if (customerId) {
    await db.customer.updateMany({ where: { id: customerId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  }
  return (
    <main className="min-h-[70vh] pt-14 pb-[70px]">
      <div className="wrap">
        <div className="mx-auto max-w-[480px] py-10 text-center">
          <div className="mx-auto mb-5 grid size-[84px] animate-pop place-items-center rounded-full bg-accent text-[44px] text-white">{customerId ? "✓" : "!"}</div>
          <h1 className="text-[clamp(24px,4vw,32px)] font-bold">{customerId ? "Email confirmed" : "This link has expired"}</h1>
          <p className="section-sub mx-auto mt-2 mb-5">
            {customerId
              ? "Thank you! Your account now also shows earlier orders placed with this email."
              : "Confirmation links work for 24 hours and only once. Log in and use “Send the link again” on your account page."}
          </p>
          <Link href="/account" className="btn">
            Go to my account
          </Link>
        </div>
      </div>
    </main>
  );
}
