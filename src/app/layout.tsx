import type { Metadata, Viewport } from "next";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        <CartDrawer />
      </body>
    </html>
  );
}
