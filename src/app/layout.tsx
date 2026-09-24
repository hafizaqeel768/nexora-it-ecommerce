import type { Metadata, Viewport } from "next";
import { WishlistProvider } from "@/components/wishlist/wishlist-provider";
import { getConfig } from "@/lib/config";
import { APP_URL } from "@/lib/site-url";
import { getViewer } from "@/lib/viewer";
import "./globals.css";

// Titles and description follow Settings → Store details; pages set only their own part ("Cart" → "Cart | Store").
// Settings → SEO adds the share image, search-engine verification and the "don't index this site" switch.
export async function generateMetadata(): Promise<Metadata> {
  const [store, seo] = await Promise.all([getConfig("store"), getConfig("seo")]);
  const description = seo.homeDescription || store.footerAbout || undefined;
  return {
    metadataBase: new URL(APP_URL),
    title: { template: `%s | ${store.name}`, default: store.tagline ? `${store.name} – ${store.tagline}` : store.name },
    description,
    openGraph: { siteName: store.name, type: "website", locale: "en_US", images: seo.shareImage ? [seo.shareImage] : undefined },
    twitter: { card: seo.shareImage ? "summary_large_image" : "summary" },
    robots: seo.allowIndexing ? undefined : { index: false, follow: false },
    verification: {
      google: seo.googleVerification || undefined,
      other: seo.bingVerification ? { "msvalidate.01": seo.bingVerification } : undefined,
    },
  };
}

export const viewport: Viewport = {
  viewportFit: "cover",
  // Light theme only (see globals.css).
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await getViewer();
  // Store chrome (header, footer, cart) lives in (store)/layout.tsx; /admin has its own layout.
  return (
    <html lang="en">
      <body>
        <WishlistProvider signedIn={!!viewer} initialIds={viewer?.wishlistIds ?? []}>
          {children}
        </WishlistProvider>
      </body>
    </html>
  );
}
