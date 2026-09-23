import Link from "next/link";
import { StoreLogo } from "@/components/store-logo";
import { getConfig } from "@/lib/config";
import { categories, categoryHref, companyLinks } from "@/lib/site-nav";

// Footer from the prototype; about text, contacts, social links and copyright come from Settings → Store details.
// (Newsletter sign-ups are stored from Phase 14.)
const footerLink = "mb-2 block text-footer-text transition-colors hover:text-white";

const SOCIAL = [
  { key: "linkedin", label: "LinkedIn", glyph: "in" },
  { key: "x", label: "X", glyph: "𝕏" },
  { key: "facebook", label: "Facebook", glyph: "f" },
  { key: "youtube", label: "YouTube", glyph: "▶" },
] as const;

export async function SiteFooter() {
  const store = await getConfig("store");
  const social = SOCIAL.filter((s) => store.social[s.key]);
  const copyright = store.copyright.replace("{year}", String(new Date().getFullYear()));
  return (
    <footer className="border-t-[3px] border-accent bg-footer-bg pt-14 text-13 text-footer-text">
      <div className="wrap">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1.4fr] gap-8 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <div>
            <div className="mb-2.5 text-white">
              <StoreLogo store={store} className="text-26 tracking-[-1px]" />
            </div>
            {store.footerAbout && <p className="my-[1em] whitespace-pre-line">{store.footerAbout}</p>}
            <p className="mb-3.5 leading-[1.9]">
              {store.supportEmail && (
                <>
                  ✉{" "}
                  <a href={`mailto:${store.supportEmail}`} className="hover:text-white">
                    {store.supportEmail}
                  </a>{" "}
                  (Support)
                  <br />
                </>
              )}
              {store.salesEmail && (
                <>
                  ✉{" "}
                  <a href={`mailto:${store.salesEmail}`} className="hover:text-white">
                    {store.salesEmail}
                  </a>{" "}
                  (Sales)
                  <br />
                </>
              )}
              {store.phone && (
                <>
                  ☎{" "}
                  <a href={`tel:${store.phone.replace(/[^\d+]/g, "")}`} className="hover:text-white">
                    {store.phone}
                  </a>
                  <br />
                </>
              )}
              {store.address && <span className="block whitespace-pre-line">{store.address}</span>}
            </p>
            {social.length > 0 && (
              <div className="flex gap-2.5">
                {social.map((s) => (
                  <a
                    key={s.key}
                    href={store.social[s.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="grid size-[38px] place-items-center rounded-full border border-footer-edge text-footer-text transition-colors hover:border-accent hover:bg-accent hover:text-white"
                  >
                    {s.glyph}
                  </a>
                ))}
              </div>
            )}
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
          <span>{copyright}</span>
          <span>Privacy · Terms · Shipping · Returns</span>
        </div>
      </div>
    </footer>
  );
}
