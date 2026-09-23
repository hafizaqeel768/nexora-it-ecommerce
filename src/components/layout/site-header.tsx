import Link from "next/link";
import { logout } from "@/app/actions/account";
import { CartButton } from "@/components/cart/cart-button";
import { ChatIcon } from "@/components/icons";
import { CategoryMenu } from "@/components/layout/category-menu";
import { HeaderSearch } from "@/components/layout/header-search";
import { StoreLogo } from "@/components/store-logo";
import { WishlistHeaderLink } from "@/components/wishlist/wishlist-button";
import { db } from "@/lib/db";
import { getMenuCategories } from "@/lib/categories";
import { getConfig } from "@/lib/config";
import { mainNav } from "@/lib/site-nav";
import { accountOrdersWhere, getViewer } from "@/lib/viewer";

// Header from the prototype: top bar (login/register, or name · orders · logout), logo/search/wishlist/cart row,
// and the sticky red nav.
const topLink =
  "inline-flex items-center gap-2 border-l border-header-line px-3 py-1.5 text-header-link transition-colors hover:text-accent";

export async function SiteHeader() {
  const viewer = await getViewer();
  const orderCount = viewer ? await db.order.count({ where: accountOrdersWhere(viewer) }) : 0;
  const [store, categories] = await Promise.all([getConfig("store"), getMenuCategories()]);

  return (
    <>
      <header className="relative z-40 border-b border-header-line bg-white text-header-ink">
        {/* Top bar */}
        <div className="border-b border-header-line text-caption text-header-text">
          <div className="wrap flex flex-wrap justify-between max-md:justify-end">
            <span className="flex flex-wrap max-md:hidden">
              {store.announcement && <span className="inline-flex items-center gap-2 py-1.5 pr-3">{store.announcement}</span>}
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
          <Link href="/" aria-label={`${store.name} home`} className="block flex-none text-header-ink max-md:order-1">
            <StoreLogo store={store} className="text-28 tracking-[-1.2px]" />
          </Link>

          <HeaderSearch />

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
          <CategoryMenu categories={categories.map(({ slug, name, icon }) => ({ slug, name, icon }))} />
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
