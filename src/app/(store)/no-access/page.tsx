import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { switchToAdminAccount } from "@/app/actions/account";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "No admin access", robots: { index: false } };

// Where a signed-in customer lands when opening /admin: says which account is signed in and how to switch.
export default async function NoAccessPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fadmin");
  if (viewer.role === "ADMIN") redirect("/admin");

  return (
    <main className="min-h-[70vh] pt-14 pb-[70px]">
      <div className="wrap">
        <div className="mx-auto max-w-[520px] py-10 text-center">
          <div className="mx-auto mb-5 grid size-[84px] place-items-center rounded-full bg-accent text-[40px] text-white">🔒</div>
          <h1 className="text-[clamp(24px,4vw,32px)] font-bold">No admin access</h1>
          <p className="section-sub mx-auto mt-2 mb-6">
            The admin panel is for store staff. You&apos;re logged in as <b>{viewer.email}</b>, which is a customer account.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <form action={switchToAdminAccount}>
              <button type="submit" className="btn cursor-pointer border-0">
                Log in as an admin
              </button>
            </form>
            <Link href="/" className="btn border border-line bg-transparent text-ink hover:border-accent">
              Back to the shop
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
