// Image naming convention for media/ (served at /media via the public/media symlink):
//   media/<name>.webp                  site images: about-main, banner-<brand>-<topic>
//   media/category/<category-slug>.*   category photos (optional; tiles fall back to icons)
//   media/products/<product-slug>.jpg  product photos; original titles in src/data/product-images.json
// Server-only: reads the filesystem to discover optional category photos.
import fs from "node:fs";
import path from "node:path";

const mediaDir = path.join(process.cwd(), "media");
const imageExt = [".webp", ".jpg", ".png"];

export const siteImages = {
  about: { src: "/media/about-main.webp", width: 513, height: 385 },
  banners: {
    viewsonic: { src: "/media/banner-viewsonic-monitors.webp", width: 1320, height: 420 },
    ubiquiti: { src: "/media/banner-ubiquiti-switches.webp", width: 1320, height: 420 },
    schneider: { src: "/media/banner-schneider-power-meters.webp", width: 650, height: 280 },
    prolec: { src: "/media/banner-prolec-transformers.webp", width: 650, height: 280 },
  },
} as const;

/** Public URL of a category photo, or null if media/category/<slug>.{webp,jpg,png} doesn't exist. */
export function categoryImage(slug: string): string | null {
  for (const ext of imageExt) {
    if (fs.existsSync(path.join(mediaDir, "category", slug + ext))) {
      return `/media/category/${slug}${ext}`;
    }
  }
  return null;
}

/** Public URL of a product photo by product slug (file names come from `npm run media:slugify`). */
export const productImage = (slug: string) => `/media/products/${slug}.jpg`;
