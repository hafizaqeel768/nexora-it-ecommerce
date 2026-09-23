import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A QA build can go to its own folder (NEXT_DIST_DIR=.next-qa npm run build) so it never touches
  // the running dev server's .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // Admin product form uploads up to 5 photos of 4 MB each (src/lib/uploads.ts).
    serverActions: { bodySizeLimit: "21mb" },
  },
};

export default nextConfig;
