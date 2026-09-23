// Navigation for the header and footer, mirroring design/nexora-full-with-admin.html. Categories come from the
// database since Phase 12 (src/lib/categories.ts); the prototype's hash routes map to real routes here.

export type CategoryIcon =
  | "computers"
  | "tablets"
  | "monitors"
  | "networking"
  | "power"
  | "iot"
  | "audio-conferencing";

/** Line icons available for categories (Admin → Categories → Icon). */
export const CATEGORY_ICONS: { value: CategoryIcon; label: string }[] = [
  { value: "computers", label: "Computer" },
  { value: "tablets", label: "Tablet" },
  { value: "monitors", label: "Monitor" },
  { value: "networking", label: "Network" },
  { value: "power", label: "Power" },
  { value: "iot", label: "IoT / sensor" },
  { value: "audio-conferencing", label: "Audio" },
];

export const categoryHref = (slug: string) => `/shop?category=${slug}`;

export const isCategoryIcon = (name: string | null | undefined): name is CategoryIcon => CATEGORY_ICONS.some((i) => i.value === name);

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
