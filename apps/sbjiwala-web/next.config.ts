import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "production" ? 'standalone' : "export",
  experimental: {
    externalDir: true,
  },
  turbopack: {
    resolveAlias: {
      "@sbjiwala/shared": "./node_modules/@sbjiwala/shared/dist/index.js",
    },
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@sbjiwala/shared"],
};

export default nextConfig;
