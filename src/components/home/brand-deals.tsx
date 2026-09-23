"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import s from "./brand-deals.module.css";

export type BrandDeal = {
  brand: string;
  topic: string;
  href: string;
  image: { src: string; width: number; height: number };
};

const ROTATE_MS = 5000;

// Brand tabs on the left, banner on the right; rotates every 5s, clicking a tab jumps to it.
export function BrandDeals({ deals }: { deals: BrandDeal[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setActive((i) => (i + 1) % deals.length), ROTATE_MS);
    return () => clearTimeout(t);
  }, [active, deals.length]);

  return (
    <section id="deals" className="section-grey">
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="eyebrow">Featured brands</span>
            <h2 className="section-title">Top brands &amp; promotions</h2>
            <p className="section-sub">
              Power, display and networking solutions from leading manufacturers.
            </p>
          </div>
          <Link href="/shop" className="btn">
            Shop all brands →
          </Link>
        </div>

        <div className={s.layout}>
          <div className={s.tabs} role="tablist" aria-label="Featured brands">
            {deals.map((d, i) => (
              <button
                key={d.brand}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-controls={`deal-${i}`}
                className={`${s.tab} ${i === active ? s.active : ""}`}
                onClick={() => setActive(i)}
              >
                <small>{String(i + 1).padStart(2, "0")}</small>
                <b>{d.brand}</b>
                <span>{d.topic}</span>
                <i key={i === active ? `on-${active}` : "off"} />
              </button>
            ))}
          </div>

          <div className={s.view}>
            {deals.map((d, i) => (
              <Link
                key={d.brand}
                id={`deal-${i}`}
                role="tabpanel"
                href={d.href}
                aria-hidden={i !== active}
                tabIndex={i === active ? 0 : -1}
                className={`${s.slide} ${i === active ? s.active : ""}`}
              >
                <i className={s.backdrop} style={{ backgroundImage: `url("${d.image.src}")` }} />
                <Image
                  src={d.image.src}
                  width={d.image.width}
                  height={d.image.height}
                  alt={`${d.brand} ${d.topic}`}
                  sizes="(max-width: 900px) 90vw, 700px"
                />
                <span className={s.badge}>Shop now →</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
