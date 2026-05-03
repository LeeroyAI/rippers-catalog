import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Turbopack must resolve `next` from the real app root (not `app/`). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  devIndicators: {
    buildActivity: false,
  },
  turbopack: {
    root: projectRoot,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "**",
      },
    ],
  },
};

export default nextConfig;
