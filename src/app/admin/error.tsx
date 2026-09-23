"use client";

// Admin pages: show the error inside the admin shell instead of a blank screen.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-[560px] rounded-16 border border-line bg-white p-[18px]">
      <h2 className="text-18 font-bold">This admin page failed to load</h2>
      <p className="mt-2 text-14 text-muted">
        {error.message || "Unexpected error."}
        {error.digest && <span className="mt-1 block text-12">Reference: {error.digest}</span>}
      </p>
      <button type="button" onClick={reset} className="btn mt-4 cursor-pointer border-0 text-14">
        Try again
      </button>
    </div>
  );
}
