import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/account/auth-form";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Login | Nexora IT" };

type Props = { searchParams: Promise<{ next?: string; reset?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next, reset } = await searchParams;
  if (await getViewer()) redirect("/account");
  return (
    <main className="min-h-[70vh] pt-14 pb-[70px]">
      <div className="wrap">
        <AuthForm mode="login" next={next ?? "/account"} notice={reset ? "Password changed. Please log in with your new password." : undefined} />
      </div>
    </main>
  );
}
