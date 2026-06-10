import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "development" ? undefined : "export",
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
  env: {
    NEXT_PUBLIC_APP_MODE: "unified",
  },
};

export default nextConfig;
