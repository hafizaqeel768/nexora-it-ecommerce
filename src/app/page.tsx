import { AboutSection } from "@/components/home/about-section";
import { BrandDeals, type BrandDeal } from "@/components/home/brand-deals";
import { CategoryGrid } from "@/components/home/category-grid";
import { Hero, type HeroCard } from "@/components/home/hero";
import { categoryImage, siteImages } from "@/lib/media";
import { categoryHref } from "@/lib/site-nav";

// Home page sections that carry images (Phase 4). Brand marquee, featured products, sectors,
// why us, FAQ and contact from the prototype are added in later phases.
export default function Home() {
  const heroCards: HeroCard[] = [
    { image: categoryImage("monitors"), title: "4K Monitors", price: "From $379" },
    { image: categoryImage("power"), title: "UPS Backup", price: "From $189", badge: "-14%" },
    { image: categoryImage("networking"), title: "Wireless Bridges", price: "From $129" },
  ];

  const { banners } = siteImages;
  const deals: BrandDeal[] = [
    { brand: "ViewSonic", topic: "Professional monitors", href: categoryHref("monitors"), image: banners.viewsonic },
    { brand: "UniFi", topic: "High-performance switches", href: categoryHref("networking"), image: banners.ubiquiti },
    { brand: "Schneider Electric", topic: "Power quality meters", href: categoryHref("power"), image: banners.schneider },
    { brand: "Prolec GE", topic: "Pad-mounted transformers", href: categoryHref("power"), image: banners.prolec },
  ];

  return (
    <main>
      <Hero cards={heroCards} />
      <AboutSection />
      <CategoryGrid />
      <BrandDeals deals={deals} />
    </main>
  );
}
