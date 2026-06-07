import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Turbopack must resolve `next` from the real app root (not `app/`). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /**
   * Build a self-contained server bundle (.next/standalone/server.js) so CI can
   * ship a prebuilt app to Azure. The B1 App Service instance (1.75 GB) OOMs
   * running `next build`, so we build on the GitHub Actions runner instead and
   * Azure only runs `node server.js`. See the deploy workflow.
   */
  output: "standalone",
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
