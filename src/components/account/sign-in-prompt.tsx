import Link from "next/link";

// Shown on account pages when signed out (the prototype's "Please sign in").
export function SignInPrompt({ text, next }: { text: string; next: string }) {
  const q = `?next=${encodeURIComponent(next)}`;
  return (
    <div className="py-[70px] text-center">
      <h1 className="text-[clamp(26px,4vw,36px)] font-bold tracking-[-.8px]">Please sign in</h1>
      <p className="section-sub mx-auto mt-2 mb-5">{text}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href={`/login${q}`} className="btn">
          Login
        </Link>
        <Link href={`/register${q}`} className="btn border border-line bg-transparent text-ink hover:border-accent">
          Register
        </Link>
      </div>
    </div>
  );
}
