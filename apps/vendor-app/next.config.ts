import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "development" ? undefined : "export",
  trailingSlash: true,
  experimental: {
    externalDir: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@sbjiwala/shared"],
  env: {
    NEXT_PUBLIC_APP_MODE: "vendor",
  },
};

export default nextConfig;
