import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "development" ? undefined : "export",
  experimental: {
    externalDir: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@sbjiwala/shared"],
};

export default nextConfig;
