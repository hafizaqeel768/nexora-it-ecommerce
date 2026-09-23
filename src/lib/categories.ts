// Top-level categories for the menu, footer and home tiles (server-only), read once per request.
import { cache } from "react";
import { db } from "@/lib/db";

export type MenuCategory = { slug: string; name: string; icon: string | null; image: string | null; description: string | null };

export const getMenuCategories = cache(async (): Promise<MenuCategory[]> =>
  db.category.findMany({
    where: { parentId: null, showInMenu: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { slug: true, name: true, icon: true, image: true, description: true },
  }),
);

/** The home page shows this many category tiles (plus "IT Services" and "All Products"), like the prototype's 4×2 grid. */
export const HOME_CATEGORY_TILES = 6;
