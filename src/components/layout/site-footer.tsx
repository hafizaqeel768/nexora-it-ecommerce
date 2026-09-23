import Link from "next/link";
import { categories, categoryHref, companyLinks } from "@/lib/site-nav";

// Static footer from the prototype. Newsletter signup is wired up in Phase 10 (Resend).
const footerLink = "mb-2 block text-footer-text transition-colors hover:text-white";

const social = [
  { label: "LinkedIn", glyph: "in" },
  { label: "X", glyph: "𝕏" },
  { label: "Facebook", glyph: "f" },
  { label: "YouTube", glyph: "▶" },
];

export function SiteFooter() {
  return (
    <footer className="border-t-[3px] border-accent bg-footer-bg pt-14 text-13 text-footer-text">
      <div className="wrap">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1.4fr] gap-8 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <div>
            <div className="mb-2.5 text-26 font-black tracking-[-1px] text-white">
              NEXORA<span className="text-accent">.IT</span>
            </div>
            <p className="my-[1em]">
              Business-grade IT hardware and solutions, sourced and supported by people who care.
            </p>
            <p className="mb-3.5 leading-[1.9]">
              ✉ fed@example.com (Federal)
              <br />✉ marketing@example.com (Commercial)
            </p>
            <div className="flex gap-2.5">
              {social.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="grid size-[38px] place-items-center rounded-full border border-footer-edge text-footer-text transition-colors hover:border-accent hover:bg-accent hover:text-white"
                >
                  {s.glyph}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-3.5 text-14 font-bold text-white">Shop</h4>
            {categories.map((c) => (
              <Link key={c.slug} href={categoryHref(c.slug)} className={footerLink}>
                {c.footerName ?? c.name}
              </Link>
            ))}
          </div>

          <div>
            <h4 className="mb-3.5 text-14 font-bold text-white">Company</h4>
            {companyLinks.map((l) => (
              <Link key={l.label} href={l.href} className={footerLink}>
                {l.label}
              </Link>
            ))}
          </div>

          <div>
            <h4 className="mb-3.5 text-14 font-bold text-white">Newsletter</h4>
            <p className="my-[1em]">Deals and hardware news, once a month.</p>
            <form className="flex gap-2">
              <input
                type="email"
                required
                placeholder="you@company.com"
                aria-label="Email address"
                className="min-w-0 flex-1 rounded-pill border border-footer-edge bg-footer-field px-4 py-[11px] text-13 text-white outline-none focus:border-accent"
              />
              <button
                type="button"
                className="cursor-pointer rounded-pill bg-accent px-[18px] font-bold text-white"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap justify-between gap-2 border-t border-footer-line py-5 text-12">
          <span>© 2026 Nexora IT. Sample design for reference.</span>
          <span>Privacy · Terms · Shipping · Returns</span>
        </div>
      </div>
    </footer>
  );
}
