"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GridIcon, SearchIcon } from "@/components/icons";
import { money } from "@/lib/format";
import type { SearchSuggestion } from "@/lib/catalog";

const POPULAR = ["Switch", "Monitor", "UPS", "Wi-Fi", "Laptop", "Tablet"];

type Results = { q: string; products: SearchSuggestion[]; total: number };

const shopUrl = (q: string) => (q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");

// Header search with live suggestions (the prototype's #hs / sug()): popular searches when empty,
// otherwise the first 6 matches and "See all N results". Arrow keys, Enter and Esc work like the prototype.
// Without JavaScript it is a plain GET form to /shop?q=.
export function HeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = pathname === "/shop" ? (searchParams.get("q") ?? "") : "";

  const [value, setValue] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [results, setResults] = useState<Results | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Show the current search on /shop, and close the dropdown after any navigation.
  useEffect(() => {
    setValue(urlQuery);
    setOpen(false);
  }, [pathname, urlQuery]);

  const q = value.trim();

  useEffect(() => {
    if (!q) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((data: Omit<Results, "q">) => setResults({ q, ...data }))
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!formRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    inputRef.current?.blur();
    router.push(href);
  };

  // While the next results load, the previous ones stay visible (no flicker while typing).
  const current = q ? results : null;
  // Keyboard targets: each suggestion, then "See all".
  const targets = current?.products.length ? [...current.products.map((p) => `/product/${p.slug}`), shopUrl(q)] : [];

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (!targets.length) return;
      const n = targets.length;
      setActive((a) => (e.key === "ArrowDown" ? (a + 1) % n : a <= 0 ? n - 1 : a - 1));
    } else if (e.key === "Enter" && open && active > -1 && targets[active]) {
      e.preventDefault();
      go(targets[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const item = (on: boolean) =>
    `flex items-center gap-3 rounded-12 p-2.5 text-header-ink transition-colors ${on ? "bg-[#f3f4f6]" : "hover:bg-[#f3f4f6]"}`;

  return (
    <form
      ref={formRef}
      action="/shop"
      role="search"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        go(shopUrl(q));
      }}
      className="relative z-[5] flex h-12 flex-1 items-center gap-2.5 rounded-12 border-2 border-header-field bg-white pr-[5px] pl-4 text-header-icon shadow-field transition focus-within:border-accent focus-within:text-accent focus-within:shadow-field-focus max-md:order-3 max-md:h-[46px] max-md:shrink-0 max-md:basis-full"
    >
      <SearchIcon className="size-5 flex-none" />
      <input
        ref={inputRef}
        type="search"
        name="q"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Type keyword to search..."
        aria-label="Search products"
        aria-expanded={open}
        aria-controls="header-search-suggestions"
        aria-autocomplete="list"
        role="combobox"
        className="h-full min-w-0 flex-1 bg-transparent text-15 text-header-ink outline-none placeholder:text-header-placeholder"
      />
      <button
        type="submit"
        aria-label="Search"
        className="grid h-9 w-[76px] flex-none cursor-pointer place-items-center rounded-8 bg-accent text-white transition-colors hover:bg-accent-hover"
      >
        <SearchIcon className="size-5" />
      </button>

      <div
        id="header-search-suggestions"
        className={`absolute top-[calc(100%+10px)] right-0 left-0 max-h-[70vh] overflow-auto rounded-16 border border-[#e5e5e5] bg-white p-3 text-header-ink shadow-[0_20px_50px_#0002] transition duration-200 ${
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1.5 opacity-0"
        }`}
      >
        {!q ? (
          <>
            <div className="px-2.5 py-2 text-[11.5px] tracking-[.08em] text-[#888] uppercase">Popular searches</div>
            <div className="flex flex-wrap px-1.5 pb-2">
              {POPULAR.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => go(shopUrl(w))}
                  className="m-1 cursor-pointer rounded-pill border border-[#e2e2e2] bg-[#f3f4f6] px-[15px] py-[7px] text-13 transition hover:border-accent hover:bg-accent hover:text-white"
                >
                  {w}
                </button>
              ))}
            </div>
          </>
        ) : !current ? (
          <div className="px-2.5 py-2 text-[11.5px] tracking-[.08em] text-[#888] uppercase">Searching…</div>
        ) : !current.products.length ? (
          <div className="px-2.5 py-2 text-[11.5px] tracking-[.08em] text-[#888] uppercase">No matches for “{q}”</div>
        ) : (
          <>
            {current.products.map((p, i) => (
              <Link key={p.slug} href={`/product/${p.slug}`} onClick={() => setOpen(false)} className={item(active === i)}>
                <span className="grid size-[46px] flex-none place-items-center overflow-hidden rounded-10 bg-[#f4f4f4] text-muted">
                  {p.image ? (
                    <Image src={p.image} alt="" width={46} height={46} className="size-full object-contain mix-blend-multiply" />
                  ) : (
                    <GridIcon className="size-6" />
                  )}
                </span>
                <span className="min-w-0">
                  <b className="block text-ui leading-[1.3]">{p.name}</b>
                  <small className="text-12 text-[#777]">
                    {p.brand} · {p.category}
                  </small>
                </span>
                <em className="ml-auto flex-none pl-2 text-13 font-bold text-accent not-italic">{money(p.price)}</em>
              </Link>
            ))}
            <Link
              href={shopUrl(q)}
              onClick={() => setOpen(false)}
              className={`mt-1.5 block border-t border-[#eee] p-[13px] text-center text-13 font-bold transition-colors ${
                active === current.products.length ? "text-header-ink" : "text-accent hover:text-header-ink"
              }`}
            >
              See all {current.total} result{current.total === 1 ? "" : "s"} for “{q}” →
            </Link>
          </>
        )}
      </div>
    </form>
  );
}
