import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Turbopack must resolve `next` from the real app root (not `app/`). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /**
   * Leaflet + react-leaflet can throw "Map container is being reused by another instance"
   * under React StrictMode's dev-only double mount/unmount cycle.
   * Disable strict mode to keep map lifecycle stable during local development.
   */
  reactStrictMode: false,
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
