import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/account/auth-form";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Create an account", robots: NO_INDEX };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const { next } = await searchParams;
  if (await getViewer()) redirect("/account");
  return (
    <main className="min-h-[70vh] pt-14 pb-[70px]">
      <div className="wrap">
        <AuthForm mode="register" next={next ?? "/account"} />
      </div>
    </main>
  );
}
