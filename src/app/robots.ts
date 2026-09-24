import type { MetadataRoute } from "next";
import { getConfig } from "@/lib/config";
import { PRIVATE_PATHS } from "@/lib/seo";
import { APP_URL } from "@/lib/site-url";

// /robots.txt. Settings → SEO → "Let search engines index the store" off blocks everything (e.g. while testing).
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getConfig("seo");
  if (!seo.allowIndexing) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }, sitemap: `${APP_URL}/sitemap.xml`, host: APP_URL };
}
