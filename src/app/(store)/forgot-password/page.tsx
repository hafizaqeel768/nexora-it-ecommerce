import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";
import { ForgotPasswordForm } from "@/components/account/password-forms";

export const metadata: Metadata = { title: "Forgot password", robots: NO_INDEX };

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-[70vh] pt-14 pb-[70px]">
      <div className="wrap">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
