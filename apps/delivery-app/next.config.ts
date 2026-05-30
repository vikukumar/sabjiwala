import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "export",
  experimental: {
    externalDir: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@sbjiwala/shared"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@sbjiwala/shared": path.resolve(__dirname, "node_modules/@sbjiwala/shared"),
    };
    return config;
  },
};

export default nextConfig;
