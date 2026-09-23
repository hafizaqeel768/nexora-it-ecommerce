import Image from "next/image";
import Link from "next/link";
import { CategoryGlyph, GridIcon, ServicesIcon } from "@/components/icons";
import { categoryImage } from "@/lib/media";
import { categoryHref, type CategoryIcon } from "@/lib/site-nav";

// Category tiles. A tile shows media/category/<slug>.* when that photo exists, otherwise its icon.
type Tile = {
  title: string;
  text: string;
  link: string;
  href: string;
  slug?: CategoryIcon;
  icon?: React.ReactNode;
  highlight?: boolean;
};

const tiles: Tile[] = [
  { slug: "computers", title: "PCs & Laptops", text: "Desktops, workstations and notebooks for every workload.", link: "Shop computers", href: categoryHref("computers") },
  { slug: "tablets", title: "Tablets", text: "Rugged and consumer tablets for field and office use.", link: "Shop tablets", href: categoryHref("tablets") },
  { slug: "monitors", title: "Monitors", text: 'Displays from everyday 24" to ultrawide and 4K.', link: "Shop monitors", href: categoryHref("monitors") },
  { slug: "networking", title: "Networking", text: "Switches, routers, access points and firewalls.", link: "Shop networking", href: categoryHref("networking") },
  { slug: "power", title: "Power & UPS", text: "Battery backup, meters and power protection.", link: "Shop power", href: categoryHref("power") },
  { slug: "iot", title: "Industrial IoT", text: "Gateways, sensors and edge devices.", link: "Shop IoT", href: categoryHref("iot") },
  { icon: <ServicesIcon className="size-[30px]" />, title: "IT Services", text: "Deployment, ERP/CRM setup and support.", link: "Get support", href: "/#contact" },
  { icon: <GridIcon className="size-[30px]" />, title: "All Products", text: "Browse the full catalog of business hardware.", link: "View catalog", href: "/shop", highlight: true },
];

export function CategoryGrid() {
  return (
    <section id="products" className="section-grey">
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="eyebrow">Product categories</span>
            <h2 className="section-title">Everything your team needs</h2>
            <p className="section-sub">A complete range of business-grade hardware from trusted brands.</p>
          </div>
          <Link href="/shop" className="btn">
            View all products →
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-[18px] max-[1001px]:grid-cols-2 max-[561px]:grid-cols-1">
          {tiles.map((t, i) => {
            const photo = t.slug ? categoryImage(t.slug) : null;
            return (
              <Link
                key={t.title}
                href={t.href}
                className={`group relative flex flex-col gap-2 overflow-hidden rounded-[22px] border p-6 transition duration-300 before:absolute before:-right-[70px] before:-bottom-[90px] before:size-[230px] before:rounded-full before:transition-transform before:duration-500 before:content-[''] hover:-translate-y-1.5 hover:border-accent hover:shadow-[0_18px_44px_#d21f2b26] hover:before:scale-[1.7] ${
                  t.highlight
                    ? "border-transparent bg-[linear-gradient(135deg,#d21f2b,#9d0f19)] text-white before:bg-[radial-gradient(circle,#ffffff2a,transparent_70%)]"
                    : "border-line bg-white text-ink before:bg-[radial-gradient(circle,#d21f2b1a,transparent_70%)]"
                }`}
              >
                <span
                  className={`absolute top-4 right-5 text-36 font-extrabold tracking-[-2px] ${
                    t.highlight ? "text-[#ffffff22]" : "text-[#0000000c]"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                {photo ? (
                  <span className="grid size-[60px] place-items-center overflow-hidden rounded-16 border border-line bg-white transition duration-300 group-hover:-rotate-6 group-hover:scale-[1.06] group-hover:border-accent">
                    <Image src={photo} alt="" width={135} height={135} className="size-[88%] object-contain" />
                  </span>
                ) : (
                  <span
                    className={`grid size-[60px] place-items-center rounded-16 transition duration-300 group-hover:-rotate-6 group-hover:scale-[1.06] ${
                      t.highlight
                        ? "bg-[#ffffff26] text-white"
                        : "bg-accent-soft text-accent group-hover:bg-accent group-hover:text-white"
                    }`}
                  >
                    {t.icon ?? <CategoryGlyph name={t.slug!} className="size-[30px]" />}
                  </span>
                )}

                <h3 className="mt-3 text-18 font-bold">{t.title}</h3>
                <p className={`flex-1 text-14 ${t.highlight ? "text-[#ffe3e6]" : "text-muted"}`}>{t.text}</p>
                <span
                  className={`mt-3.5 flex items-center gap-2 text-14 font-bold ${t.highlight ? "text-[#ffe3e6]" : "text-accent"}`}
                >
                  {t.link} <i className="not-italic transition-transform duration-300 group-hover:translate-x-1.5">→</i>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
