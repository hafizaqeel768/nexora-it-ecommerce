import type { Metadata, Viewport } from "next";
import { WishlistProvider } from "@/components/wishlist/wishlist-provider";
import { getConfig } from "@/lib/config";
import { getViewer } from "@/lib/viewer";
import "./globals.css";

// Titles and description follow Settings → Store details; pages set only their own part ("Cart" → "Cart | Store").
export async function generateMetadata(): Promise<Metadata> {
  const store = await getConfig("store");
  return {
    title: { template: `%s | ${store.name}`, default: store.tagline ? `${store.name} – ${store.tagline}` : store.name },
    description: store.footerAbout || undefined,
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
