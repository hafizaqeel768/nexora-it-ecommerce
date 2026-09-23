import Link from "next/link";
import { logout } from "@/app/actions/account";
import { CartButton } from "@/components/cart/cart-button";
import { ChatIcon, SearchIcon } from "@/components/icons";
import { CategoryMenu } from "@/components/layout/category-menu";
import { WishlistHeaderLink } from "@/components/wishlist/wishlist-button";
import { db } from "@/lib/db";
import { mainNav } from "@/lib/site-nav";
import { accountOrdersWhere, getViewer } from "@/lib/viewer";

// Header from the prototype: top bar (login/register, or name · orders · logout), logo/search/wishlist/cart row,
// and the sticky red nav.
const topLink =
  "inline-flex items-center gap-2 border-l border-header-line px-3 py-1.5 text-header-link transition-colors hover:text-accent";

export async function SiteHeader() {
  const viewer = await getViewer();
  const orderCount = viewer ? await db.order.count({ where: accountOrdersWhere(viewer) }) : 0;

  return (
    <>
      <header className="relative z-40 border-b border-header-line bg-white text-header-ink">
        {/* Top bar */}
        <div className="border-b border-header-line text-caption text-header-text">
          <div className="wrap flex flex-wrap justify-between max-md:justify-end">
            <span className="flex flex-wrap max-md:hidden">
              <span className="inline-flex items-center gap-2 py-1.5 pr-3">
                🚚 Free shipping on orders over $500
              </span>
            </span>
            <span className="flex flex-wrap">
              <Link href="/#contact" className={`${topLink} pl-3.5`}>
                <ChatIcon className="size-4 stroke-accent" /> Live-Chat
              </Link>
              {viewer ? (
                <>
                  <Link href="/account?t=profile" className={`${topLink} max-w-[180px] truncate`}>
                    {viewer.name}
                  </Link>
                  <Link href="/account" className={topLink}>
                    Orders ({orderCount})
                  </Link>
                  <form action={logout} className="contents">
                    <button type="submit" className={`${topLink} cursor-pointer`}>
                      Logout
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className={topLink}>
                    Login
                  </Link>
                  <Link href="/register" className={topLink}>
                    Register
                  </Link>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Logo, search, wishlist, cart */}
        <div className="wrap flex items-center gap-[22px] py-2.5 max-md:flex-wrap">
          <Link href="/" className="block flex-none text-header-ink max-md:order-1">
            <b className="block text-28 leading-none font-black tracking-[-1.2px]">
              NEXORA<span className="text-accent">.IT</span>
            </b>
          </Link>

          <form
            action="/shop"
            role="search"
            autoComplete="off"
            className="relative z-[5] flex h-12 flex-1 items-center gap-2.5 rounded-12 border-2 border-header-field bg-white pr-[5px] pl-4 text-header-icon shadow-field transition focus-within:border-accent focus-within:text-accent focus-within:shadow-field-focus max-md:order-3 max-md:h-[46px] max-md:shrink-0 max-md:basis-full"
          >
            <SearchIcon className="size-5 flex-none" />
            <input
              type="search"
              name="q"
              placeholder="Type keyword to search..."
              aria-label="Search products"
              className="h-full min-w-0 flex-1 bg-transparent text-15 text-header-ink outline-none placeholder:text-header-placeholder"
            />
            <button
              type="submit"
              aria-label="Search"
              className="grid h-9 w-[76px] flex-none cursor-pointer place-items-center rounded-8 bg-accent text-white transition-colors hover:bg-accent-hover"
            >
              <SearchIcon className="size-5" />
            </button>
          </form>

          <WishlistHeaderLink
            className="relative mr-2 grid size-[42px] flex-none place-items-center rounded-8 border border-header-control bg-white text-header-ink transition-colors hover:border-accent hover:bg-accent hover:text-white max-md:order-2 max-md:ml-auto"
            badgeClassName="absolute -top-[5px] -right-[5px] grid h-[18px] min-w-[18px] place-items-center rounded-pill border-2 border-white bg-accent px-1 text-[10.5px] font-bold text-white"
          />

          <CartButton />
        </div>
      </header>

      {/* Red navigation bar (sticky) */}
      <div className="sticky top-0 z-30 bg-accent shadow-bar">
        <nav
          aria-label="Main"
          className="wrap flex h-[50px] items-center gap-7 max-md:h-12 max-md:gap-3"
        >
          <CategoryMenu />
          <ul className="flex flex-1 gap-7 [scrollbar-width:none] max-xl:overflow-x-auto">
            {mainNav.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="border-b-2 border-transparent py-1.5 text-nav font-semibold tracking-[.2px] whitespace-nowrap text-white transition-colors hover:border-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/#deals"
            className="ml-auto flex-none rounded-6 border border-white/65 px-4 py-[9px] text-ui font-bold text-white transition hover:bg-white hover:text-accent max-xl:hidden"
          >
            &#8594; PROMOTION
          </Link>
        </nav>
      </div>
    </>
  );
}
