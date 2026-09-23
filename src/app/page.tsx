import { AboutSection } from "@/components/home/about-section";
import { BrandDeals, type BrandDeal } from "@/components/home/brand-deals";
import { BrandMarquee } from "@/components/home/brand-marquee";
import { CategoryGrid } from "@/components/home/category-grid";
import { Faq } from "@/components/home/faq";
import { FeaturedProducts } from "@/components/home/featured-products";
import { Hero, type HeroCard } from "@/components/home/hero";
import { QuoteRequest } from "@/components/home/quote-request";
import { Sectors } from "@/components/home/sectors";
import { WhyUs } from "@/components/home/why-us";
import { categoryImage, siteImages } from "@/lib/media";
import { getFeaturedProducts, getQuoteProduct, getTopBrands, getTopCategories } from "@/lib/products";
import { categoryHref } from "@/lib/site-nav";

// Reads from the database on each request, so builds don't need a running database.
export const dynamic = "force-dynamic";

// Home page, sections in the prototype's order.
// ?quote=<product-slug> (from a product page's "Request quote") pre-fills the quote form.
export default async function Home({ searchParams }: { searchParams: Promise<{ quote?: string }> }) {
  const { quote } = await searchParams;
  const [featured, brands, categories, quoteProduct] = await Promise.all([
    getFeaturedProducts(),
    getTopBrands(),
    getTopCategories(),
    getQuoteProduct(quote),
  ]);

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
      <BrandMarquee brands={brands} />
      <AboutSection />
      <CategoryGrid />
      <FeaturedProducts products={featured} />
      <BrandDeals deals={deals} />
      <Sectors />
      <WhyUs />
      <Faq />
      <QuoteRequest
        categories={categories}
        initialCategory={quoteProduct?.category}
        initialMessage={quoteProduct ? `I would like a quote for: ${quoteProduct.name}.` : undefined}
      />
    </main>
  );
}
