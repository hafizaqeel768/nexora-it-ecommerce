"use client";

import Link from "next/link";
import { useEffect } from "react";

// Shown when a store page fails unexpectedly (e.g. the database is briefly unreachable). Header and footer stay.
export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="min-h-[60vh] pt-14 pb-[70px]">
      <div className="wrap">
        <div className="mx-auto max-w-[520px] py-10 text-center">
          <h1 className="text-[clamp(24px,4vw,32px)] font-bold">Something went wrong</h1>
          <p className="section-sub mx-auto mt-2 mb-6">
            Sorry, this page couldn&apos;t load. Please try again in a moment.
            {error.digest && <span className="mt-1 block text-12">Reference: {error.digest}</span>}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={reset} className="btn cursor-pointer border-0">
              Try again
            </button>
            <Link href="/" className="btn border border-line bg-transparent text-ink hover:border-accent">
              Home page
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
