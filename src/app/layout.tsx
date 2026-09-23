import type { Metadata, Viewport } from "next";
import { StoreRulesProvider } from "@/components/store-rules-provider";
import { WishlistProvider } from "@/components/wishlist/wishlist-provider";
import { getStoreRules } from "@/lib/settings";
import { getViewer } from "@/lib/viewer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexora IT – Hardware & Solutions",
  description:
    "Business-grade IT hardware and solutions, sourced and supported by people who care.",
};

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
  const [viewer, rules] = await Promise.all([getViewer(), getStoreRules()]);
  // Store chrome (header, footer, cart) lives in (store)/layout.tsx; /admin has its own layout.
  return (
    <html lang="en">
      <body>
        <StoreRulesProvider rules={rules}>
          <WishlistProvider signedIn={!!viewer} initialIds={viewer?.wishlistIds ?? []}>
            {children}
          </WishlistProvider>
        </StoreRulesProvider>
      </body>
    </html>
  );
}
