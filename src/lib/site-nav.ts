// Static navigation for the header and footer, mirroring design/nexora-full-with-admin.html.
// Categories become database-backed in Phase 5; the prototype's hash routes map to real routes here.

export type CategoryIcon =
  | "computers"
  | "tablets"
  | "monitors"
  | "networking"
  | "power"
  | "iot"
  | "audio-conferencing";

export type Category = {
  slug: CategoryIcon;
  name: string;
  footerName?: string;
};

export const categories: Category[] = [
  { slug: "computers", name: "Computers" },
  { slug: "tablets", name: "Tablets" },
  { slug: "monitors", name: "Monitors" },
  { slug: "networking", name: "Networking" },
  { slug: "power", name: "Power", footerName: "Power & UPS" },
  { slug: "iot", name: "IoT" },
  { slug: "audio-conferencing", name: "Audio & Conferencing" },
];

export const categoryHref = (slug: string) => `/shop?category=${slug}`;

export const isCategoryIcon = (slug: string): slug is CategoryIcon => categories.some((c) => c.slug === slug);

export const mainNav = [
  { label: "ABOUT US", href: "/#about" },
  { label: "WHY US", href: "/#why" },
  { label: "BRANDS", href: "/#brands" },
  { label: "SHOP", href: "/shop" },
  { label: "CONTACT", href: "/#contact" },
  { label: "QUOTE NOW", href: "/#contact" },
];

export const companyLinks = [
  { label: "Sectors", href: "/#sectors" },
  { label: "FAQ", href: "/#faq" },
  { label: "Request a quote", href: "/#contact" },
  { label: "Cart", href: "/cart" },
];
