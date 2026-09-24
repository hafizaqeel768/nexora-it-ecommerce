// Public site URL (APP_URL in .env), for links in emails, canonical URLs, the sitemap and share tags.
// Jobs and the sitemap run without a request, so this can't come from request headers.
export const APP_URL = (process.env.APP_URL ?? "http://localhost:3100").replace(/\/$/, "");

/** "/product/x" → "https://shop.example.com/product/x" (absolute URLs pass through). */
export const absoluteUrl = (path: string) => (/^https?:\/\//i.test(path) ? path : `${APP_URL}${path.startsWith("/") ? "" : "/"}${path}`);
