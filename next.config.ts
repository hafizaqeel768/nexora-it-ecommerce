import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Admin product form uploads up to 5 photos of 4 MB each (src/lib/uploads.ts).
    serverActions: { bodySizeLimit: "21mb" },
  },
};

export default nextConfig;
